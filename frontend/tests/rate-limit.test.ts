/**
 * Tests for lib/rate-limit.ts.
 *
 * Goals (in priority order):
 *   1. Prove the limiter NEVER throws — auth/scan/voucher routes call
 *      it BEFORE their try/catch, so any uncaught throw here surfaces
 *      as the framework's default 500 page. Every code path must end
 *      with a returned RateLimitResult.
 *   2. Prove the limit actually engages: after `limit` requests within
 *      `windowMs`, subsequent requests from the same client must
 *      return `allowed: false`. Bug-hunt May 2026 caught the previous
 *      implementation silently fail-open in production (40 parallel
 *      voucher probes against a 30/min limit all returned 200) because
 *      `caches.default` in the OpenNext-on-Pages runtime didn't
 *      persist between requests. The current implementation uses a
 *      module-scoped Map as primary store, which always works.
 *
 * Each test resets the in-memory store via `_resetForTest` so suites
 * don't bleed state between cases.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { rateLimit, clientKey, tooManyResponse, _resetForTest } from '@/lib/rate-limit';

beforeEach(() => {
  _resetForTest();
});

function mkReq(headers: Record<string, string> = {}): Request {
  return new Request('https://example.com/x', {
    method: 'POST',
    headers,
  });
}

// ---------------------------------------------------------------------------
// rateLimit fail-open contract
// ---------------------------------------------------------------------------
describe('rateLimit — fail-open contract (must never throw)', () => {
  it('does not throw with a vanilla Node Request', async () => {
    const result = await rateLimit(mkReq(), {
      routeLabel: 'auth-login',
      limit: 10,
      windowMs: 15 * 60_000,
    });
    expect(result.allowed).toBe(true);
    expect(result.limit).toBe(10);
  });

  it('does not throw when headers are weird (empty)', async () => {
    const result = await rateLimit(mkReq({}), {
      routeLabel: 'voucher-check',
      limit: 30,
      windowMs: 60_000,
    });
    expect(result.allowed).toBe(true);
  });

  it('does not throw when cf-connecting-ip is present', async () => {
    const result = await rateLimit(
      mkReq({ 'cf-connecting-ip': '203.0.113.42' }),
      { routeLabel: 'auth-register', limit: 3, windowMs: 15 * 60_000 },
    );
    expect(result.allowed).toBe(true);
  });

  it('returns a stable RateLimitResult shape', async () => {
    const result = await rateLimit(mkReq(), {
      routeLabel: 't',
      limit: 5,
      windowMs: 1000,
    });
    expect(result).toMatchObject({
      allowed: expect.any(Boolean),
      count: expect.any(Number),
      limit: expect.any(Number),
      retryAfterSeconds: expect.any(Number),
    });
  });
});

// ---------------------------------------------------------------------------
// rateLimit enforcement — the limit must actually engage
// ---------------------------------------------------------------------------
describe('rateLimit — enforcement', () => {
  it('blocks the (limit+1)th request from the same IP within the window', async () => {
    // Bug-hunt May 2026: prior implementation used `caches.default` as
    // primary store. In the OpenNext-on-Pages runtime that doesn't
    // give same-millisecond read-after-write consistency, so 40
    // parallel probes against a 30/min limit all returned `allowed:true`
    // — silently fail-open. The current Map-backed primary fixes this.
    const headers = { 'cf-connecting-ip': '203.0.113.99' };
    const opts = { routeLabel: 'auth-login', limit: 3, windowMs: 60_000 };

    for (let i = 0; i < 3; i++) {
      const r = await rateLimit(mkReq(headers), opts);
      expect(r.allowed).toBe(true);
    }
    // 4th request must trip
    const fourth = await rateLimit(mkReq(headers), opts);
    expect(fourth.allowed).toBe(false);
    expect(fourth.retryAfterSeconds).toBeGreaterThan(0);
    expect(fourth.limit).toBe(3);
  });

  it('does not bleed buckets across distinct IPs', async () => {
    const opts = { routeLabel: 'voucher-check', limit: 2, windowMs: 60_000 };
    // Exhaust IP A
    await rateLimit(mkReq({ 'cf-connecting-ip': '198.51.100.1' }), opts);
    await rateLimit(mkReq({ 'cf-connecting-ip': '198.51.100.1' }), opts);
    const aBlocked = await rateLimit(mkReq({ 'cf-connecting-ip': '198.51.100.1' }), opts);
    expect(aBlocked.allowed).toBe(false);
    // IP B is fresh
    const bAllowed = await rateLimit(mkReq({ 'cf-connecting-ip': '198.51.100.2' }), opts);
    expect(bAllowed.allowed).toBe(true);
  });

  it('does not bleed buckets across distinct routeLabels', async () => {
    const headers = { 'cf-connecting-ip': '203.0.113.50' };
    // Exhaust route A
    await rateLimit(mkReq(headers), { routeLabel: 'A', limit: 1, windowMs: 60_000 });
    const aBlocked = await rateLimit(mkReq(headers), { routeLabel: 'A', limit: 1, windowMs: 60_000 });
    expect(aBlocked.allowed).toBe(false);
    // Route B is fresh
    const bAllowed = await rateLimit(mkReq(headers), { routeLabel: 'B', limit: 1, windowMs: 60_000 });
    expect(bAllowed.allowed).toBe(true);
  });

  it('blocked request does not increment further (no DoS-by-flood extending the window)', async () => {
    const headers = { 'cf-connecting-ip': '203.0.113.77' };
    const opts = { routeLabel: 'voucher-check', limit: 2, windowMs: 60_000 };
    await rateLimit(mkReq(headers), opts);
    await rateLimit(mkReq(headers), opts);
    // Three more rejected attempts in a row
    const r1 = await rateLimit(mkReq(headers), opts);
    const r2 = await rateLimit(mkReq(headers), opts);
    const r3 = await rateLimit(mkReq(headers), opts);
    expect(r1.allowed).toBe(false);
    expect(r2.allowed).toBe(false);
    expect(r3.allowed).toBe(false);
    // count must stay equal to limit, not grow unbounded.
    expect(r3.count).toBe(opts.limit);
  });

  it('treats unrelated requests with no IP header as one shared "anon" bucket', async () => {
    // Defensive — if no IP signal exists, every request lands in the
    // same bucket. Better to have *some* throttle on the unknown
    // surface than to grant unlimited.
    const opts = { routeLabel: 'auth-login', limit: 1, windowMs: 60_000 };
    const first = await rateLimit(mkReq(), opts);
    const second = await rateLimit(mkReq(), opts);
    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// clientKey edge cases — must never throw
// ---------------------------------------------------------------------------
describe('clientKey', () => {
  it('uses cf-connecting-ip when present', () => {
    const k = clientKey(mkReq({ 'cf-connecting-ip': '198.51.100.7' }), 'auth-login');
    expect(k).toBe('ratelimit:auth-login:198.51.100.7');
  });

  it('falls back to first hop of x-forwarded-for', () => {
    const k = clientKey(
      mkReq({ 'x-forwarded-for': '198.51.100.1, 10.0.0.1' }),
      'auth-login',
    );
    expect(k).toBe('ratelimit:auth-login:198.51.100.1');
  });

  it('returns "anon" bucket when no IP header is present', () => {
    const k = clientKey(mkReq({}), 'auth-login');
    expect(k).toBe('ratelimit:auth-login:anon');
  });

  it('prefers cf-connecting-ip over x-forwarded-for when both are present', () => {
    // Behind Cloudflare, `cf-connecting-ip` is the trusted real-client
    // IP set by CF's edge; `x-forwarded-for` is whatever the upstream
    // proxy chain sends. If both are present the CF-set value wins —
    // an attacker who controls the XFF chain otherwise gets to pick
    // their own per-IP rate-limit bucket.
    const k = clientKey(
      mkReq({
        'cf-connecting-ip': '203.0.113.1',
        'x-forwarded-for': '198.51.100.1, 10.0.0.1',
      }),
      'auth-login',
    );
    expect(k).toBe('ratelimit:auth-login:203.0.113.1');
  });

  it('does not throw when req.headers is missing', () => {
    // Force the missing-headers path. The limiter must survive this.
    const fake = { headers: undefined } as unknown as Request;
    expect(() => clientKey(fake, 'voucher-check')).not.toThrow();
    expect(clientKey(fake, 'voucher-check')).toBe('ratelimit:voucher-check:anon');
  });
});

// ---------------------------------------------------------------------------
// tooManyResponse — shape check
// ---------------------------------------------------------------------------
describe('tooManyResponse', () => {
  it('returns a 429 with retry-after header', async () => {
    const res = tooManyResponse({
      allowed: false,
      count: 999,
      limit: 10,
      retryAfterSeconds: 42,
    });
    expect(res.status).toBe(429);
    expect(res.headers.get('retry-after')).toBe('42');
    expect(res.headers.get('x-ratelimit-limit')).toBe('10');
    const body = await res.json();
    expect(body.error).toBe('Too many requests');
    expect(body.retryAfterSeconds).toBe(42);
  });

  it('sets cache-control: no-store on 429 responses', () => {
    // Round 5 e2e caught that 429 responses were missing
    // `cache-control: no-store` — every other /api/* response sets
    // it via `jsonResponse`, but `tooManyResponse` bypasses that
    // helper because rate-limit runs before the route's main
    // try/catch. The same "personalised, never cache" contract still
    // applies. Locking it here so a future contributor who copies
    // tooManyResponse for a new error type doesn't drop the header.
    const res = tooManyResponse({ allowed: false, count: 5, limit: 3, retryAfterSeconds: 10 });
    expect(res.headers.get('cache-control')).toBe('no-store');
  });
});
