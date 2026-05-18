/**
 * Tests for the client-side scan timeout scaling.
 *
 * Background — user-reported bug May 2026:
 *   "เวลาใส่หลายรูป เจอแบบนี้ตลอด" (every multi-photo upload errors).
 *   Screenshot showed the Thai message
 *   "การวิเคราะห์ใช้เวลานานเกินไป กรุณาลองอีกครั้งด้วยรูปที่ชัดกว่านี้"
 *   ("analysis is taking too long, try again with a clearer image")
 *   — the client-side timeout-abort copy, NOT the server's
 *   "AI under high load" 503.
 *
 *   Root cause: client `API_TIMEOUT_MS = 30_000` was tighter than the
 *   server's 45s worst-case budget (Gemini cascade 25s + CF safety-net
 *   20s). Single-photo scans finished well under 30s and never tripped
 *   the wall, masking the mismatch. Multi-photo collages run 18–25s
 *   baseline and routinely exceed 30s when Gemini falls through to
 *   CF, so the client aborted on every multi-photo attempt.
 *
 *   Fix: scale 30s base + 12s per additional photo, cap at 60s.
 *
 * This test parses the formula straight out of the source file so
 * any future contributor who shrinks the cap below the 45s server
 * budget fails CI loudly.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SCAN_HOOK = resolve(__dirname, '../src/hooks/scan/useScanAnalysis.ts');

describe('client-side scan timeout vs server budget', () => {
  const source = readFileSync(SCAN_HOOK, 'utf8');

  it('uses a Math.min cap (not a fixed 30000)', () => {
    // The pre-fix code was `const API_TIMEOUT_MS = 30_000;` — a
    // hardcoded value that ignored photoCount. The fix uses a
    // Math.min/Math.max formula that scales with `uploadedImages.length`.
    // Any future contributor who reverts to the hardcoded form
    // re-introduces the multi-photo abort bug.
    expect(source).not.toMatch(/const\s+API_TIMEOUT_MS\s*=\s*30_000\s*;/);
    expect(source).toMatch(/const\s+API_TIMEOUT_MS\s*=\s*Math\.min\(/);
  });

  it('formula references uploadedImages.length for per-photo scaling', () => {
    // Locking the variable name keeps the formula's intent visible:
    // the timeout scales with the actual photo count the user picked,
    // not a fixed assumption.
    expect(source).toMatch(/uploadedImages\.length/);
  });

  it('cap (60s) is at least 5s above the server cascade budget (45s)', () => {
    // Server cascade budget: Gemini 25s + CF safety-net 20s = 45s
    // (see /api/analyze comments). Client cap must exceed that with
    // headroom — otherwise the abort can race the server's response.
    const match = source.match(/Math\.min\(\s*(\d[\d_]*)\s*,/);
    expect(match).not.toBeNull();
    const cap = Number(match![1].replace(/_/g, ''));
    expect(cap).toBeGreaterThanOrEqual(50_000);
  });

  it('base (single-photo) timeout stays at 30s — preserves fast-fail UX', () => {
    // Single-photo scans typically finish in 7–10s. A 30s wall is
    // tight enough to keep the user from waiting forever on a
    // genuinely-broken request. Pre-fix value was 30_000; the new
    // formula preserves that for `uploadedImages.length === 1`
    // (the Math.max(0, n-1) clamps the extra-photo bonus to 0).
    expect(source).toMatch(/30_000\s*\+\s*Math\.max\(0,\s*uploadedImages\.length\s*-\s*1\)\s*\*\s*12_000/);
  });
});
