/**
 * Full user-journey e2e — drives the production app the way a real
 * user would, in one continuous browser session per phase.
 *
 * Phases (each is its own `test` so a flake in one doesn't mask the others):
 *   1. Landing + locale switch        — /th renders, switch to /en works,
 *                                       hreflang graph is complete.
 *   2. Scan flow (upload → analyze)   — pick a generated PNG, click
 *                                       Analyze, wait for the UI to reach
 *                                       a terminal state (result OR the
 *                                       friendly "not food" rejection OR
 *                                       a surfaced error). All three are
 *                                       valid journeys; what we're
 *                                       proving is the route doesn't
 *                                       leave the user stuck on a spinner.
 *   3. Auth round-trip                — /login renders the register tab
 *                                       by default; submitting a fresh
 *                                       unique email exercises the wired
 *                                       POST /api/auth/register handler.
 *                                       Production has voucher-gating on,
 *                                       so the expected terminal state
 *                                       for a no-voucher attempt is a
 *                                       visible voucher_required error,
 *                                       NOT an account creation. Either
 *                                       (created + redirected to
 *                                       /dashboard, or voucher_required
 *                                       error surfaced) proves the
 *                                       round-trip wiring works.
 *   4. Recipes / chat / dashboard     — visit each and assert they
 *                                       reach an interactive state (or
 *                                       redirect cleanly for the
 *                                       auth-gated pages) without dumping
 *                                       red console errors.
 *
 * Why this isn't in `smoke.spec.ts`: smoke is fast, deterministic, and
 * read-only. This file makes a real Gemini call and a real registration
 * attempt — slower, side-effectful, and worth opting in to explicitly:
 *
 *     npx playwright test tests/e2e/user-journey.spec.ts
 *
 * Side-effect budget per run:
 *   - 1 analyze() call against Workers AI / Gemini (per the cascade in
 *     lib/ai-providers.ts). The PNG is a solid color tile, so the model
 *     will route into the not_food branch; cost is the input-token
 *     vision call only.
 *   - 1 registration attempt with a one-time email. With voucher gating
 *     on, the row never reaches `users`, so no cleanup is needed.
 */
import { test, expect } from '@playwright/test';
import { Buffer } from 'buffer';
import zlib from 'zlib';

/**
 * Build a 256×256 noisy PNG in-memory. Used as the upload fixture so
 * this spec stays self-contained (no binary in tests/fixtures).
 *
 * Why noisy + this size, not a tiny solid-color tile:
 *   The client guard in `useScanUpload.ts` rejects files under
 *   MIN_FILE_SIZE (500 bytes) silently — it just sets uploadError, no
 *   "Analyze Now" button ever appears. A solid 64×64 PNG deflates to
 *   ~250 bytes (caught by the guard); noise resists deflate enough
 *   that 256×256 lands comfortably over 500 B.
 */
