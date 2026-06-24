import { NextRequest, NextResponse } from 'next/server';
import { jsonResponse } from '@/lib/api-response';
import { getDb } from '@/db';
import { users, sessions } from '@/db/schema';
import { getSessionToken } from '@/lib/session';
import { eq, and, gt } from 'drizzle-orm';
import { getEnv } from '@/lib/cloudflare';


export async function GET(req: NextRequest) {
    try {
        const token = await getSessionToken();

        // `/api/auth/me` is a SESSION PROBE, not a gated resource. Every
        // page runs it on mount via SiteHeader's initAuth(), so for the
        // (very common) anonymous first-time visitor it fires on the
        // homepage too. Returning 401 here made the browser log
        // "Failed to load resource: 401" to the console on every
        // anonymous page load — caught by the e2e smoke suite as a
        // console error on all 4 locales. "Who am I?" with no session is
        // a valid question with a valid answer (nobody), so we answer
        // 200 { authenticated: false, user: null }. Genuinely gated
        // endpoints (dashboard data, admin) still 401/403.
        if (!token) {
            return jsonResponse({ authenticated: false, user: null }, { status: 200 });
        }

        const env = await getEnv();
        const db = getDb(env);

        // Find session — only the columns we read below.
        const activeSessions = await db
            .select({ userId: sessions.userId, expiresAt: sessions.expiresAt })
            .from(sessions)
            .where(
                and(
                    eq(sessions.token, token),
                    gt(sessions.expiresAt, new Date())
                )
            ).limit(1);

        if (activeSessions.length === 0) {
            return jsonResponse({ authenticated: false, user: null }, { status: 200 });
        }

        const session = activeSessions[0];

        // Find user — explicit column list so missing schema-declared
        // columns in the live DB (e.g. an unapplied additive migration)
        // don't take down session validation. See login route for the
        // same pattern + rationale.
        const foundUsers = await db
            .select({
                id: users.id,
                email: users.email,
                displayName: users.displayName,
                subscriptionTier: users.subscriptionTier,
                scansThisMonth: users.scansThisMonth,
                totalPoints: users.totalPoints,
                streakDays: users.streakDays,
                trialExpiresAt: users.trialExpiresAt,
            })
            .from(users)
            .where(eq(users.id, session.userId!))
            .limit(1);
        const user = foundUsers[0];

        if (!user) {
            // Valid session token but the user row is gone (deleted while
            // the session was live). Treat as not-authenticated rather
            // than 404 — same probe semantics, no console error.
            return jsonResponse({ authenticated: false, user: null }, { status: 200 });
        }

        // Helper to check if trial is expired to quickly downgrade if necessary
        let currentTier = user.subscriptionTier;
        if (currentTier === 'premium' && user.trialExpiresAt && new Date() > new Date(user.trialExpiresAt)) {
            currentTier = 'free'; // Effectively free now. Front-end will prompt to upgrade.
            // Ideally we also update the DB here, but read-only is safer for simple GET
            // await db.update(users).set({ subscriptionTier: 'free' }).where(eq(users.id, user.id));
        }

        return jsonResponse({
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
        return jsonResponse(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
