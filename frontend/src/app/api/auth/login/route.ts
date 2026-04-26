import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db';
import { users } from '@/db/schema';
import { verifyPassword } from '@/lib/crypto';
import { createSession } from '@/lib/session';
import { eq } from 'drizzle-orm';
import { getEnv } from '@/lib/cloudflare';
import { LoginRequest, zodFailure } from '@/lib/schemas';
import { rateLimit, tooManyResponse } from '@/lib/rate-limit';


export async function POST(req: NextRequest) {
    // Per-IP rate limit: 10 attempts per 15 minutes. Blocks brute-force
    // password guessing without being so tight it blocks a real user
    // fat-fingering their password 2-3 times.
    const rl = await rateLimit(req, {
        routeLabel: 'auth-login',
        limit: 10,
        windowMs: 15 * 60_000,
    });
    if (!rl.allowed) return tooManyResponse(rl);

    try {
        const rawBody = await req.json().catch(() => null);
        // Validate the request shape up front. Zod rejects malformed JSON,
        // wrong types, and empty/oversize strings — everything downstream
        // can assume `email` and `password` are non-empty sanitised strings.
        const parsed = LoginRequest.safeParse(rawBody);
        if (!parsed.success) {
            return NextResponse.json(zodFailure(parsed.error), { status: 400 });
        }
        const { email, password } = parsed.data;

        const env = await getEnv();
        const db = getDb(env);

        const foundUsers = await db.select().from(users).where(eq(users.email, email)).limit(1);
        const user = foundUsers[0];

        if (!user || !(await verifyPassword(password, user.hashedPassword!))) {
            return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
        }

        // Create a new session and HTTP-Only cookie
        await createSession(env, user.id);

        return NextResponse.json({
            user: {
                id: user.id,
                email: user.email,
                displayName: user.displayName,
                subscriptionTier: user.subscriptionTier,
                scansThisMonth: user.scansThisMonth,
                totalPoints: user.totalPoints,
                streakDays: user.streakDays
            },
            message: 'Logged in successfully'
        }, { status: 200 });

    } catch (error: any) {
        // Server-side only — never return error.message to the client.
        console.error('Login error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
