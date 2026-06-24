import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config — browser-driven e2e smoke against production.
 *
 * Bug-hunt May 2026 added Playwright as a new test layer on top of
 * the existing Vitest unit suite (163 tests). The two layers cover
 * different surfaces:
 *
 *   Vitest (163 tests, ~2s)
 *     - Source-code invariants (regression-pinning by reading files)
 *     - Pure-function logic (crypto, validators, schemas, sitemap)
 *     - Run on every commit via `npm run check:all`
 *
 *   Playwright (this file, ~30-60s, opt-in)
 *     - Browser-rendered HTML structure
 *     - Console-error and 4xx/5xx detection at the network layer
 *     - Locale-switching, multi-photo flow, auth round-trip
 *     - NOT run by default in `check:all` — too slow + needs network.
 *       Invoke explicitly: `npm run test:e2e`
 *
 * `baseURL` defaults to production. Pass `--config playwright.config.ts
 * --grep ...` for targeted runs; pass `BASE_URL=http://localhost:3000`
 * to point at a dev server (e.g. for `npm run dev` parallel debugging).
 *
 * Why no local dev-server lifecycle (`webServer` config)?
 *   The existing scan / auth flow depends on the live Cloudflare D1
 *   binding + Workers AI binding + Google API key + rate-limit Map
 *   state. Recreating those in a local Wrangler dev session is a
 *   per-developer concern documented in `docs/GUIDELINE.md`. The e2e
 *   suite is structured to NOT assume any of them — only deterministic
 *   surfaces (HTML, headers, static assets) are exercised here.
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: process.env.BASE_URL || 'https://shinnyguide.autobahn.bot',
    trace: 'on-first-retry',
    // Sandboxed CI / dev containers don't always carry the public
    // root CA bundle that Chromium needs to validate the production
    // cert chain. Without this, page.goto() throws
    // ERR_CERT_AUTHORITY_INVALID while `request.get()` (which uses
    // Node's TLS) succeeds. The probe target is our own production
    // host, so trusting it is acceptable — DO NOT extend this to
    // arbitrary external targets.
    ignoreHTTPSErrors: true,
    // Render at a mobile-first viewport because the scan flow is
    // designed mobile-first and that's where the user-reported
    // regressions land (multi-photo timeout, locale 404, etc.).
    viewport: { width: 414, height: 896 }, // iPhone 11 Pro / similar
    // Default browsers send Accept-Language: en. Set to th so the
    // locale middleware routes us to /th for unprefixed paths and
    // matches Thai-primary launch reality.
    locale: 'th-TH',
    extraHTTPHeaders: { 'Accept-Language': 'th,en;q=0.8' },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
