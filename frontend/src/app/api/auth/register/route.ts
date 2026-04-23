import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db';
import { users } from '@/db/schema';
import { hashPassword, generateId } from '@/lib/crypto';
import { createSession } from '@/lib/session';
import { eq } from 'drizzle-orm';
import { getEnv } from '@/lib/cloudflare';
import { RegisterRequest, zodFailure } from '@/lib/schemas';


export async function POST(req: NextRequest) {
    try {
        const rawBody = await req.json().catch(() => null);
        // Shape validation first — enforces min password length, email
        // format, and display name bounds before we touch the DB.
        const parsed = RegisterRequest.safeParse(rawBody);
        if (!parsed.success) {
            return NextResponse.json(zodFailure(parsed.error), { status: 400 });
        }
        const { email, password, displayName } = parsed.data;

        const env = await getEnv();
        const db = getDb(env);

        // Check if user already exists. Note: this check is a fast-path —
        // it is NOT the authoritative guard. The `users.email` column has a
        // UNIQUE constraint, so concurrent registrations with the same email
        // will produce a DB error on the insert below (caught and
        // translated to a 409 to keep the response identical to the
        // pre-check path and avoid leaking any timing/enumeration signal).
        const existingUsers = await db.select().from(users).where(eq(users.email, email)).limit(1);
        if (existingUsers.length > 0) {
            return NextResponse.json({ error: 'Email already in use' }, { status: 409 });
        }

        // Hash password and create user
        const hashedPassword = await hashPassword(password);
        const userId = generateId();

        try {
            await db.insert(users).values({
                id: userId,
                email,
                displayName,
                hashedPassword,
                subscriptionTier: 'free',
                language: 'th',
                scansThisMonth: 0,
                streakDays: 0,
                totalPoints: 0,
                createdAt: new Date()
            });
        } catch (insertErr: any) {
            // Unique-constraint violation from the concurrent-registration
            // race. SQLite/D1 surfaces this as "UNIQUE constraint failed".
            // Return the same 409 as the pre-check path; never return the
            // driver message (leaks schema / race signal).
            const msg = String(insertErr?.message || '');
            if (/unique constraint|sqlite_constraint|already exists/i.test(msg)) {
                return NextResponse.json({ error: 'Email already in use' }, { status: 409 });
            }
            throw insertErr;
        }

        // Create session and set cookie
        await createSession(env, userId);

        return NextResponse.json({
            user: {
                id: userId,
                email,
                displayName,
                subscriptionTier: 'free'
            },
            message: 'Registered successfully'
        }, { status: 201 });

    } catch (error: any) {
        // Server-side only — never return error.message to the client.
        console.error('Registration error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
