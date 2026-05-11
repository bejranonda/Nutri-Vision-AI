/**
 * Regression test for the /api/analyze Google vision fallback model
 * cascade.
 *
 * Catches three prior incidents (each one variation on "the fallback
 * structurally couldn't see images"):
 *   - April 2026 (Request ID 7063ch9g): fallback was `gemma-3-27b-it`,
 *     text-only on the free tier. CF-primary outage left users with
 *     nothing because the "vision fallback" couldn't see images.
 *   - May 2026 (Request IDs brxqf5nr / 2s24bp5i): fallback was
 *     `gemini-1.5-flash-latest`. Google retired the `-latest` alias
 *     from `v1beta` (`models/… is not found … or is not supported for
 *     generateContent`, 404). Same outage shape.
 *   - May 2026 (Request IDs tqunrejp / fz64f4uh): fallback was a single
 *     hardcoded `gemini-2.0-flash`. Google silently dropped this
 *     project's free-tier quota for that exact model to `limit: 0`,
 *     even though `gemini-2.5-flash` on the same key still had quota.
 *     Fixed by walking a cascade in `GEMINI_VISION_MODELS`.
 *
 * Invariants enforced:
 *   1. `GEMINI_VISION_MODELS` is exported from `lib/ai-providers.ts`,
 *      is non-empty, and every entry is a `gemini-` family model.
 *   2. No entry is a `gemma` variant (text-only).
 *   3. No entry is a `-latest` alias — aliases get rotated/retired
 *      without notice. Pin to explicit version ids.
 *   4. The route uses the cascade (imports the constant + iterates) —
 *      no single hardcoded model id is allowed.
 *   5. The scan page renders any `google-gemini-*` model name without
 *      the previous one-id-at-a-time check.
 *
 * We don't import the route module (Next.js server bindings make that
 * complex in a Vitest run); instead we assert against the committed
 * source.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { GEMINI_VISION_MODELS } from '../src/lib/ai-providers';

const ANALYZE_ROUTE = resolve(__dirname, '../src/app/api/analyze/route.ts');
const SCAN_PAGE = resolve(__dirname, '../src/app/[locale]/scan/page.tsx');
const AI_PROVIDERS = resolve(__dirname, '../src/lib/ai-providers.ts');

describe('analyze fallback — Gemini vision cascade', () => {
  it('GEMINI_VISION_MODELS cascade satisfies all invariants', () => {
    expect(GEMINI_VISION_MODELS.length).toBeGreaterThan(0);
    for (const model of GEMINI_VISION_MODELS) {
      // Must be a Gemini family model — those support multimodal on the
      // free tier reliably.
      expect(model).toMatch(/^gemini-/);
      // Must NOT be a text-only Gemma variant (April 2026 incident).
      expect(model).not.toMatch(/gemma/i);
      // Must NOT be a `-latest` alias — Google retired
      // `gemini-1.5-flash-latest` from v1beta in May 2026 without
      // notice. Pin to explicit, dated model ids.
      expect(model).not.toMatch(/-latest$/);
    }
  });

  it('attemptGoogleInference walks GEMINI_VISION_MODELS rather than hardcoding one id', () => {
    const source = readFileSync(ANALYZE_ROUTE, 'utf8');

    // Route must import the cascade …
    expect(source).toMatch(/import\s*\{[^}]*GEMINI_VISION_MODELS[^}]*\}\s*from\s*'@\/lib\/ai-providers'/);
    // … and iterate it (the loop is what gives 429-on-one-model
    // resilience).
    expect(source).toMatch(/for\s*\(\s*const\s+model\s+of\s+GEMINI_VISION_MODELS\s*\)/);

    // Strip block + line comments so historical references in
    // docstrings (e.g. "fix attempted gemini-2.0-flash …") don't trip
    // the live-code invariants below.
    const code = source
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/[^\n]*/g, '');

    // No hardcoded `const model = 'gemini-…'` survives — only the
    // cascade iteration is allowed.
    expect(code).not.toMatch(/const\s+model\s*=\s*'gemini-[\w.-]+'/);

    // Live code must NOT contain a `-latest` alias for any Gemini variant.
    expect(code).not.toMatch(/gemini-[\w.-]*-latest/);
  });

  it('route surfaces the Cloudflare-primary error as `primaryProviderError`', () => {
    // Without this, a 503 only carries the LAST error in the chain
    // (Google's), so when the actual root cause is the CF primary
    // (binding missing, model retired, …) operators are blind.
    const source = readFileSync(ANALYZE_ROUTE, 'utf8');
    expect(source).toContain('primaryProviderError');
  });

  it('attemptAiInference auto-accepts the Llama Community License on error 5016', () => {
    // Bug-hunt May 2026 (Request ID `sex01ab2`): every production scan
    // was failing the CF primary with error `5016: … you must submit
    // the prompt 'agree'` because the Llama 3.2 Community License had
    // never been accepted on the Cloudflare account. The cascade
    // absorbed it (Gemini served all traffic) but every scan paid
    // Gemini free-tier quota for work CF should have done for free.
    //
    // Fix: on first 5016 error, submit `prompt: 'agree'` (Cloudflare's
    // documented programmatic acceptance path) and retry the actual
    // inference once. Subsequent scans never re-trigger it.
    const source = readFileSync(ANALYZE_ROUTE, 'utf8');
    // Must detect the stable error code marker …
    expect(source).toContain("'5016:'");
    // … must submit `agree` as a separate, image-free call …
    expect(source).toMatch(/env\.AI\.run\([^)]*model[^)]*\{\s*prompt:\s*'agree'\s*\}/);
    // … and must NOT propagate the 5016 error before attempting to
    // accept (i.e. the throw on 5016 only fires if acceptance itself
    // failed — checked by the inline `acceptErr` block).
    expect(source).toContain('CF_LLAMA_LICENSE_ACCEPTING');
    expect(source).toContain('CF_LLAMA_LICENSE_ACCEPTED');
  });

  it('scan page renders any google-gemini-* model id, not just one hardcoded', () => {
    const source = readFileSync(SCAN_PAGE, 'utf8');

    // Helper that maps id → display name must exist (used for the
    // "Analyzed by …" footer).
    expect(source).toContain('modelDisplayName');
    // Prefix-based check, so any future Gemini cascade addition
    // (lite, 3.0, etc.) renders correctly without further code edits.
    expect(source).toContain("startsWith('google-gemini-')");

    // Old single-id checks must be gone.
    expect(source).not.toContain("=== 'google-gemini-2.0-flash'");
    expect(source).not.toContain("=== 'google-gemma-3-27b'");
  });

  it('chat cascade (lib/ai-providers) shares GEMINI_VISION_MODELS[0] with scan', () => {
    // Both the scan fallback and the chat cascade hit the same Google
    // key — keeping them on the same explicit model id avoids the
    // situation where chat keeps working (because Groq answers first)
    // while scan silently breaks (because CF primary failed and the
    // Gemini fallback resolves to a retired alias or a zero-quota id).
    const source = readFileSync(AI_PROVIDERS, 'utf8');

    // Strip block + line comments so historical references in
    // docstrings don't trip the live-code invariants below.
    const code = source
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/[^\n]*/g, '');

    // chat path must reference the cascade head, not a literal id —
    // protects the single-source-of-truth contract.
    expect(code).toContain('GEMINI_VISION_MODELS[0]');
    // Defensive: must NOT call the retired alias …
    expect(code).not.toContain('gemini-1.5-flash-latest');
    // … and must NOT use any `-latest` alias for any Gemini variant.
    expect(code).not.toMatch(/gemini-[\w.-]*-latest/);
  });
});
