/**
 * Tests for lib/rate-limit.ts.
 *
 * Goal: prove the limiter NEVER throws — that's the contract it makes
 * with the auth/scan/voucher routes. The limiter is called BEFORE the
 * route's try/catch (so the route can return a 429 directly without
 * hitting expensive work), so a thrown error here surfaces as the
 * framework's default 500 page. Every code path through rateLimit()
 * must end with a returned RateLimitResult, not an uncaught throw.
 *
 * We can't easily simulate `caches.default` in Vitest's Node env, but
 * we don't need to — the contract is "if anything goes wrong, return
 * allowed:true". Vitest happens to be one of those "anything goes
 * wrong" environments (no `caches` global), which is exactly the
 * surface we want to verify.
 */
import { describe, it, expect } from 'vitest';
import { rateLimit, clientKey, tooManyResponse } from '@/lib/rate-limit';

function mkReq(headers: Record<string, string> = {}): Request {
  return new Request('https://example.com/x', {
    method: 'POST',
    headers,
  });
}

// ---------------------------------------------------------------------------
// rateLimit fail-open contract
// ---------------------------------------------------------------------------
describe('rateLimit', () => {
  it('does not throw when caches.default is unavailable (Node test env)', async () => {
    // No `caches` global in Vitest — the limiter must still resolve.
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

  it('uses cf-connecting-ip when present (does not fall back)', async () => {
    // We can't observe the bucket key directly, but we can verify the
    // route doesn't 500 with a realistic CF header.
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
});
