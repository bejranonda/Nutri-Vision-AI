/**
 * Regression test for the /api/analyze Google vision fallback model.
 *
 * Catches: a future contributor who silently swaps the fallback model
 * back to a text-only Gemma variant, leaving the route with no working
 * vision fallback. The April 2026 production incident report ("scan
 * 503 Internal server error" with Request ID 7063ch9g) was caused by
 * exactly this — `gemma-3-27b-it` couldn't process images on the free
 * tier, so a CF-primary outage left users with nothing.
 *
 * We don't import the route module (Next.js server bindings make that
 * complex in a Vitest run); instead we assert against the committed
 * source. A regex check is sufficient — the relevant invariants are
 * "the model identifier is in the gemini family" and "the model
 * identifier is NOT a known text-only Gemma variant".
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ANALYZE_ROUTE = resolve(__dirname, '../src/app/api/analyze/route.ts');
const SCAN_PAGE = resolve(__dirname, '../src/app/[locale]/scan/page.tsx');

describe('analyze fallback — vision-capable model', () => {
  it('uses a Gemini multimodal model in attemptGoogleInference', () => {
    const source = readFileSync(ANALYZE_ROUTE, 'utf8');
    // The single source-of-truth assignment lives at:
    //   const model = '<id>';
    // inside attemptGoogleInference. Pick out that exact line.
    const match = source.match(/const model = '([^']+)';/);
    expect(match).not.toBeNull();
    const model = match![1];

    // Must be a Gemini family model — those support multimodal on the
    // free tier reliably.
    expect(model).toMatch(/^gemini-/);

    // Must NOT be a text-only Gemma variant. This is the regression
    // guard — the April 2026 incident swapped this to gemma-3-27b-it
    // which is text-only.
    expect(model).not.toMatch(/gemma/i);
  });

  it('passes the correct google-gemini-* identifier as `usedModel`', () => {
    const source = readFileSync(ANALYZE_ROUTE, 'utf8');
    expect(source).toContain("'google-gemini-1.5-flash'");
    // No stale references to the old gemma identifier.
    expect(source).not.toContain("'google-gemma-3-27b'");
  });

  it('scan page displays the correct human-readable model name', () => {
    const source = readFileSync(SCAN_PAGE, 'utf8');
    // The "analyzed by" footer must reference the new identifier
    // string AND the human-readable name. Both occurrences (mobile +
    // desktop) get caught by the unconditional substring check.
    expect(source).toContain("'google-gemini-1.5-flash'");
    expect(source).toContain('Gemini 1.5 Flash');
    expect(source).not.toContain("'google-gemma-3-27b'");
    // 'Gemma 3 27B' was the old display name; ensure no orphan UI.
    expect(source).not.toContain('Gemma 3 27B');
  });
});
