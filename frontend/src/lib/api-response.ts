/**
 * Shared JSON-response helper for /api/* routes.
 *
 * Every API surface here is personalized, dynamic, or carries
 * per-request identifiers (request IDs, session-tied user records,
 * zod failure shapes). None of those should ever be stored by an
 * intermediate cache, but Next.js's `NextResponse.json()` doesn't
 * set `Cache-Control` by default — and bug-hunt May 2026 caught
 * that omission: every route except `/api/health` (which explicitly
 * sets the header) was returning responses with no
 * `Cache-Control` at all.
 *
 * Cloudflare's edge cache happens not to cache cookie-bearing
 * responses by default, so the real-world blast radius was small,
 * but relying on that is fragile and varies by edge-cache
 * configuration. Explicit `no-store` is the contract.
 *
 * Usage:
 *   return jsonResponse({ user }, { status: 200 });
 *   return jsonResponse({ error: 'Not authenticated' }, { status: 401 });
 *
 * To add response-specific headers, merge them in — `Cache-Control`
 * stays `no-store` because the helper's header comes first:
 *   return jsonResponse(body, {
 *     status: 200,
 *     headers: { 'X-Trace-Id': traceId },
 *   });
 *
 * If a route genuinely needs cacheable JSON (none today; image URLs
 * and static metadata go through other surfaces), use NextResponse.json
 * directly — opting out of `no-store` should be visible at the call
 * site, not implicit.
 */
import { NextResponse } from 'next/server';

export interface JsonResponseInit {
  status?: number;
  headers?: Record<string, string>;
}

export function jsonResponse(body: unknown, init?: JsonResponseInit): NextResponse {
  return NextResponse.json(body, {
    status: init?.status,
    headers: {
      'Cache-Control': 'no-store',
      ...(init?.headers ?? {}),
    },
  });
}
