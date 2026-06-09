/**
 * GET /api/voucher/check?code=ABC123
 *
 * Read-only voucher validation for the registration UI. Returns:
 *   200 { valid: true, scope, remainingSeats, expiresAt, grantTier, trialDays }
 *   200 { valid: false, reason: 'not_found' | 'inactive' | 'expired' |
 *                                 'exhausted' | 'wrong_scope' }
 *   400 { error: 'Invalid request', fields: {...} }
 *   429 { error: 'Too many requests', retryAfterSeconds }
 *
 * Important: we always return HTTP 200 for both valid=true and valid=false
 * cases. The client branches on the `valid` field, not the status code.
 * This keeps the endpoint uniform for the UI and avoids leaking "this code
 * exists but is exhausted" vs "this code doesn't exist at all" via status
 * code (both are simply `valid: false` with a reason enum).
 *
 * Rate-limited by IP: 30 checks / minute. Plenty for an honest user
 * typing their code once; blocks enumeration attacks that try sequential
 * codes.
 */
import { NextRequest, NextResponse } from 'next/server';
import { jsonResponse } from '@/lib/api-response';
import { getDb } from '@/db';
import { getEnvSafe } from '@/lib/cloudflare';
import { VoucherCheckQuery, zodFailure } from '@/lib/schemas';
import {
  validateVoucherForRegistration,
  toPublicVoucherView,
} from '@/lib/voucher';
import { rateLimit, tooManyResponse } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const rl = await rateLimit(req, {
    routeLabel: 'voucher-check',
    limit: 30,
    windowMs: 60_000,
  });
  if (!rl.allowed) return tooManyResponse(rl);

  const code = req.nextUrl.searchParams.get('code') ?? '';
  const parsed = VoucherCheckQuery.safeParse({ code });
  if (!parsed.success) {
    return jsonResponse(zodFailure(parsed.error), { status: 400 });
  }

  let env;
  try {
    env = await getEnvSafe();
  } catch {
    return jsonResponse({ error: 'Internal server error' }, { status: 500 });
  }

  let db;
  try {
    db = getDb(env);
  } catch {
    return jsonResponse({ error: 'Internal server error' }, { status: 500 });
  }

  const result = await validateVoucherForRegistration(db, parsed.data.code);
  if (!result.valid) {
    return jsonResponse({ valid: false, reason: result.reason });
  }
  return jsonResponse(toPublicVoucherView(result));
}
