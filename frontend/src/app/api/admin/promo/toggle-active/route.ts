/**
 * POST /api/admin/promo/toggle-active — flip `is_active` on a promo row.
 *
 * Deactivating a code stops any new redemptions but leaves existing
 * ones in place (the trial is already granted to those users).
 */
import { NextRequest, NextResponse } from 'next/server';
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
  const gate = await requireAdminApi();
  if ('response' in gate) return gate.response;
  const actingAdmin = gate.user;

  const raw = await req.json().catch(() => null);
  const parsed = Body.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(zodFailure(parsed.error), { status: 400 });
  }
  const { id, isActive } = parsed.data;

  let env;
  try {
    env = await getEnvSafe();
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
  const db = getDb(env);

  const existing = await db.select({ id: promoCodes.id, code: promoCodes.code })
    .from(promoCodes).where(eq(promoCodes.id, id)).limit(1);
  if (existing.length === 0) {
    return NextResponse.json({ error: 'Promo code not found' }, { status: 404 });
  }

  try {
    await db.update(promoCodes).set({ isActive }).where(eq(promoCodes.id, id));
    logger.warn('[ADMIN_ACTION] promo isActive toggled', {
      actor: actingAdmin.email,
      code: existing[0].code,
      isActive,
    });
    return NextResponse.json({ ok: true, isActive });
  } catch (e) {
    logger.error('[ADMIN_ACTION] promo toggle failed', { e });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
