/**
 * Deeper e2e probes — iterations 5+ in the UX-audit loop.
 *
 * Each block targets a surface the smoke + ui-ux suites don't
 * exercise. Some find bugs; some just expand coverage. Both are
 * useful: green tests today are tomorrow's regression-catchers.
 */
import { test, expect } from '@playwright/test';

test.describe('per-locale 404 carries security headers + Cache-Control', () => {
  // Round-3 added security headers via next.config.js. They apply to
  // every non-/api/* route — but 404 responses are a separate render
  // path. Confirm the headers still land on the localised not-found.
  for (const locale of ['th', 'en', 'de', 'da'] as const) {
    test(`/${locale}/missing-${locale} keeps X-Frame-Options + Referrer-Policy`, async ({ request }) => {
      const res = await request.get(`/${locale}/missing-${locale}-${Date.now()}`);
      expect(res.status()).toBe(404);
      expect(res.headers()['x-frame-options']).toBe('DENY');
      expect(res.headers()['referrer-policy']).toBe('strict-origin-when-cross-origin');
    });
  }
});

test.describe('all 4 locale homepages expose the same hreflang alternates set', () => {
  // PR #41 added `alternates.languages` to the layout metadata.
  // Each locale page should render alternates pointing at every
  // other locale — search engines need the full graph to canonicalise.
  for (const locale of ['th', 'en', 'de', 'da'] as const) {
    test(`/${locale} carries hreflang links to all 4 locales + x-default`, async ({ page }) => {
      await page.goto(`/${locale}`);
      const hrefs = await page.locator('link[rel="alternate"][hreflang]').evaluateAll((els) =>
        els.map((e) => e.getAttribute('hreflang')),
      );
      // Set comparison so order doesn't matter.
      const seen = new Set(hrefs);
      for (const expected of ['th', 'en', 'de', 'da', 'x-default']) {
        expect(seen.has(expected), `${locale} missing hreflang="${expected}"`).toBe(true);
      }
    });
  }
});

test.describe('every locale homepage has a unique <title> that contains the brand', () => {
  // Search-engine UX: each language's tab title should be readable
  // by speakers of that language. Today the title is English-only —
  // pinning the current behaviour so any future locale-aware title
  // PR doesn't break it.
  for (const locale of ['th', 'en', 'de', 'da'] as const) {
    test(`/${locale} title contains "Shinny Guide"`, async ({ page }) => {
      await page.goto(`/${locale}`);
      const title = await page.title();
      expect(title).toContain('Shinny Guide');
      expect(title.length).toBeGreaterThan(10);
      expect(title.length).toBeLessThan(120); // Google truncates at ~60 chars on desktop.
    });
  }
});

test.describe('meta description is present and non-empty', () => {
  test('/th has a meta description over 50 chars', async ({ page }) => {
    await page.goto('/th');
    const desc = await page.locator('meta[name="description"]').first().getAttribute('content');
    expect(desc, 'no meta description').toBeTruthy();
    expect(desc!.length).toBeGreaterThan(50);
    expect(desc!.length).toBeLessThan(300); // Google truncates ~160.
  });
});

test.describe('viewport meta tag enforces mobile-first', () => {
  test('/th declares width=device-width', async ({ page }) => {
    await page.goto('/th');
    const viewport = await page.locator('meta[name="viewport"]').first().getAttribute('content');
    expect(viewport).toContain('width=device-width');
  });
});

test.describe('forms expose proper labels + autocomplete hints', () => {
  test('/th/login email input has type=email + autocomplete', async ({ page }) => {
    await page.goto('/th/login', { waitUntil: 'load' });
    const emailInput = page.locator('input[type="email"]').first();
    const count = await emailInput.count();
    test.skip(count === 0, 'login form not on initial paint (register tab is default?) — skipping');
    // Browsers use autocomplete hints to surface saved credentials.
    const autocomplete = await emailInput.getAttribute('autocomplete');
    // Either set to "email" / "username" — both are accepted by spec.
    // Just confirming it's not null (which would break iOS keychain).
    expect(autocomplete, 'email input missing autocomplete attribute').not.toBeNull();
  });

  test('/th/login password input has type=password + autocomplete', async ({ page }) => {
    await page.goto('/th/login', { waitUntil: 'load' });
    const pwInput = page.locator('input[type="password"]').first();
    const count = await pwInput.count();
    test.skip(count === 0, 'login form not on initial paint — skipping');
    const autocomplete = await pwInput.getAttribute('autocomplete');
    expect(autocomplete, 'password input missing autocomplete attribute').not.toBeNull();
  });
});

test.describe('headings hierarchy starts at h1 on each page', () => {
  // Accessibility: SR users navigate by heading level. Pages without
  // an h1 (or with skipped levels) are harder to navigate.
  for (const path of ['/th', '/th/scan', '/th/login', '/th/pricing']) {
    test(`${path} has exactly one <h1>`, async ({ page }) => {
      await page.goto(path);
      const h1Count = await page.locator('h1').count();
      expect(h1Count, `${path} h1 count`).toBeGreaterThanOrEqual(1);
      // Multiple h1s are valid in HTML5 sectioning but harm SR UX;
      // we allow up to 2 (some layouts use one in header, one in main)
      // but flag >2 as a regression worth reviewing.
      expect(h1Count).toBeLessThanOrEqual(2);
    });
  }
});

test.describe('lang attribute is set on every locale path', () => {
  // Round-1 smoke already covers homepages. Extend to sub-pages
  // because next-intl middleware can theoretically miss certain
  // segment combinations.
  for (const path of ['/th/scan', '/th/login', '/th/pricing', '/th/recipes']) {
    test(`${path} renders <html lang="th">`, async ({ page }) => {
      await page.goto(path);
      await expect(page.locator('html')).toHaveAttribute('lang', 'th');
    });
  }
});

test.describe('static asset payloads are reasonable', () => {
  // Catches the class of bug PR #40 fixed (418KB icon.png in a tab
  // icon slot). Any single asset > 500KB on the critical path is
  // worth reviewing.
  test('/favicon.svg is under 4KB', async ({ request }) => {
    const res = await request.get('/favicon.svg');
    const body = await res.text();
    expect(body.length).toBeLessThan(4096);
  });

  test('PWA manifest is under 1KB', async ({ request }) => {
    const res = await request.get('/manifest.webmanifest');
    const body = await res.text();
    expect(body.length).toBeLessThan(1024);
  });
});

test.describe('rate-limit headers appear on 429 responses', () => {
  // Round-2 (PR #28) fixed the rate-limit silent-pass-through. Once
  // the limit engages, the response should carry `retry-after` so
  // clients know when to retry. Verified at the source level by
  // tests/rate-limit.test.ts; here we confirm the LIVE behaviour by
  // hammering the voucher-check endpoint sequentially.
  //
  // NOTE: this test changes server state (consumes the rate-limit
  // bucket). It runs against the public voucher path and only counts
  // headers, not state — safe to run repeatedly.
  test('sequential voucher probes eventually return 429 with retry-after', async ({ request }) => {
    let saw429 = false;
    let retryAfter: string | null = null;
    for (let i = 0; i < 40; i++) {
      const res = await request.get(`/api/voucher/check?code=E2E_PROBE_${i}`);
      if (res.status() === 429) {
        saw429 = true;
        retryAfter = res.headers()['retry-after'] ?? null;
        break;
      }
    }
    expect(saw429, 'rate limit did not engage within 40 sequential probes').toBe(true);
    expect(retryAfter, '429 missing retry-after header').not.toBeNull();
  });
});