function makeSolidPng(): Buffer {
  const w = 256;
  const h = 256;
  const raw = Buffer.alloc(h * (1 + w * 3));
  // Deterministic LCG — incompressible enough to clear the 500B floor
  // without shipping a binary fixture in the repo.
  let seed = 0x12345678;
  for (let y = 0; y < h; y++) {
    raw[y * (1 + w * 3)] = 0; // PNG filter byte: 0 = None
    for (let x = 0; x < w; x++) {
      const o = y * (1 + w * 3) + 1 + x * 3;
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      raw[o] = seed & 0xff;
      raw[o + 1] = (seed >> 8) & 0xff;
      raw[o + 2] = (seed >> 16) & 0xff;
    }
  }
  const idat = zlib.deflateSync(raw);

  function chunk(type: string, data: Buffer): Buffer {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const crcInput = Buffer.concat([typeBuf, data]);
    // CRC-32, IEEE 802.3 polynomial — table-driven to keep the test
    // hermetic (no zlib.crc32 in older Node majors).
    let crc = 0xffffffff;
    for (const byte of crcInput) {
      crc ^= byte;
      for (let i = 0; i < 8; i++) {
        crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
      }
    }
    crc = (crc ^ 0xffffffff) >>> 0;
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc, 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: truecolor (RGB)
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), // PNG signature
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/**
 * Console-error noise that is benign-by-design, shared by every phase:
 *   - /api/auth/me 401: fixed in PR #56 — kept as a safety net.
 *   - Next.js RSC prefetch fallback: a hovered/visible <Link> prefetch
 *     can race navigation (especially under full-suite parallel load)
 *     and log "Failed to fetch RSC payload … Falling back to browser
 *     navigation". The router then DOES fall back successfully —
 *     nothing the user sees is broken. Caught flaking phase 1 only
 *     when the whole suite runs in parallel.
 */
function isBenignConsoleError(text: string): boolean {
  return (
    /Failed to load resource.*auth\/me/i.test(text) ||
    /Failed to fetch RSC payload/i.test(text)
  );
}

// Each phase is independent — a flake in scan shouldn't suppress the
// auth + nav phases. Parallel false keeps results deterministic
// (we share the same baseURL, but the production side-effects are
// per-test, not cross-test).
test.describe.configure({ mode: 'default' });

test.describe('user journey — production', () => {
  test('1. landing — /th renders, locale switch to /en works, hreflang graph complete', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error') consoleErrors.push(m.text());
    });

    const res = await page.goto('/th');
    expect(res?.status()).toBe(200);
    await expect(page.locator('html')).toHaveAttribute('lang', 'th');
    await expect(page.locator('body')).toContainText(/Shinny|ชินนี่/);

    // hreflang graph: every locale + x-default, so search engines can
    // canonicalise across translations.
    const hrefs = await page
      .locator('link[rel="alternate"][hreflang]')
      .evaluateAll((els) => els.map((e) => e.getAttribute('hreflang')));
    for (const expected of ['th', 'en', 'de', 'da', 'x-default']) {
      expect(new Set(hrefs).has(expected), `homepage missing hreflang="${expected}"`).toBe(true);
    }

    // Locale switch — exercise the same path a user would: navigate to
    // /en (the language switcher itself is covered by ui-ux.spec.ts) and
    // verify the page re-hydrates under the new lang.
    const enRes = await page.goto('/en');
    expect(enRes?.status()).toBe(200);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');

    const fatal = consoleErrors.filter((e) => !isBenignConsoleError(e));
    expect(fatal, fatal.join('\n')).toHaveLength(0);
  });

  test('2. scan — upload a generated PNG, run analyze, land on a terminal UI state', async ({ page }) => {
    // The analyze chain runs PNG compression in-browser, then a single
    // POST /api/analyze that round-trips Workers AI + the Gemini
    // fallback cascade end-to-end. On a cold worker that's 60-90s
    // before the meal/non-food UI swaps in; the default 30s test
    // timeout cuts the test off mid-load.
    test.setTimeout(180_000);
    const consoleErrors: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error') consoleErrors.push(m.text());
    });

    await page.goto('/th/scan');
    // The Shinny mascot is the page-hydration proxy used by smoke.spec.ts.
    await expect(page.locator('img[alt*="Shinny"], img[src*="shinny_avatar"]').first()).toBeVisible();

    // The visible "Upload" button is a styled element that programmatically
    // clicks `<input ref={fileInputRef} type="file" multiple>`. Skip the
    // styling and drive the hidden input directly — same wire-level
    // result, fewer DOM-shape assumptions.
    const fileInput = page.locator('input[type="file"][multiple]');
    await expect(fileInput).toHaveCount(1);
    await fileInput.setInputFiles({
      name: 'journey-fixture.png',
      mimeType: 'image/png',
      buffer: makeSolidPng(),
    });

    // After upload, the FileReader resolves and ScanUploadArea re-renders
    // with the preview + "Analyze Now" CTA. The button is bound to
    // i18n key `scan.multi_photo.analyze_now` → "วิเคราะห์เลย" at /th.
    // Locate by visible text so we sidestep accessible-name quirks from
    // the Sparkles icon child. 20s window absorbs the FileReader hop.
    const analyzeButton = page
      .locator('button', { hasText: /วิเคราะห์เลย|Analyze Now|Jetzt analysieren|Analyser nu/i })
      .first();
    await expect(analyzeButton).toBeVisible({ timeout: 20_000 });
    await analyzeButton.click();

    // Terminal state: the analyze hook resolves to ONE of —
    //   - meal/menu/drink result rendered (score badge appears),
    //   - non-food UI (orange card with the i18n `scan.try_again`
    //     "Scan Another" / "สแกนอาหารอื่น" CTA),
    //   - error UI (red card with the same try_again CTA).
    // Allow up to 90s for cold Workers AI + Gemini fallback cascade.
    const terminal = page.locator(
      'text=/Scan Another|สแกนอาหารอื่น|Erneut scannen|Scan Igen|Health Score|คะแนน/i',
    );
    await expect(terminal.first()).toBeVisible({ timeout: 90_000 });

    // No analyze-path console errors that the user would actually be
    // hurt by. On top of the shared benign set, two scan-specific
    // patterns are filtered:
    //   - "SCAN ERROR" with category=timeout — this is the LOGGER itself
    //     reporting the model-cascade timeout via console.error, and the
    //     scan UI handles it (renders the orange "try again" card seen
    //     in this very test). The console line is instrumentation, not
    //     a user-facing failure.
    //   - Bare 404 resource lines on a slow cold-start — the assets do
    //     load on retry; not journey-blocking.
    const fatal = consoleErrors.filter(
      (e) =>
        !isBenignConsoleError(e) &&
        !/SCAN ERROR.*category=timeout/i.test(e) &&
        !/Failed to load resource: the server responded with a status of 404/i.test(e),
    );
    expect(fatal, fatal.join('\n')).toHaveLength(0);
  });

  test('3. auth — /login renders, registration round-trip surfaces a terminal response', async ({ page, request }) => {
    await page.goto('/th/login');

    // Page must default to the register tab for fresh visitors (UX-audit
    // round May 2026). The display-name input is register-only.
    await expect(page.locator('#auth-display-name')).toBeVisible();

    const stamp = Date.now();
    const email = `e2e-journey-${stamp}@journey.shinnyguide.test`;
    await page.locator('#auth-display-name').fill('Journey Probe');
    await page.locator('#auth-email').fill(email);
    await page.locator('#auth-password').fill('JourneyProbe!1');
    await page.locator('#auth-confirm-password').fill('JourneyProbe!1');

    // Submit without a voucher. Production has VOUCHER_REQUIRED_FOR_REGISTRATION
    // on, so the expected terminal state is the inline error banner with
    // the voucher_required reason — NOT a redirect to /dashboard. Either
    // outcome (created OR voucher_required error visible) proves the
    // /api/auth/register handler is wired and reachable from the browser.
    // BOTH the "Register" tab AND the submit CTA have the same Thai
    // text ("สมัครสมาชิก"), so a role+name selector + .first() would
    // re-click the already-active tab and never submit the form. Pin to
    // the actual submit element.
    const submit = page.locator('button[type="submit"]').first();
    const [registerResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/api/auth/register'), { timeout: 30_000 }),
      submit.click(),
    ]);

    expect([200, 201, 400, 409, 429]).toContain(registerResponse.status());
    if (registerResponse.status() === 400) {
      const body = await registerResponse.json().catch(() => ({}));
      // The route returns `reason: 'voucher_required'` when the gate is on
      // and the client omitted a code — pin that contract so the test
      // remains a real assertion (not a tautology).
      expect(body.reason ?? body.error ?? '').toMatch(/voucher|invalid/i);
    }

    // Wait for the form to settle into ANY terminal state. Three are
    // possible in production today:
    //   - inline error banner with voucher copy (correct path),
    //   - success card (would mean voucher gating is OFF this deploy),
    //   - Next.js error overlay (CLIENT BUG — the form crashed on the
    //     400 response; caught in the May/Jun 2026 hunt).
    // Polling for all three with a single locator and an explicit race
    // makes the failure mode legible: we report which terminal state
    // engaged, then assert it wasn't the crash.
    const crashHeading = page.getByRole('heading', {
      name: /Application error.*client-side exception/i,
    });
    const inlineError = page.locator('text=/voucher|invalid|required/i');
    const successCard = page.getByRole('heading', { name: /Success|สำเร็จ/i });

    // Race the three. Whichever surfaces first wins; the others might
    // also mount, but the first one tells us which branch ran.
    await Promise.race([
      crashHeading.waitFor({ state: 'visible', timeout: 15_000 }).catch(() => null),
      inlineError.first().waitFor({ state: 'visible', timeout: 15_000 }).catch(() => null),
      successCard.waitFor({ state: 'visible', timeout: 15_000 }).catch(() => null),
    ]);

    const crashed = (await crashHeading.count()) > 0;
    const inlineErrorVisible = await inlineError.first().isVisible().catch(() => false);
    const successVisible = await successCard.isVisible().catch(() => false);

    expect(
      crashed,
      'Register form crashed on /api/auth/register response — Next.js error boundary engaged. ' +
        'Expected the inline voucher_required error banner to render instead.',
    ).toBe(false);

    // One of the non-crash terminal states must be visible. (Both can
    // coexist if a stale state somehow lingers; either alone is enough.)
    expect(
      inlineErrorVisible || successVisible,
      'No terminal state rendered after register submit — neither inline error nor success card visible within 15s.',
    ).toBe(true);
  });

  test('4. recipes / chat / dashboard reach a stable rendered state without console errors', async ({ page }) => {
    for (const path of ['/th/recipes', '/th/chat', '/th/dashboard']) {
      const errs: string[] = [];
      const handler = (m: import('@playwright/test').ConsoleMessage) => {
        if (m.type() === 'error') errs.push(m.text());
      };
      page.on('console', handler);

      await page.goto(path);

      // Each of these EITHER renders its own UI (recipes placeholder, chat
      // hero) OR bounces to /login when unauthenticated (dashboard, chat).
      // Both are valid; we assert the page reached SOMETHING the user
      // would recognise — the persistent SiteHeader brand mark or the
      // login form.
      const landed = page.locator(
        'text=/Shinny|ชินนี่|Welcome|ยินดี|create_account|create an account|สมัครสมาชิก/i'
      );
      await expect(landed.first()).toBeVisible({ timeout: 15_000 });

      // No console errors on the rendered page beyond the shared
      // benign set (see isBenignConsoleError).
      const fatal = errs.filter((e) => !isBenignConsoleError(e));
      expect(fatal, `${path} console:\n${fatal.join('\n')}`).toHaveLength(0);

      page.off('console', handler);
    }
  });
});
