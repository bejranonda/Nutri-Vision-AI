/**
 * POST /api/admin/users/update-tier
 *
 * Manually override a user's subscription tier. Used when an admin
 * grants a courtesy upgrade, resolves a payment dispute, etc.
 *
 * We deliberately do NOT modify `trialExpiresAt` or `promoSource` here
 * — those fields belong to the promo-code path. Toggling tier via this
 * route is a pure admin override and leaves no trial timer.
 */
import { NextRequest, NextResponse } from 'next/server';
import { jsonResponse } from '@/lib/api-response';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '@/db';
import { users } from '@/db/schema';
import { getEnvSafe } from '@/lib/cloudflare';
import { requireAdminApi } from '@/lib/admin-auth';
import { zodFailure } from '@/lib/schemas';
import { logger } from '@/lib/logger';

const Body = z.object({
  userId: z.string().min(1).max(64),
  tier: z.enum(['free', 'premium', 'family']),
});

export async function POST(req: NextRequest) {
  const gate = await requireAdminApi();
  if ('response' in gate) return gate.response;
  const actingAdmin = gate.user;

  const raw = await req.json().catch(() => null);
  const parsed = Body.safeParse(raw);
  if (!parsed.success) {
    return jsonResponse(zodFailure(parsed.error), { status: 400 });
  }
  const { userId, tier } = parsed.data;

  let env;
  try {
    env = await getEnvSafe();
  } catch {
    return jsonResponse({ error: 'Internal server error' }, { status: 500 });
  }
  const db = getDb(env);

  const existing = await db.select({ id: users.id, email: users.email, currentTier: users.subscriptionTier })
    .from(users).where(eq(users.id, userId)).limit(1);
  if (existing.length === 0) {
    return jsonResponse({ error: 'User not found' }, { status: 404 });
  }

  try {
    await db.update(users).set({ subscriptionTier: tier }).where(eq(users.id, userId));
    logger.warn('[ADMIN_ACTION] subscriptionTier updated', {
      actor: actingAdmin.email,
      target: existing[0].email,
      from: existing[0].currentTier,
      to: tier,
    });
    return jsonResponse({ ok: true, tier });
  } catch (e) {
    logger.error('[ADMIN_ACTION] tier update failed', { e });
    return jsonResponse({ error: 'Internal server error' }, { status: 500 });
  }
}
