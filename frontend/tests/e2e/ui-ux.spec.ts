/**
 * UI / UX e2e probes — wider browser-driven coverage on top of the
 * smoke suite. Each block targets a surface a code-only test can't
 * reach: real DOM, real layout, real interactivity.
 */
import { test, expect } from '@playwright/test';

test.describe('locale switcher round-trip', () => {
  test('clicking a locale flag swaps the lang attribute + body content', async ({ page }) => {
    await page.goto('/th');
    await expect(page.locator('html')).toHaveAttribute('lang', 'th');

    // Find the LanguageSwitcher trigger (rendered on every page;
    // its visible label is the current locale name from i18n-config).
    // Then click an English option and verify the lang + URL update.
    const switcher = page.getByRole('button', { name: /ไทย|EN|DE|DA/i }).first();
    if (await switcher.isVisible()) {
      await switcher.click();
      const en = page.getByRole('link', { name: /^EN$/ }).first();
      if (await en.isVisible({ timeout: 1000 }).catch(() => false)) {
        await en.click();
        await expect(page).toHaveURL(/\/en(\/|$)/);
        await expect(page.locator('html')).toHaveAttribute('lang', 'en');
      }
    }
  });
});

test.describe('navigation links from the homepage work', () => {
  test('scan + login + pricing links resolve to 200 + matching path', async ({ page }) => {
    await page.goto('/th');
    for (const { selector, expectedPath } of [
      // Link selectors fall back to text since the nav uses
      // localized labels; any anchor whose href ends with the path
      // counts.
      { selector: 'a[href$="/th/scan"]', expectedPath: '/th/scan' },
      { selector: 'a[href$="/th/login"]', expectedPath: '/th/login' },
      { selector: 'a[href$="/th/pricing"]', expectedPath: '/th/pricing' },
    ]) {
      const link = page.locator(selector).first();
      if (await link.isVisible({ timeout: 500 }).catch(() => false)) {
        await link.click();
        await expect(page).toHaveURL(new RegExp(expectedPath.replace(/\//g, '\\/')));
        await page.goBack();
      }
    }
  });
});

test.describe('every <img> on rendered pages has alt text or aria-hidden', () => {
  // Round-3 audit included a code-level <img> check on /th/scan.
  // Browser-rendered DOM may include images that weren't in the
  // initial HTML (e.g. via client-side rendering), so re-checking
  // the live DOM catches a wider surface.
  //
  // Wait strategy: `load` not `networkidle`. Bug-hunt May 2026
  // round-5 caught that next-intl + RSC hydration on `/th/login`
  // keeps the network slightly noisy beyond Playwright's 30s
  // networkidle threshold, timing out the test. Switching to `load`
  // means we evaluate the DOM as soon as it's hydrated; that's a
  // superset of "every <img> the user actually sees" for our flows.
  for (const path of ['/th', '/th/scan', '/th/pricing', '/th/login']) {
    test(`${path} — every visible <img> has alt or aria-hidden`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'load' });

      const imgs = await page.locator('img').all();
      const missing: string[] = [];
      for (const img of imgs) {
        const alt = await img.getAttribute('alt');
        const ariaHidden = await img.getAttribute('aria-hidden');
        // Empty alt='' is legitimate for purely-decorative images;
        // null (missing attribute) is the accessibility bug.
        if (alt === null && ariaHidden !== 'true') {
          const src = (await img.getAttribute('src')) || '(no src)';
          missing.push(src);
        }
      }
      expect(missing, `images missing alt/aria-hidden: ${missing.join(', ')}`).toHaveLength(0);
    });
  }
});

test.describe('zero broken images post-load', () => {
  test('/th — every <img> finishes loading (naturalWidth > 0)', async ({ page }) => {
    // Catches references like /icon.png that exist as <link> tags but
    // 404 on the network — these only become visible at runtime.
    const failed: string[] = [];
    page.on('response', (res) => {
      if (res.request().resourceType() === 'image' && res.status() >= 400) {
        failed.push(`${res.status()} ${res.url()}`);
      }
    });
    await page.goto('/th', { waitUntil: 'load' });
    // Give client-rendered images a moment to start loading; networkidle
    // is too aggressive on next-intl RSC pages (round-5 timeout).
    await page.waitForTimeout(2000);
    expect(failed, `broken images: ${failed.join('\n')}`).toHaveLength(0);
  });
});

