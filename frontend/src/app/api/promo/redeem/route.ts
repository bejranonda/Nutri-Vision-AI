import { NextRequest, NextResponse } from 'next/server';
import { jsonResponse } from '@/lib/api-response';
import { getDb } from '@/db';
import { users, promoCodes, codeRedemptions } from '@/db/schema';
import { getSessionToken } from '@/lib/session';
import { eq, and, gt } from 'drizzle-orm';
import { generateId } from '@/lib/crypto';
import { sessions } from '@/db/schema';
import { getEnv } from '@/lib/cloudflare';
import { PromoRedeemRequest, zodFailure } from '@/lib/schemas';
import { rateLimit, tooManyResponse } from '@/lib/rate-limit';


export async function POST(req: NextRequest) {
    // Per-IP rate limit: 5 redemption attempts/min. The route is
    // session-gated, but a logged-in attacker could still enumerate
    // promo codes by brute force — /api/voucher/check already throttles
    // the anonymous path; this closes the authenticated one.
    const rl = await rateLimit(req, {
        routeLabel: 'promo-redeem',
        limit: 5,
        windowMs: 60_000,
    });
    if (!rl.allowed) return tooManyResponse(rl);

    try {
        const rawBody = await req.json().catch(() => null);
        // Bound the code length up-front so a client can't DoS the DB
        // with a 1-MB "code" string.
        const parsed = PromoRedeemRequest.safeParse(rawBody);
        if (!parsed.success) {
            return jsonResponse(zodFailure(parsed.error), { status: 400 });
        }
        const { code } = parsed.data;

        const token = await getSessionToken();
        if (!token) {
            return jsonResponse({ error: 'Not authenticated. Please log in first.' }, { status: 401 });
        }

        const env = await getEnv();
        const db = getDb(env);

        // Get user session — MUST check expiresAt. Without this, an
        // attacker holding an expired-but-not-yet-cleaned session token
        // could still redeem codes. `/api/auth/me` already enforces this;
        // keep the check consistent across every session-gated route.
        const activeSessions = await db
            .select({ userId: sessions.userId })
            .from(sessions)
            .where(
                and(
                    eq(sessions.token, token),
                    gt(sessions.expiresAt, new Date()),
                ),
            )
            .limit(1);
        if (activeSessions.length === 0) {
            return jsonResponse({ error: 'Session invalid or expired' }, { status: 401 });
        }
        const userId = activeSessions[0].userId!;

        // 1. Validate Code — explicit columns so the route survives if
        // schema-declared columns (e.g. `scope`/`notes` from migration
        // 0003) haven't been applied to the live DB yet. Only fetch
        // what this handler reads below.
        const upperCode = code.toUpperCase();
        const foundCodes = await db
            .select({
                id: promoCodes.id,
                code: promoCodes.code,
                isActive: promoCodes.isActive,
                expiresAt: promoCodes.expiresAt,
                usageLimit: promoCodes.usageLimit,
                usageCount: promoCodes.usageCount,
                grantTier: promoCodes.grantTier,
                trialDays: promoCodes.trialDays,
            })
            .from(promoCodes)
            .where(eq(promoCodes.code, upperCode))
            .limit(1);

        if (foundCodes.length === 0) {
            return jsonResponse({ error: 'Invalid promotion code' }, { status: 404 });
        }

        const promoCode = foundCodes[0];

        if (!promoCode.isActive) {
            return jsonResponse({ error: 'This code is no longer active' }, { status: 400 });
        }

        if (promoCode.expiresAt && new Date() > new Date(promoCode.expiresAt)) {
            return jsonResponse({ error: 'This code has expired' }, { status: 400 });
        }

        if (promoCode.usageLimit && promoCode.usageCount != null && promoCode.usageCount >= promoCode.usageLimit) {
            return jsonResponse({ error: 'This code has reached its usage limit' }, { status: 400 });
        }

        // 2. Check if user already redeemed this code (only need the id).
        const previousRedemptions = await db
            .select({ id: codeRedemptions.id })
            .from(codeRedemptions)
            .where(and(eq(codeRedemptions.userId, userId), eq(codeRedemptions.codeId, promoCode.id)))
            .limit(1);

        if (previousRedemptions.length > 0) {
            return jsonResponse({ error: 'You have already redeemed this code' }, { status: 400 });
        }

        // --- Apply benefits ---

        // 3. Update User
        // If it's a TRIAL or FANCLUB, they get premium for X days
        // If it's a DISCOUNT, we just flag them. (In a real app, we'd hook this to Stripe).
        let expiresAt: Date | null = null;
        let newTier = promoCode.grantTier || 'premium';

        if (promoCode.trialDays) {
            expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + promoCode.trialDays);
        }

        // 3. Claim the redemption FIRST (before granting any benefits).
        //    The unique index on (user_id, code_id) is the race-safe lock:
        //    whichever of two concurrent POSTs inserts first wins; the
        //    loser hits a UNIQUE-constraint error and bails out with the
        //    same "already redeemed" 400 the pre-check would return.
        //    If we updated the user tier first and then failed the insert,
        //    we'd have granted benefits without a redemption record —
        //    split-brain. This ordering avoids that.
        try {
            await db.insert(codeRedemptions).values({
                id: generateId(),
                userId: userId,
                codeId: promoCode.id,
                redeemedAt: new Date(),
                benefitsApplied: { tier: newTier, trialDays: promoCode.trialDays },
            });
        } catch (insertErr: any) {
            const msg = String(insertErr?.message || '');
            if (/unique constraint|sqlite_constraint|already exists/i.test(msg)) {
                return jsonResponse(
                    { error: 'You have already redeemed this code' },
                    { status: 400 },
                );
            }
            throw insertErr;
        }

        // 4. Redemption claimed — now apply the benefits.
        await db.update(users)
            .set({
                subscriptionTier: newTier,
                trialExpiresAt: expiresAt,
                promoSource: upperCode
            })
            .where(eq(users.id, userId));

        // 5. Increment Usage Count (best-effort; not critical if it fails).
        await db.update(promoCodes)
            .set({ usageCount: (promoCode.usageCount || 0) + 1 })
            .where(eq(promoCodes.id, promoCode.id));

        return jsonResponse({
            message: 'Code redeemed successfully!',
            benefits: {
                tier: newTier,
                trialDays: promoCode.trialDays,
                expiresAt
            }
        }, { status: 200 });

    } catch (error: any) {
        // Log the full error server-side only. `error.message` can contain
        // DB driver text / stack hints that help an attacker probe the
        // schema — never return it to the client.
        console.error('Promo code redemption error:', error);
        return jsonResponse(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
