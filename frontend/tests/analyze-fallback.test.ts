/**
 * Regression test for the /api/analyze Google vision fallback model.
 *
 * Catches two prior incidents:
 *   - April 2026 (Request ID 7063ch9g): fallback was `gemma-3-27b-it`,
 *     text-only on the free tier. CF-primary outage left users with
 *     nothing because the "vision fallback" couldn't see images.
 *   - May 2026 (Request IDs brxqf5nr / 2s24bp5i): fallback was
 *     `gemini-1.5-flash-latest`. Google retired the `-latest` alias
 *     from `v1beta` (`models/… is not found … or is not supported for
 *     generateContent`, 404). Same outage shape — silent breakage of
 *     the fallback path.
 *
 * Invariants enforced:
 *   1. Model id is in the `gemini-` family (multimodal-capable).
 *   2. Model id is NOT a `gemma` variant (text-only).
 *   3. Model id is NOT a `-latest` alias — aliases get rotated/retired
 *      without notice. Pin to an explicit version.
 *
 * We don't import the route module (Next.js server bindings make that
 * complex in a Vitest run); instead we assert against the committed
 * source.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ANALYZE_ROUTE = resolve(__dirname, '../src/app/api/analyze/route.ts');
const SCAN_PAGE = resolve(__dirname, '../src/app/[locale]/scan/page.tsx');
const AI_PROVIDERS = resolve(__dirname, '../src/lib/ai-providers.ts');

describe('analyze fallback — vision-capable model', () => {
  it('uses a Gemini multimodal, non-alias model in attemptGoogleInference', () => {
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

    // Must NOT be a text-only Gemma variant (April 2026 incident).
    expect(model).not.toMatch(/gemma/i);

    // Must NOT be a `-latest` alias — Google retired
    // `gemini-1.5-flash-latest` from v1beta in May 2026 without notice.
    // Pin to an explicit, dated model id.
    expect(model).not.toMatch(/-latest$/);
  });

  it('passes the correct google-gemini-* identifier as `usedModel`', () => {
    const source = readFileSync(ANALYZE_ROUTE, 'utf8');
    expect(source).toContain("'google-gemini-2.0-flash'");
    // No stale references to retired identifiers.
    expect(source).not.toContain("'google-gemma-3-27b'");
    expect(source).not.toContain("'google-gemini-1.5-flash'");
  });

  it('scan page displays the correct human-readable model name', () => {
    const source = readFileSync(SCAN_PAGE, 'utf8');
    // The "analyzed by" footer must reference the new identifier
    // string AND the human-readable name. Both occurrences (mobile +
    // desktop) get caught by the unconditional substring check.
    expect(source).toContain("'google-gemini-2.0-flash'");
    expect(source).toContain('Gemini 2.0 Flash');
    expect(source).not.toContain("'google-gemma-3-27b'");
    expect(source).not.toContain("'google-gemini-1.5-flash'");
    // Old display names — ensure no orphan UI.
    expect(source).not.toContain('Gemma 3 27B');
    expect(source).not.toContain('Gemini 1.5 Flash');
  });

  it('chat cascade (lib/ai-providers) uses the same non-alias Gemini id', () => {
    // Both the scan fallback and the chat cascade hit the same Google
    // key — keeping them on the same explicit model id avoids the
    // situation where chat keeps working (because Groq answers first)
    // while scan silently breaks (because CF primary failed and the
    // Gemini fallback resolves to a retired alias).
    const source = readFileSync(AI_PROVIDERS, 'utf8');

    // Strip block + line comments so historical references in
    // docstrings (e.g. "Google retired gemini-1.5-flash-latest in May
    // 2026 …") don't trip the live-code invariants below.
    const code = source
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/[^\n]*/g, '');

    // Live code must reference the new model id …
    expect(code).toContain('gemini-2.0-flash');
    // … must NOT call the retired alias …
    expect(code).not.toContain('gemini-1.5-flash-latest');
    // … and must NOT use any `-latest` alias for any Gemini variant.
    expect(code).not.toMatch(/gemini-[\w.-]*-latest/);
  });
});
