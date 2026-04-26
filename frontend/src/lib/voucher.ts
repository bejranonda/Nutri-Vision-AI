/**
 * Voucher validation — shared business logic for the
 * registration-gating feature.
 *
 * Two call sites use this:
 *   - GET /api/voucher/check — read-only; surfaces {valid, reason,
 *     remainingSeats, expiresAt, grantTier, trialDays} to the
 *     registration UI for inline feedback.
 *   - POST /api/auth/register — authoritative check right before the
 *     atomic user-insert + redemption-insert batch.
 *
 * Business rules (single source of truth):
 *   1. The code must exist.
 *   2. Its `scope` must equal 'registration' (upgrade-scoped codes
 *      cannot bootstrap new accounts — they apply only to existing
 *      logged-in users via /api/promo/redeem).
 *   3. It must be `isActive`.
 *   4. `expiresAt` (if set) must be in the future.
 *   5. `usageCount` must be strictly less than `usageLimit`
 *      (if `usageLimit` is null or 0, the code is uncapped — we
 *      treat that as "unlimited seats" but in practice every admin-
 *      created voucher has an explicit limit).
 *
 * The `reason` strings are intentionally stable (machine-parseable
 * enum values, not free text) so the UI can render localised
 * messages and so the API response doesn't change when copy does.
 */
import { and, eq } from 'drizzle-orm';
import { promoCodes } from '@/db/schema';
import type { getDb } from '@/db';

export type VoucherInvalidReason =
  | 'not_found'
  | 'inactive'
  | 'expired'
  | 'exhausted'
  | 'wrong_scope';

export interface VoucherValid {
  valid: true;
  /** The canonical `promo_codes` row — caller can proceed to INSERT. */
  row: {
    id: string;
    code: string;
    type: string;
    scope: string;
    grantTier: string | null;
    trialDays: number | null;
    usageLimit: number | null;
    usageCount: number | null;
    expiresAt: Date | null;
  };
  /** Seats left (usageLimit - usageCount). Null if uncapped. */
  remainingSeats: number | null;
}

export interface VoucherInvalid {
  valid: false;
  reason: VoucherInvalidReason;
}

export type VoucherResult = VoucherValid | VoucherInvalid;

/**
 * Look up a voucher by its code (case-insensitive) and validate it
 * against the rules above. Caller supplies the db handle so this
 * module stays testable without a real DB.
 *
 * NB: This function does NOT consume a seat. Callers that are about
 * to perform the sign-up insert must re-check usageCount in the
 * same transaction that inserts the redemption row, or rely on the
 * unique-index on (user_id, code_id) + retry-on-conflict. The
 * read here is for UX feedback and gating, not a race-safe claim.
 */
export async function validateVoucherForRegistration(
  db: ReturnType<typeof getDb>,
  rawCode: string,
): Promise<VoucherResult> {
  const code = rawCode.trim().toUpperCase();

  const rows = await db
    .select({
      id: promoCodes.id,
      code: promoCodes.code,
      type: promoCodes.type,
      scope: promoCodes.scope,
      grantTier: promoCodes.grantTier,
      trialDays: promoCodes.trialDays,
      usageLimit: promoCodes.usageLimit,
      usageCount: promoCodes.usageCount,
      isActive: promoCodes.isActive,
      expiresAt: promoCodes.expiresAt,
    })
    .from(promoCodes)
    .where(eq(promoCodes.code, code))
    .limit(1);

  const row = rows[0];
  if (!row) return { valid: false, reason: 'not_found' };

  // Scope gate — a code authored for in-app tier upgrades MUST NOT be
  // usable to bootstrap a new account. This prevents an operator from
  // accidentally issuing a legacy promo code (scope='upgrade') as a
  // pilot invite and getting a flood of sign-ups through it.
  if (row.scope !== 'registration') {
    return { valid: false, reason: 'wrong_scope' };
  }

  if (!row.isActive) return { valid: false, reason: 'inactive' };

  if (row.expiresAt && new Date() > new Date(row.expiresAt)) {
    return { valid: false, reason: 'expired' };
  }

  const used = row.usageCount ?? 0;
  const limit = row.usageLimit ?? null;
  if (limit !== null && limit > 0 && used >= limit) {
    return { valid: false, reason: 'exhausted' };
  }

  return {
    valid: true,
    row: {
      id: row.id,
      code: row.code,
      type: row.type,
      scope: row.scope,
      grantTier: row.grantTier ?? null,
      trialDays: row.trialDays ?? null,
      usageLimit: row.usageLimit ?? null,
      usageCount: row.usageCount ?? 0,
      expiresAt: row.expiresAt ?? null,
    },
    remainingSeats: limit !== null && limit > 0 ? Math.max(0, limit - used) : null,
  };
}

/**
 * Public, non-sensitive view of a voucher suitable for an unauthenticated
 * GET /api/voucher/check response. Omits internal IDs / notes / usageCount
 * absolutes; returns only what the registration UI needs.
 */
export function toPublicVoucherView(r: VoucherValid): {
  valid: true;
  scope: string;
  remainingSeats: number | null;
  expiresAt: string | null;
  grantTier: string | null;
  trialDays: number | null;
} {
  return {
    valid: true,
    scope: r.row.scope,
    remainingSeats: r.remainingSeats,
    expiresAt: r.row.expiresAt ? r.row.expiresAt.toISOString() : null,
    grantTier: r.row.grantTier,
    trialDays: r.row.trialDays,
  };
}
