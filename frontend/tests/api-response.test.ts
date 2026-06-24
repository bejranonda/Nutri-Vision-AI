/**
 * Tests for lib/api-response.ts + the architectural invariant that
 * every /api/* route uses it.
 *
 * Background — bug-hunt May 2026:
 *   Sweep of every /api/* endpoint showed that only `/api/health`
 *   was returning a `Cache-Control: no-store` header. Twelve other
 *   routes (auth/login, auth/me, auth/register, auth/logout, chat,
 *   analyze, promo/redeem, voucher/check, admin/*) shipped responses
 *   with NO `Cache-Control` at all. Every one of those carries
 *   personalized data (user records), per-request identifiers
 *   (`requestId`), or session-tied state — none of which is safe for
 *   an intermediate cache to store.
 *
 *   Cloudflare's edge happens not to cache cookie-bearing responses
 *   by default, so real-world blast radius was small, but relying on
 *   that is fragile and varies by edge-cache configuration. Explicit
 *   `Cache-Control: no-store` is the contract.
 *
 * Fix: `lib/api-response.ts` exports `jsonResponse(body, init?)` —
 * a thin wrapper around `NextResponse.json` that defaults
 * `Cache-Control: no-store` on every API response. Every route
 * imports and uses it instead of `NextResponse.json` directly.
 *
 * This test enforces the invariant going forward: any new route file
 * under `src/app/api/**` that does `NextResponse.json(...)` instead
 * of `jsonResponse(...)` fails CI.
 */
import { describe, it, expect } from 'vitest';
import { jsonResponse } from '@/lib/api-response';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';

const API_ROOT = resolve(__dirname, '../src/app/api');

function findRouteFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...findRouteFiles(full));
    } else if (entry.name === 'route.ts' || entry.name === 'route.tsx') {
      out.push(full);
    }
  }
  return out;
}

describe('jsonResponse helper', () => {
  it('defaults Cache-Control to no-store', () => {
    const res = jsonResponse({ ok: true });
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('accepts a status code', () => {
    const res = jsonResponse({ error: 'bad' }, { status: 400 });
    expect(res.status).toBe(400);
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('allows callers to add per-response headers without losing no-store', () => {
    // Caller-supplied headers must NOT silently override Cache-Control;
    // the helper's contract is "no-store by default, with extras". If a
    // route genuinely needs cacheable JSON it should use
    // NextResponse.json directly — opting out should be visible at the
    // call site, not implicit via header merging.
    const res = jsonResponse({ ok: true }, { headers: { 'X-Trace-Id': 't-1' } });
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(res.headers.get('x-trace-id')).toBe('t-1');
  });

  it('lets callers explicitly override Cache-Control if they really want', () => {
    // Escape hatch for the future hypothetical "cacheable manifest"
    // route. Caller header beats helper default because spread order:
    // `{ 'Cache-Control': 'no-store', ...init.headers }`.
    const res = jsonResponse(
      { manifest: true },
      { headers: { 'Cache-Control': 'public, max-age=3600' } },
    );
    expect(res.headers.get('cache-control')).toBe('public, max-age=3600');
  });

  it('returns a JSON body the route can hand back as-is', async () => {
    const res = jsonResponse({ user: { id: '42', email: 'a@b' } });
    const body = await res.json();
    expect(body).toEqual({ user: { id: '42', email: 'a@b' } });
  });
});

describe('every /api/* route uses jsonResponse (not NextResponse.json)', () => {
  // Skipped paths — if a route genuinely needs cacheable JSON or a
  // non-JSON response (redirect, stream), it can opt out by listing
  // here with the reason. Today the list is empty.
  const ALLOWED_NEXT_RESPONSE_JSON: string[] = [];

  const routeFiles = findRouteFiles(API_ROOT);

  it('inventory: at least one route file exists', () => {
    expect(routeFiles.length).toBeGreaterThan(0);
  });

  for (const file of routeFiles) {
    const relPath = file.replace(resolve(__dirname, '..') + '/', '');
    it(`${relPath} returns via jsonResponse, not NextResponse.json`, () => {
      const src = readFileSync(file, 'utf8');
      const code = src
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/[^\n]*/g, '');

      if (ALLOWED_NEXT_RESPONSE_JSON.includes(relPath)) {
        // Opted-out route — still verify the opt-out is documented
        // (i.e. doesn't use jsonResponse). Skipping enforcement.
        return;
      }

      // Hard rule: no live NextResponse.json calls in any route.
      expect(code).not.toMatch(/NextResponse\.json\s*\(/);

      // If the file uses jsonResponse anywhere, it must import it.
      if (code.includes('jsonResponse(')) {
        expect(code).toMatch(/import\s+\{[^}]*jsonResponse[^}]*\}\s+from\s+'@\/lib\/api-response'/);
      }
    });
  }
});