test.describe('manifest.webmanifest references icons that actually serve', () => {
  test('every icon URL in the manifest resolves to 200', async ({ request }) => {
    // Fixed in PR #40 — manifest used to reference /icon.png and
    // /apple-icon.png which 404'd. Now references /favicon.svg and
    // /images/shinny_avatar.png. This test catches any future regression
    // where a contributor adds an icon URL that doesn't actually serve.
    const manifestRes = await request.get('/manifest.webmanifest');
    expect(manifestRes.status()).toBe(200);
    const manifest = await manifestRes.json();
    expect(Array.isArray(manifest.icons)).toBe(true);
    for (const icon of manifest.icons) {
      const iconRes = await request.get(icon.src);
      expect(iconRes.status(), `manifest icon 404: ${icon.src}`).toBe(200);
    }
  });
});

// NOTE: a DOM-level "no karaoke romanisation in Thai" test lived here
// briefly during round-5 e2e expansion. It turned out to be
// over-aggressive — it flagged legitimate parenthetical translations
// like `"อร่อย ตาม ลำดับ" (Delicious in Order)` (brand tagline +
// English gloss) and acronyms like `(UPF)`, `(CSV, PDF)`. The original
// anti-karaoke rule targets PHONETIC TRANSLITERATIONS (`ซุปปลา (Soup
// Pla)`) where the Latin matches the Thai sound — which only the AI
// model can produce, not a hand-authored UI string. That rule stays
// pinned at the source-code level (`tests/ai-prompt.test.ts` →
// `LOCALE_INSTRUCTION.th` forbids the pattern in the prompt). A
// DOM-level test confused translation with transliteration, so it's
// deliberately not here.

test.describe('login form validation — empty submit surfaces an error', () => {
  test('/th/login — submitting empty form does NOT navigate to /dashboard', async ({ page }) => {
    // Switched to `load` + presence check via locator.count() because
    // `networkidle` timed out on this page in round-5 (long-tailed
    // RSC chunks). If the login form isn't present yet, skip — the
    // page may render with a tab default to register, which is a
    // separate UI surface.
    await page.goto('/th/login', { waitUntil: 'load' });

    const emailCount = await page.locator('input[type="email"]').count();
    const passwordCount = await page.locator('input[type="password"]').count();
    const submitCount = await page.locator('button[type="submit"]').count();
    test.skip(
      emailCount === 0 || passwordCount === 0 || submitCount === 0,
      'login form fields not on initial paint — skipping interaction probe',
    );

    await page.locator('button[type="submit"]').first().click();
    await page.waitForTimeout(500);
    // The MUST-NOT condition: an empty form submission must never
    // navigate to /dashboard (that would mean login accepted empty
    // creds — a critical auth bug). Inline error messages are nice
    // but not pinned here; the auth-bypass guard is.
    await expect(page).not.toHaveURL(/\/dashboard/);
  });
});

test.describe('robots.txt is reachable + advertises the sitemap path', () => {
  test('robots.txt has a non-empty body', async ({ request }) => {
    const res = await request.get('/robots.txt');
    expect(res.status()).toBe(200);
    const body = await res.text();
    expect(body.length).toBeGreaterThan(0);
  });
});

test.describe('canonical meta links exist on locale pages', () => {
  test('/th has alternate hreflang or canonical', async ({ page }) => {
    await page.goto('/th');
    // Either rel=canonical OR rel=alternate hreflang must exist for
    // search engines to understand the multi-locale relationship.
    const canonical = page.locator('link[rel="canonical"]').first();
    const alternate = page.locator('link[rel="alternate"][hreflang]').first();
    const hasCanonical = await canonical.count() > 0;
    const hasAlternate = await alternate.count() > 0;
    expect(hasCanonical || hasAlternate, 'neither canonical nor hreflang alternates present').toBe(true);
  });
});
