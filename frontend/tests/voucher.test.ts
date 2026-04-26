/**
 * Unit tests for lib/voucher.ts (the registration-voucher validator).
 *
 * Mirrors the strategy from admin-auth.test.ts: we mock Drizzle's
 * fluent builder (.select().from().where().limit()) to return a
 * canned row set, then assert on the validator's behaviour for each
 * documented invalid-reason path.
 *
 * The five reasons we cover:
 *   - not_found    — no row returned by the lookup
 *   - wrong_scope  — row exists but scope='upgrade'
 *   - inactive     — isActive=false
 *   - expired      — expiresAt < now
 *   - exhausted    — usageCount >= usageLimit
 *
 * Plus the happy path (valid=true with remainingSeats and toPublicVoucherView).
 */
import { describe, it, expect } from 'vitest';
import {
  validateVoucherForRegistration,
  toPublicVoucherView,
} from '@/lib/voucher';

// Build a fake `db` whose .select().from().where().limit() resolves
// to the supplied rows. Matches Drizzle's chainable shape closely
// enough for unit tests without spinning up SQLite.
function mkDb(rows: any[]) {
  return {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve(rows),
        }),
      }),
    }),
  } as any;
}

const baseRow = {
  id: 'v1',
  code: 'PILOT-AAAA',
  type: 'TRIAL',
  scope: 'registration',
  grantTier: 'premium',
  trialDays: 30,
  usageLimit: 50,
  usageCount: 0,
  isActive: true,
  expiresAt: null,
};

// ---------------------------------------------------------------------------
// Invalid paths
// ---------------------------------------------------------------------------
describe('validateVoucherForRegistration — invalid paths', () => {
  it('reason=not_found when lookup returns no row', async () => {
    const r = await validateVoucherForRegistration(mkDb([]), 'NOPE');
    expect(r).toEqual({ valid: false, reason: 'not_found' });
  });

  it('reason=wrong_scope when scope is "upgrade"', async () => {
    const r = await validateVoucherForRegistration(
      mkDb([{ ...baseRow, scope: 'upgrade' }]),
      'PROMO',
    );
    expect(r).toEqual({ valid: false, reason: 'wrong_scope' });
  });

  it('reason=inactive when isActive is false', async () => {
    const r = await validateVoucherForRegistration(
      mkDb([{ ...baseRow, isActive: false }]),
      'PILOT-AAAA',
    );
    expect(r).toEqual({ valid: false, reason: 'inactive' });
  });

  it('reason=expired when expiresAt is in the past', async () => {
    const yesterday = new Date(Date.now() - 24 * 3600 * 1000);
    const r = await validateVoucherForRegistration(
      mkDb([{ ...baseRow, expiresAt: yesterday }]),
      'PILOT-AAAA',
    );
    expect(r).toEqual({ valid: false, reason: 'expired' });
  });

  it('reason=exhausted when usageCount >= usageLimit', async () => {
    const r = await validateVoucherForRegistration(
      mkDb([{ ...baseRow, usageLimit: 5, usageCount: 5 }]),
      'PILOT-AAAA',
    );
    expect(r).toEqual({ valid: false, reason: 'exhausted' });
  });

  it('still valid when usageCount = usageLimit - 1 (boundary)', async () => {
    const r = await validateVoucherForRegistration(
      mkDb([{ ...baseRow, usageLimit: 5, usageCount: 4 }]),
      'PILOT-AAAA',
    );
    expect(r.valid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Valid path
// ---------------------------------------------------------------------------
describe('validateVoucherForRegistration — valid path', () => {
  it('returns the row + remainingSeats', async () => {
    const tomorrow = new Date(Date.now() + 24 * 3600 * 1000);
    const r = await validateVoucherForRegistration(
      mkDb([
        { ...baseRow, expiresAt: tomorrow, usageLimit: 100, usageCount: 25 },
      ]),
      'PILOT-AAAA',
    );
    expect(r.valid).toBe(true);
    if (r.valid) {
      expect(r.remainingSeats).toBe(75);
      expect(r.row.code).toBe('PILOT-AAAA');
      expect(r.row.scope).toBe('registration');
      expect(r.row.grantTier).toBe('premium');
      expect(r.row.trialDays).toBe(30);
    }
  });

  it('uppercases the code before lookup (case-insensitive lookup)', async () => {
    // The mock ignores the `where` filter, but we assert the function
    // doesn't crash when given lowercase input (it normalises before
    // the lookup; mock returns the row regardless).
    const r = await validateVoucherForRegistration(
      mkDb([baseRow]),
      'pilot-aaaa',
    );
    expect(r.valid).toBe(true);
  });

  it('treats null/0 usageLimit as uncapped (remainingSeats=null)', async () => {
    const r = await validateVoucherForRegistration(
      mkDb([{ ...baseRow, usageLimit: null, usageCount: 99999 }]),
      'PILOT-AAAA',
    );
    expect(r.valid).toBe(true);
    if (r.valid) expect(r.remainingSeats).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// toPublicVoucherView
// ---------------------------------------------------------------------------
describe('toPublicVoucherView', () => {
  it('does not leak internal IDs / usageCount', async () => {
    const r = await validateVoucherForRegistration(
      mkDb([{ ...baseRow, usageLimit: 50, usageCount: 12 }]),
      'PILOT-AAAA',
    );
    expect(r.valid).toBe(true);
    if (r.valid) {
      const pub = toPublicVoucherView(r);
      expect(pub).toEqual({
        valid: true,
        scope: 'registration',
        remainingSeats: 38,
        expiresAt: null,
        grantTier: 'premium',
        trialDays: 30,
      });
      expect(pub).not.toHaveProperty('id');
      expect(pub).not.toHaveProperty('usageCount');
      expect(pub).not.toHaveProperty('notes');
    }
  });
});
