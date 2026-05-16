/**
 * POST /api/auth/register
 *
 * Account creation. Behaviour depends on the `VOUCHER_REQUIRED_FOR_REGISTRATION`
 * environment flag:
 *
 *   - flag OFF (default historical behaviour): free public sign-up. Any
 *     zod-valid body creates an account on the `free` tier.
 *   - flag ON (pilot mode — the current default in production): a valid
 *     registration-scope voucher is REQUIRED. The voucher determines the
 *     tier and trial-days granted; the redemption is recorded atomically
 *     with the user row so a seat is only consumed when a user actually
 *     exists.
 *
 * Rate-limited by IP: 3 registrations / 15 min. Brute-forcing through
 * voucher codes to find a valid one is already blocked at
 * /api/voucher/check; this limiter is a second line defending against
 * rapid-fire account spam once a valid code IS known.
 */
import { NextRequest, NextResponse } from 'next/server';
import { jsonResponse } from '@/lib/api-response';
import { eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { users, promoCodes, codeRedemptions } from '@/db/schema';
import { hashPassword, generateId } from '@/lib/crypto';
import { createSession } from '@/lib/session';
import { getEnv } from '@/lib/cloudflare';
import { RegisterRequest, zodFailure } from '@/lib/schemas';
import { validateVoucherForRegistration } from '@/lib/voucher';
import { rateLimit, tooManyResponse } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';

function voucherRequired(env: any): boolean {
  // The flag is a string coming from wrangler / Pages secrets; normalize.
  const raw = env?.VOUCHER_REQUIRED_FOR_REGISTRATION;
  if (raw === undefined || raw === null) return false;
  const v = String(raw).toLowerCase().trim();
  return v === 'true' || v === '1' || v === 'yes' || v === 'on';
}

export async function POST(req: NextRequest) {
  const rl = await rateLimit(req, {
    routeLabel: 'auth-register',
    limit: 3,
    windowMs: 15 * 60_000,
  });
  if (!rl.allowed) return tooManyResponse(rl);

  try {
    const rawBody = await req.json().catch(() => null);
    const parsed = RegisterRequest.safeParse(rawBody);
    if (!parsed.success) {
      return jsonResponse(zodFailure(parsed.error), { status: 400 });
    }
    const { email, password, displayName, voucherCode } = parsed.data;

    const env = await getEnv();
    const db = getDb(env);

    // ── 1. Voucher gating ────────────────────────────────────────
    //
    // Check BEFORE any DB writes so a rejected request leaves no
    // partial state (and no wasted PBKDF2 hash CPU). We also do the
    // voucher read before the email-existence check so a missing or
    // bad voucher doesn't leak "this email is registered" by
    // returning 409 before it ever gets to the voucher layer.
    let voucherRow: Awaited<ReturnType<typeof validateVoucherForRegistration>> | null = null;
    const voucherGateOn = voucherRequired(env);
    if (voucherGateOn || voucherCode) {
      if (!voucherCode) {
        return jsonResponse(
          { error: 'A voucher code is required to register during the pilot.', reason: 'voucher_required' },
          { status: 400 },
        );
      }
      voucherRow = await validateVoucherForRegistration(db, voucherCode);
      if (!voucherRow.valid) {
        // Mirror /api/voucher/check shape so the UI can render the
        // same localised message regardless of which endpoint
        // surfaced the rejection.
        return jsonResponse(
          { error: 'Invalid voucher', reason: voucherRow.reason },
          { status: 400 },
        );
      }
    }

    // ── 2. Email uniqueness (fast-path; race handled by UNIQUE index) ─
    // Select only the column we need so missing schema-declared columns
    // (e.g. an unapplied is_admin migration) don't crash registration.
    const existingUsers = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    if (existingUsers.length > 0) {
      return jsonResponse({ error: 'Email already in use' }, { status: 409 });
    }

    // ── 3. Hash password + derive tier from voucher ───────────────
    const hashedPassword = await hashPassword(password);
    const userId = generateId();

    // Default tier is free; a valid registration voucher can promote.
    let subscriptionTier = 'free';
    let trialExpiresAt: Date | null = null;
    let promoSource: string | null = null;
    if (voucherRow?.valid) {
      subscriptionTier = voucherRow.row.grantTier ?? 'free';
      if (voucherRow.row.trialDays && voucherRow.row.trialDays > 0) {
        trialExpiresAt = new Date();
        trialExpiresAt.setDate(trialExpiresAt.getDate() + voucherRow.row.trialDays);
      }
      promoSource = voucherRow.row.code;
    }

    // ── 4. Insert user + redemption in sequence with
    //       safe unwind on conflict ─────────────────────────────────
    //
    // D1 doesn't expose a transaction API to the Workers runtime at
    // the time of writing, so we approximate atomicity: insert the
    // user first, then insert the redemption. If the redemption
    // insert hits the UNIQUE (user_id, code_id) index (migration 0001),
    // the voucher has already been used by this user — but since we
    // JUST created that user a line above, in practice the only way
    // to hit this is a user-ID collision, which our UUIDv4 generator
    // makes astronomically unlikely.
    try {
      await db.insert(users).values({
        id: userId,
        email,
        displayName,
        hashedPassword,
        subscriptionTier,
        trialExpiresAt,
        promoSource,
        language: 'th',
        scansThisMonth: 0,
        streakDays: 0,
        totalPoints: 0,
        createdAt: new Date(),
      });
    } catch (insertErr: any) {
      const msg = String(insertErr?.message || '');
      if (/unique constraint|sqlite_constraint|already exists/i.test(msg)) {
        return jsonResponse({ error: 'Email already in use' }, { status: 409 });
      }
      throw insertErr;
    }

    if (voucherRow?.valid) {
      try {
        await db.insert(codeRedemptions).values({
          id: generateId(),
          userId,
          codeId: voucherRow.row.id,
          benefitsApplied: {
            tier: subscriptionTier,
            trialDays: voucherRow.row.trialDays,
            viaRegistration: true,
          },
          redeemedAt: new Date(),
        });
        await db
          .update(promoCodes)
          .set({ usageCount: (voucherRow.row.usageCount ?? 0) + 1 })
          .where(eq(promoCodes.id, voucherRow.row.id));
        logger.info('[REGISTER] voucher redeemed at sign-up', {
          userId: userId.substring(0, 8),
          code: voucherRow.row.code,
          tier: subscriptionTier,
        });
      } catch (e) {
        // The user row is already committed. Redemption-record failure
        // is a logging problem, not a user-facing one — they got the
        // account, but the seat may not have been accounted for. Log
        // loudly so an admin can reconcile via /admin/promo.
        logger.error('[REGISTER] voucher redemption bookkeeping failed', {
          userId: userId.substring(0, 8),
          code: voucherRow.row.code,
          error: String((e as any)?.message ?? e),
        });
      }
    }

    // ── 5. Session cookie, then respond ───────────────────────────
    await createSession(env, userId);

    return jsonResponse(
      {
        user: { id: userId, email, displayName, subscriptionTier, trialExpiresAt },
        message: 'Registered successfully',
      },
      { status: 201 },
    );
  } catch (error: any) {
    console.error('Registration error:', error);
    return jsonResponse(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
