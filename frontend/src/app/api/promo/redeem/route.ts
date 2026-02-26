import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db';
import { users, promoCodes, codeRedemptions } from '@/db/schema';
import { getSessionToken } from '@/lib/session';
import { eq, and, gt } from 'drizzle-orm';
import { generateId } from '@/lib/crypto';
import { sessions } from '@/db/schema';


export async function POST(req: NextRequest) {
    try {
        const { code } = await req.json();

        if (!code) {
            return NextResponse.json({ error: 'Promo code is required' }, { status: 400 });
        }

        const token = await getSessionToken();
        if (!token) {
            return NextResponse.json({ error: 'Not authenticated. Please log in first.' }, { status: 401 });
        }

        const env = (req as any).context?.env || process.env;
        const db = getDb(env);

        // Get user session
        const activeSessions = await db.select().from(sessions).where(eq(sessions.token, token)).limit(1);
        if (activeSessions.length === 0) {
            return NextResponse.json({ error: 'Session invalid' }, { status: 401 });
        }
        const userId = activeSessions[0].userId!;

        // 1. Validate Code
        const upperCode = code.toUpperCase();
        const foundCodes = await db.select().from(promoCodes).where(eq(promoCodes.code, upperCode)).limit(1);

        if (foundCodes.length === 0) {
            return NextResponse.json({ error: 'Invalid promotion code' }, { status: 404 });
        }

        const promoCode = foundCodes[0];

        if (!promoCode.isActive) {
            return NextResponse.json({ error: 'This code is no longer active' }, { status: 400 });
        }

        if (promoCode.expiresAt && new Date() > new Date(promoCode.expiresAt)) {
            return NextResponse.json({ error: 'This code has expired' }, { status: 400 });
        }

        if (promoCode.usageLimit && promoCode.usageCount != null && promoCode.usageCount >= promoCode.usageLimit) {
            return NextResponse.json({ error: 'This code has reached its usage limit' }, { status: 400 });
        }

        // 2. Check if user already redeemed this code
        const previousRedemptions = await db.select()
            .from(codeRedemptions)
            .where(and(eq(codeRedemptions.userId, userId), eq(codeRedemptions.codeId, promoCode.id)))
            .limit(1);

        if (previousRedemptions.length > 0) {
            return NextResponse.json({ error: 'You have already redeemed this code' }, { status: 400 });
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

        await db.update(users)
            .set({
                subscriptionTier: newTier,
                trialExpiresAt: expiresAt,
                promoSource: upperCode
            })
            .where(eq(users.id, userId));

        // 4. Record Redemption
        await db.insert(codeRedemptions).values({
            id: generateId(),
            userId: userId,
            codeId: promoCode.id,
            redeemedAt: new Date(),
            benefitsApplied: { tier: newTier, trialDays: promoCode.trialDays }
        });

        // 5. Increment Usage Count
        await db.update(promoCodes)
            .set({ usageCount: (promoCode.usageCount || 0) + 1 })
            .where(eq(promoCodes.id, promoCode.id));

        return NextResponse.json({
            message: 'Code redeemed successfully!',
            benefits: {
                tier: newTier,
                trialDays: promoCode.trialDays,
                expiresAt
            }
        }, { status: 200 });

    } catch (error: any) {
        console.error('Promo code redemption error:', error);
        return NextResponse.json(
            { error: 'Internal server error', details: error.message },
            { status: 500 }
        );
    }
}
