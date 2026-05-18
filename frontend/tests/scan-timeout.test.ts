/**
 * Tests for the client-side scan timeout scaling.
 *
 * Background — user-reported bugs:
 *   1. May 2026 (multi-photo): "เวลาใส่หลายรูป เจอแบบนี้ตลอด" — every
 *      multi-photo upload aborted. Root cause: client
 *      `API_TIMEOUT_MS = 30_000` was tighter than the server's 45s
 *      worst-case budget (Gemini cascade 25s + CF safety-net 20s).
 *      Fix: scale by photo count.
 *
 *   2. May 2026 (single-photo): screenshot at /th/scan showed the same
 *      Thai abort copy "การวิเคราะห์ใช้เวลานานเกินไป..." on a
 *      ONE-photo upload. The 30s single-photo base wasn't enough
 *      headroom — when Gemini cascade falls through to CF safety-net,
 *      a single-photo scan can hit the full 45s server budget too.
 *      Fix: bump the base from 30s → 50s (matches multi-photo headroom).
 *
 * Current formula: 50s base + 8s per additional photo, cap at 75s.
 * This test parses it straight out of the source file so any future
 * contributor who shrinks the cap below the 45s server budget or
 * reverts the single-photo base fails CI loudly.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SCAN_HOOK = resolve(__dirname, '../src/hooks/scan/useScanAnalysis.ts');

describe('client-side scan timeout vs server budget', () => {
  const source = readFileSync(SCAN_HOOK, 'utf8');

  it('uses a Math.min cap (not a hardcoded value)', () => {
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

  it('cap is at least 5s above the server cascade budget (45s)', () => {
    // Server cascade budget: Gemini 25s + CF safety-net 20s = 45s
    // (see /api/analyze comments). Client cap must exceed that with
    // headroom — otherwise the abort can race the server's response.
    const match = source.match(/Math\.min\(\s*(\d[\d_]*)\s*,/);
    expect(match).not.toBeNull();
    const cap = Number(match![1].replace(/_/g, ''));
    expect(cap).toBeGreaterThanOrEqual(50_000);
  });

  it('base (single-photo) timeout is at least 5s above server budget (45s)', () => {
    // The pre-PR base was 30s — too tight when Gemini cascade falls
    // through to the CF safety-net on a slow upstream. User-reported
    // May 2026: a single-photo upload aborted with the Thai timeout
    // copy. The base must give single-photo scans at least 5s
    // headroom above the 45s server budget too. Current formula
    // uses 50s base.
    const match = source.match(/(\d[\d_]*)\s*\+\s*Math\.max\(0,\s*uploadedImages\.length\s*-\s*1\)\s*\*\s*(\d[\d_]*)/);
    expect(match).not.toBeNull();
    const base = Number(match![1].replace(/_/g, ''));
    expect(base).toBeGreaterThanOrEqual(50_000);
  });
});
