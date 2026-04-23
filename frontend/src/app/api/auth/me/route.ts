import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db';
import { users, sessions } from '@/db/schema';
import { getSessionToken } from '@/lib/session';
import { eq, and, gt } from 'drizzle-orm';
import { getEnv } from '@/lib/cloudflare';


export async function GET(req: NextRequest) {
    try {
        const token = await getSessionToken();

        if (!token) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const env = await getEnv();
        const db = getDb(env);

        // Find session
        const activeSessions = await db.select()
            .from(sessions)
            .where(
                and(
                    eq(sessions.token, token),
                    gt(sessions.expiresAt, new Date())
                )
            ).limit(1);

        if (activeSessions.length === 0) {
            return NextResponse.json({ error: 'Invalid or expired session' }, { status: 401 });
        }

        const session = activeSessions[0];

        // Find user
        const foundUsers = await db.select().from(users).where(eq(users.id, session.userId!)).limit(1);
        const user = foundUsers[0];

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // Helper to check if trial is expired to quickly downgrade if necessary
        let currentTier = user.subscriptionTier;
        if (currentTier === 'premium' && user.trialExpiresAt && new Date() > new Date(user.trialExpiresAt)) {
            currentTier = 'free'; // Effectively free now. Front-end will prompt to upgrade.
            // Ideally we also update the DB here, but read-only is safer for simple GET
            // await db.update(users).set({ subscriptionTier: 'free' }).where(eq(users.id, user.id));
        }

        return NextResponse.json({
            user: {
                id: user.id,
                email: user.email,
                displayName: user.displayName,
                subscriptionTier: currentTier,
                scansThisMonth: user.scansThisMonth,
                totalPoints: user.totalPoints,
                streakDays: user.streakDays,
                trialExpiresAt: user.trialExpiresAt
            }
        }, { status: 200 });

    } catch (error: any) {
        // Server-side only — never return error.message to the client.
        console.error('Session retrieval error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
