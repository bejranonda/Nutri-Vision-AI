/**
 * POST /api/admin/promo/toggle-active — flip `is_active` on a promo row.
 *
 * Deactivating a code stops any new redemptions but leaves existing
 * ones in place (the trial is already granted to those users).
 */
import { NextRequest, NextResponse } from 'next/server';
import { jsonResponse } from '@/lib/api-response';
import { rateLimit, tooManyResponse } from '@/lib/rate-limit';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '@/db';
import { promoCodes } from '@/db/schema';
import { getEnvSafe } from '@/lib/cloudflare';
import { requireAdminApi } from '@/lib/admin-auth';
import { zodFailure } from '@/lib/schemas';
import { logger } from '@/lib/logger';

const Body = z.object({
  id: z.string().min(1).max(64),
  isActive: z.boolean(),
});

export async function POST(req: NextRequest) {
  // Per-IP rate limit: 30/min. Admin routes are session+is_admin
  // gated, but a stolen admin cookie shouldn't allow unthrottled
  // scripting of mutations (KNOWN_ISSUES 0b follow-up, Round 14).
  const rl = await rateLimit(req, { routeLabel: 'admin-promo-toggle', limit: 30, windowMs: 60_000 });
  if (!rl.allowed) return tooManyResponse(rl);

  const gate = await requireAdminApi();
  if ('response' in gate) return gate.response;
  const actingAdmin = gate.user;

  const raw = await req.json().catch(() => null);
  const parsed = Body.safeParse(raw);
  if (!parsed.success) {
    return jsonResponse(zodFailure(parsed.error), { status: 400 });
  }
  const { id, isActive } = parsed.data;

  let env;
  try {
    env = await getEnvSafe();
  } catch {
    return jsonResponse({ error: 'Internal server error' }, { status: 500 });
  }
  const db = getDb(env);

  const existing = await db.select({ id: promoCodes.id, code: promoCodes.code })
    .from(promoCodes).where(eq(promoCodes.id, id)).limit(1);
  if (existing.length === 0) {
    return jsonResponse({ error: 'Promo code not found' }, { status: 404 });
  }

  try {
    await db.update(promoCodes).set({ isActive }).where(eq(promoCodes.id, id));
    logger.warn('[ADMIN_ACTION] promo isActive toggled', {
      actor: actingAdmin.email,
      code: existing[0].code,
      isActive,
    });
    return jsonResponse({ ok: true, isActive });
  } catch (e) {
    logger.error('[ADMIN_ACTION] promo toggle failed', { e });
    return jsonResponse({ error: 'Internal server error' }, { status: 500 });
  }
}
