/**
 * POST /api/admin/promo/create — insert a new promo code.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb } from '@/db';
import { promoCodes } from '@/db/schema';
import { getEnvSafe } from '@/lib/cloudflare';
import { requireAdminApi } from '@/lib/admin-auth';
import { zodFailure } from '@/lib/schemas';
import { generateId } from '@/lib/crypto';
import { logger } from '@/lib/logger';

const Body = z.object({
  // Upper-case enforced by the UI; we also normalise server-side
  // (trim + uppercase) so manual POSTs from curl behave identically.
  code: z
    .string()
    .trim()
    .min(3)
    .max(64)
    .regex(/^[A-Za-z0-9_-]+$/, 'Only A-Z, 0-9, - and _'),
  type: z.enum(['TRIAL', 'DISCOUNT', 'FANCLUB', 'REFERRAL']),
  grantTier: z.enum(['premium', 'family']).default('premium'),
  trialDays: z.number().int().min(0).max(3650).optional(),
  usageLimit: z.number().int().min(0).max(1_000_000).optional(),
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
  const input = parsed.data;

  let env;
  try {
    env = await getEnvSafe();
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
  const db = getDb(env);

  const upperCode = input.code.toUpperCase();

  try {
    await db.insert(promoCodes).values({
      id: generateId(),
      code: upperCode,
      type: input.type,
      grantTier: input.grantTier,
      trialDays: input.trialDays ?? null,
      usageLimit: input.usageLimit ?? null,
      usageCount: 0,
      isActive: true,
      createdAt: new Date(),
    });
    logger.warn('[ADMIN_ACTION] promo code created', {
      actor: actingAdmin.email,
      code: upperCode,
      type: input.type,
      grantTier: input.grantTier,
      trialDays: input.trialDays,
      usageLimit: input.usageLimit,
    });
    return NextResponse.json({ ok: true, code: upperCode });
  } catch (e: any) {
    // Unique-constraint on promo_codes.code means the code already exists —
    // return a specific 409 so the admin knows to pick a different string.
    const msg = String(e?.message || '');
    if (/unique constraint|sqlite_constraint|already exists/i.test(msg)) {
      return NextResponse.json(
        { error: `Code "${upperCode}" already exists` },
        { status: 409 },
      );
    }
    logger.error('[ADMIN_ACTION] promo create failed', { e });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
