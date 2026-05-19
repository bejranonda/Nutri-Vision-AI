/**
 * E2E smoke — production-facing browser checks.
 *
 * Each test maps to a concrete user observation from the May 2026
 * bug-hunt sessions. Unit tests (vitest) read source files and assert
 * invariants; these tests render in a real browser and assert what a
 * user would actually see.
 */
import { test, expect } from '@playwright/test';

test.describe('homepage smoke per locale', () => {
  for (const locale of ['th', 'en', 'de', 'da'] as const) {
    test(`/${locale} renders without console errors and shows the brand`, async ({ page }) => {
      const consoleErrors: string[] = [];
      page.on('console', (m) => {
        if (m.type() === 'error') consoleErrors.push(m.text());
      });

      const res = await page.goto(`/${locale}`);
      expect(res?.status()).toBe(200);

      // <html lang="..."> must match the locale segment — locked by
      // i18n-config and the locale layout.
      await expect(page.locator('html')).toHaveAttribute('lang', locale);

      // Body must contain the brand somewhere visible (text or alt).
      await expect(page.locator('body')).toContainText(/Shinny|ชินนี่/);

      // No red console errors. Hydration mismatches, missing keys,
      // failed image loads all show up here.
      expect(consoleErrors, consoleErrors.join('\n')).toHaveLength(0);
    });
  }
});

test.describe('favicon + share-preview assets resolve', () => {
  test('/favicon.svg returns image/svg+xml', async ({ request }) => {
    // Fixed in PR #40 — the App Router convention `src/app/icon.png`
    // 404'd, every browser tab showed the default glyph. SVG in
    // /public/ replaced it.
    const res = await request.get('/favicon.svg');
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('image/svg+xml');
    expect(await res.text()).toContain('<svg');
  });

  test('homepage <link rel="icon"> points at /favicon.svg', async ({ page }) => {
    await page.goto('/th');
    const href = await page.locator('link[rel="icon"]').first().getAttribute('href');
    expect(href).toBe('/favicon.svg');
  });

  test('og:image points at the absolute production URL (metadataBase)', async ({ page }) => {
    // Fixed in PR #35 — without `metadataBase` the og:image
    // resolved against localhost in crawler-fetched pages.
    await page.goto('/th');
    const ogImage = await page.locator('meta[property="og:image"]').first().getAttribute('content');
    expect(ogImage).toMatch(/^https:\/\/shinnyguide\.autobahn\.bot\//);
  });
});

test.describe('locale-aware 404 page', () => {
  // Fixed in PR #36 — catch-all `[locale]/[...slug]/page.tsx` forces
  // the locale layout to render so the next-intl provider has Thai
  // strings ready before notFound() fires.
  for (const { locale, headline } of [
    { locale: 'th', headline: /หาหน้านี้ไม่พบ/ },
    { locale: 'en', headline: /Couldn't find that page/i },
    { locale: 'de', headline: /konnte nicht gefunden werden/i },
    { locale: 'da', headline: /Kunne ikke finde/i },
  ]) {
    test(`/${locale}/no-such-path renders the localised not-found copy`, async ({ page }) => {
      const res = await page.goto(`/${locale}/no-such-path-e2e-probe`);
      // 404 status from Next.js notFound(), localized body.
      expect(res?.status()).toBe(404);
      await expect(page.locator('html')).toHaveAttribute('lang', locale);
      await expect(page.locator('body')).toContainText(headline);
    });
  }
});

test.describe('sitemap.xml is reachable and well-formed', () => {
  test('returns 200 with application/xml', async ({ request }) => {
    // Took 4 PRs (#34 convention → #36 dotted folder → #37 API+rewrite
    // → #38 static /public/) to land. Pinning the live URL response.
    const res = await request.get('/sitemap.xml');
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toMatch(/application\/xml/);
    const body = await res.text();
    expect(body).toContain('<urlset');
    // Must carry hreflang alternates for all four locales.
    for (const locale of ['th', 'en', 'de', 'da']) {
      expect(body).toContain(`hreflang="${locale}"`);
    }
  });
});

test.describe('HTML security headers + Cache-Control on API responses', () => {
  test('homepage has X-Frame-Options DENY + Referrer-Policy', async ({ request }) => {
    // Shipped in PR #34, via next.config.js `headers()`.
    const res = await request.get('/th');
    expect(res.headers()['x-frame-options']).toBe('DENY');
    expect(res.headers()['referrer-policy']).toBe('strict-origin-when-cross-origin');
  });

  test('every API endpoint sets Cache-Control: no-store', async ({ request }) => {
    // Shipped in PR #33 — uniform via `lib/api-response.ts → jsonResponse`.
    for (const path of [
      '/api/health',
      '/api/auth/me',
      '/api/voucher/check?code=x',
    ]) {
      const res = await request.get(path);
      expect(res.headers()['cache-control'], `${path} missing no-store`).toContain('no-store');
    }
  });
});

test.describe('/api/health exposes deployment metadata', () => {
  test('shaShort matches a 7-char prefix', async ({ request }) => {
    // Shipped in PR #30 — lets post-deploy validation start with a
    // single curl-vs-git-rev-parse comparison instead of behavioural
    // inference. Probing it from the browser context now too.
    const res = await request.get('/api/health');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.deployment).toBeDefined();
    expect(body.deployment.shaShort).toMatch(/^[a-f0-9]{7}$/);
    expect(body.deployment.branch).toBe('main');
  });
});

test.describe('zod request-body validation surfaces field-level errors', () => {
  test('POST /api/auth/login with empty body returns 400 with field codes', async ({ request }) => {
    // The Vitest schemas.test.ts pins the zod shapes at the source
    // level; this confirms the LIVE route actually wires them up.
    const res = await request.post('/api/auth/login', { data: {} });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Invalid request body');
    expect(body.fields).toMatchObject({
      email: 'invalid_type',
      password: 'invalid_type',
    });
  });
});

test.describe('scan page renders + shows the upload affordance', () => {
  test('/th/scan loads with the upload CTA visible', async ({ page }) => {
    await page.goto('/th/scan');
    // Page must reach an interactive state with the upload affordance
    // visible. The Shinny mascot avatar is preloaded so we use that
    // as a proxy for the page-hydrated state.
    await expect(page.locator('img[alt*="Shinny"], img[src*="shinny_avatar"]').first()).toBeVisible();
  });
});
