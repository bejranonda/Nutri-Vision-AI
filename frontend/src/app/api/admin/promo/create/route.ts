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
  // 'registration' = sign-up gating voucher (pilot); 'upgrade' = classic
  // promo code redeemed by an already-logged-in user. Defaults to
  // 'upgrade' for backward compatibility with existing admin tooling.
  scope: z.enum(['registration', 'upgrade']).default('upgrade'),
  grantTier: z.enum(['premium', 'family']).default('premium'),
  trialDays: z.number().int().min(0).max(3650).optional(),
  // 1 = Personal voucher; >1 = Organization. Capped at 1M as a
  // sanity guard; the UI ranges from 1 to a few thousand at most.
  usageLimit: z.number().int().min(1).max(1_000_000).optional(),
  // Admin-only label, not shown to end users. Caps at 500 chars to
  // keep the row compact in the table.
  notes: z.string().trim().max(500).optional(),
  // ISO date (YYYY-MM-DD) from the form; converted to a Date below.
  // Empty string and undefined both mean "no expiry".
  expiresAt: z
    .string()
    .trim()
    .max(40)
    .optional()
    .refine((v) => !v || !Number.isNaN(Date.parse(v)), 'Invalid date'),
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

  // Parse expiresAt — empty string means no expiry. Parsed as YYYY-MM-DD
  // in UTC so vouchers expire at end-of-day in the operator's mental
  // model (a typo of yesterday's date won't accidentally create a
  // pre-expired voucher because we normalise to 23:59:59).
  let expiresAt: Date | null = null;
  if (input.expiresAt) {
    const d = new Date(input.expiresAt);
    if (!Number.isNaN(d.getTime())) {
      d.setUTCHours(23, 59, 59, 999);
      expiresAt = d;
    }
  }

  try {
    await db.insert(promoCodes).values({
      id: generateId(),
      code: upperCode,
      type: input.type,
      scope: input.scope,
      notes: input.notes ?? null,
      grantTier: input.grantTier,
      trialDays: input.trialDays ?? null,
      usageLimit: input.usageLimit ?? null,
      usageCount: 0,
      isActive: true,
      expiresAt,
      createdAt: new Date(),
    });
    logger.warn('[ADMIN_ACTION] promo code created', {
      actor: actingAdmin.email,
      code: upperCode,
      type: input.type,
      scope: input.scope,
      grantTier: input.grantTier,
      trialDays: input.trialDays,
      usageLimit: input.usageLimit,
      hasExpiry: !!expiresAt,
      hasNotes: !!input.notes,
    });
    return NextResponse.json({ ok: true, code: upperCode, scope: input.scope });
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
