import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db';
import { users } from '@/db/schema';
import { hashPassword, generateId } from '@/lib/crypto';
import { createSession } from '@/lib/session';
import { eq } from 'drizzle-orm';
import { getCloudflareContext } from '@opennextjs/cloudflare';


export async function POST(req: NextRequest) {
    try {
        const { displayName, email, password } = await req.json();

        if (!email || !password || !displayName) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const { env } = await getCloudflareContext();
        const db = getDb(env);

        // Check if user already exists
        const existingUsers = await db.select().from(users).where(eq(users.email, email)).limit(1);
        if (existingUsers.length > 0) {
            return NextResponse.json({ error: 'Email already in use' }, { status: 409 });
        }

        // Hash password and create user
        const hashedPassword = await hashPassword(password);
        const userId = generateId();

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
        console.error('Registration error:', error);
        return NextResponse.json(
            { error: 'Internal server error', details: error.message },
            { status: 500 }
        );
    }
}
