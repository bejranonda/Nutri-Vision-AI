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

  it('route surfaces the primary-provider failure as `primaryProviderError`', () => {
    // Without this, a 503 only carries the LAST error in the chain, so
    // operators are blind to which provider actually broke first.
    // Originally the primary was CF and we surfaced CF errors here;
    // post-PR #27 the primary is Gemini and we surface Gemini cascade
    // errors here. Either way the field name is the same — only the
    // semantics shifted.
    const source = readFileSync(ANALYZE_ROUTE, 'utf8');
    expect(source).toContain('primaryProviderError');
  });

  it('cascade order: Gemini is primary, Cloudflare Workers AI is fallback', () => {
    // Bug-hunt May 2026: CF Llama 3.2 11B vision is unreliable (returns
    // wrong dish names with 100% confidence — "Pineapple" for Shrimp
    // Fried Rice). Originally CF was primary for cost reasons, but
    // because CF's invalid output triggered fallthrough on most scans
    // anyway, Gemini-primary doesn't cost meaningfully more quota — it
    // just trades the "fast, free, sometimes-wrong" UX for "accurate
    // when Gemini has quota, falls back to CF when it doesn't".
    //
    // This test pins the order so a future contributor can't quietly
    // swap it back without a corresponding update to the comment
    // explaining why.
    const source = readFileSync(ANALYZE_ROUTE, 'utf8');
    const code = source
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/[^\n]*/g, '');

    // The first attempt inside `runInferenceWithValidation` must be
    // Gemini, not CF.
    const geminiIdx = code.indexOf('attemptGoogleInference(googleKey');
    const cfIdx = code.indexOf("attemptAiInference('@cf/meta/llama-3.2-11b-vision-instruct'");
    expect(geminiIdx).toBeGreaterThan(-1);
    expect(cfIdx).toBeGreaterThan(-1);
    expect(geminiIdx).toBeLessThan(cfIdx);
  });

  it('image is passed to CF AI as a flat number[], not wrapped in another array', () => {
    // Bug-hunt May 2026 (post-PR #25): once the Llama license was
    // auto-accepted, CF model responses revealed it had NEVER been
    // seeing the image. Cause: route was calling
    //   `env.AI.run(model, { prompt, image: [bytes] })`
    // where `bytes` is a `Uint8Array`. CF deserialises that as a
    // 1-element list whose only entry is the typed array; the vision
    // model sees zero pixels and hallucinates a text-only response
    // ("Here is your image: ![image](https://i.imgur.com/…)").
    //
    // Correct shape is `image: number[]` (array of byte values). Use
    // `Array.from(Uint8Array)` to flatten.
    const source = readFileSync(ANALYZE_ROUTE, 'utf8');
    const code = source
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/[^\n]*/g, '');

    // The wrong shape must not survive in live code.
    expect(code).not.toMatch(/image\s*:\s*\[\s*bytes\s*\]/);
    expect(code).not.toMatch(/image\s*:\s*\[\s*decodeBase64ToBytes/);

    // The decode site must convert Uint8Array → number[] before passing
    // to env.AI.run.
    expect(code).toMatch(/Array\.from\(\s*decodeBase64ToBytes/);

    // The actual call must reference the flattened `bytes`, not a
    // wrapping array literal.
    expect(code).toMatch(/image\s*:\s*bytes\b/);
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
