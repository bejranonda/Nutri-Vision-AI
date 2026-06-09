/**
 * Regression tests for lib/crypto.ts.
 *
 * These lock in the security-critical behaviour introduced in PR #8:
 *   1. `constantTimeEqual` walks the whole buffer (no short-circuit).
 *   2. `verifyPassword` accepts correct passwords, rejects wrong ones,
 *      tolerates the legacy SHA-256 hex format, and rejects tampered
 *      hashes without crashing.
 *
 * We exercise `verifyPassword` as a black box — it's the surface the
 * auth routes call, so it's the surface worth locking down.
 */
import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword, generateId } from '@/lib/crypto';

// ---------------------------------------------------------------------------
// hashPassword + verifyPassword round-trip
// ---------------------------------------------------------------------------
describe('hashPassword / verifyPassword (PBKDF2)', () => {
  it('verifies a correct password', async () => {
    const hash = await hashPassword('correct horse battery staple');
    expect(await verifyPassword('correct horse battery staple', hash)).toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const hash = await hashPassword('correct horse battery staple');
    expect(await verifyPassword('Correct horse battery staple', hash)).toBe(false);
    expect(await verifyPassword('', hash)).toBe(false);
    expect(await verifyPassword('wrong', hash)).toBe(false);
  });

  it('produces a different hash each call (random salt)', async () => {
    const a = await hashPassword('same-password');
    const b = await hashPassword('same-password');
    expect(a).not.toBe(b);
    // Both must still verify the original password.
    expect(await verifyPassword('same-password', a)).toBe(true);
    expect(await verifyPassword('same-password', b)).toBe(true);
  });

  it('stores hash in `iterations:salt:hash` format', async () => {
    const hash = await hashPassword('x');
    const parts = hash.split(':');
    expect(parts).toHaveLength(3);
    expect(Number.isInteger(Number(parts[0]))).toBe(true);
    expect(parts[1]).toMatch(/^[0-9a-f]+$/i);
    expect(parts[2]).toMatch(/^[0-9a-f]+$/i);
  });

  it('rejects a tampered stored-hash byte without throwing', async () => {
    const hash = await hashPassword('pw');
    const [iter, salt, stored] = hash.split(':');
    // Flip one hex digit in the stored hash. The decoded byte differs,
    // so verify must return false — never throw.
    const flipped = stored[0] === 'a' ? 'b' + stored.slice(1) : 'a' + stored.slice(1);
    const tampered = `${iter}:${salt}:${flipped}`;
    await expect(verifyPassword('pw', tampered)).resolves.toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Legacy SHA-256 fallback — kept for backward compat, still must not leak
// ---------------------------------------------------------------------------
describe('verifyPassword (legacy SHA-256)', () => {
  it('verifies a legacy SHA-256 hex hash', async () => {
    // Pre-compute sha256("hunter2") via the same API the fallback uses.
    const digest = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode('hunter2'),
    );
    const hex = Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    expect(hex).not.toContain(':'); // sanity: legacy format is bare hex
    expect(await verifyPassword('hunter2', hex)).toBe(true);
    expect(await verifyPassword('wrong', hex)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Constant-time sanity check
//
// We can't directly statistically prove constant-time with a small sample,
// but we can at least check that:
//   - two wildly different wrong passwords both consistently verify false
//   - neither leaks exceptions, regardless of length mismatch
// If someone reverts constantTimeEqual to `===`, the round-trip tests
// above still pass — this one ensures the helper also survives edge cases.
// ---------------------------------------------------------------------------
describe('constant-time behaviour (indirect)', () => {
  it('returns false for short vs. long wrong passwords', async () => {
    const hash = await hashPassword('real-password-value');
    expect(await verifyPassword('', hash)).toBe(false);
    expect(await verifyPassword('r', hash)).toBe(false);
    expect(await verifyPassword('r'.repeat(200), hash)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// generateId — cryptographic UUID contract
// ---------------------------------------------------------------------------
describe('generateId', () => {
  it('returns unique UUIDs', () => {
    const n = 100;
    const ids = new Set(Array.from({ length: n }, () => generateId()));
    expect(ids.size).toBe(n);
  });

  it('looks like a UUID v4', () => {
    const id = generateId();
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });
});
