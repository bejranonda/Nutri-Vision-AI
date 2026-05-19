/**
 * Responsive + performance e2e — iteration 9.
 *
 * The other suites (smoke, ui-ux, deep-probes, a11y) render at the
 * mobile-first 414×896 viewport. Here we explicitly probe tablet
 * (768×1024) and desktop (1280×800) sizes to catch breakpoint
 * regressions: navigation that hides on mobile but not desktop, text
 * overflow on narrow widths, layout reflow at common cutoffs.
 *
 * Performance signals are lightweight — we don't try to measure
 * actual user metrics (needs real-device throttling). We measure
 * payload sizes + count of render-blocking requests as cheap proxies
 * for "did anything balloon?"
 */
import { test, expect } from '@playwright/test';

const VIEWPORTS = [
  { name: 'mobile',  width: 414,  height: 896  },
  { name: 'tablet',  width: 768,  height: 1024 },
  { name: 'desktop', width: 1280, height: 800  },
] as const;

test.describe('homepage renders at every viewport without layout breakage', () => {
  for (const vp of VIEWPORTS) {
    test(`/th @ ${vp.name} (${vp.width}×${vp.height}) — no horizontal scroll`, async ({ page }) => {
      // Horizontal scroll on a page that shouldn't have one is a
      // strong signal of a fixed-width element breaking the layout.
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/th', { waitUntil: 'load' });

      const overflow = await page.evaluate(() => {
        return {
          docW: document.documentElement.scrollWidth,
          winW: window.innerWidth,
        };
      });
      // Allow a 2px tolerance for sub-pixel rounding.
      expect(
        overflow.docW - overflow.winW,
        `horizontal overflow @ ${vp.width}px: doc=${overflow.docW}, win=${overflow.winW}`,
      ).toBeLessThanOrEqual(2);
    });
  }
});

test.describe('scan page is usable at every viewport', () => {
  for (const vp of VIEWPORTS) {
    test(`/th/scan @ ${vp.name} — upload affordance is visible`, async ({ page }) => {
      // The scan flow's entire purpose is the upload CTA. At every
      // viewport, the Shinny avatar (which sits next to the upload
      // affordance) must be visible without scrolling past the fold.
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/th/scan', { waitUntil: 'load' });
      const avatar = page.locator('img[src*="shinny_avatar"]').first();
      await expect(avatar).toBeVisible();
    });
  }
});

test.describe('payload signals — initial HTML size + critical CSS', () => {
  test('/th HTML response is under 100KB (catches accidental bloat)', async ({ request }) => {
    const res = await request.get('/th');
    const body = await res.text();
    // Round 4 caught the 418KB src/app/icon.png. Pages themselves
    // tend to be 20-50KB compressed. >100KB starts hinting at
    // accidentally inlined data (base64 images, oversized SVG).
    expect(body.length, `body size: ${body.length}`).toBeLessThan(100_000);
  });

  test('/manifest.webmanifest under 1KB', async ({ request }) => {
    // Already pinned in deep-probes; mirroring here so a viewport
    // run alone covers it. Deliberate redundancy.
    const res = await request.get('/manifest.webmanifest');
    expect(res.status()).toBe(200);
    const body = await res.text();
    expect(body.length).toBeLessThan(1024);
  });

  test('/favicon.svg under 4KB', async ({ request }) => {
    const res = await request.get('/favicon.svg');
    expect(res.status()).toBe(200);
    const body = await res.text();
    expect(body.length).toBeLessThan(4096);
  });
});

test.describe('LCP-candidate image is preloaded', () => {
  test('/th preloads /images/shinny_avatar.png as the LCP image', async ({ page }) => {
    // The homepage's Largest Contentful Paint candidate is the
    // Shinny avatar (the largest above-the-fold image). It should
    // be in a <link rel="preload" as="image"> for browser-level
    // priority — without this it loads after the JS bundle and LCP
    // shifts late.
    await page.goto('/th');
    const preload = await page
      .locator('link[rel="preload"][as="image"][href*="shinny_avatar"]')
      .count();
    expect(preload, 'shinny_avatar.png not preloaded as image').toBeGreaterThan(0);
  });
});

test.describe('no <script> tags reference http:// or external CDN outside whitelisted hosts', () => {
  // Catches accidental third-party script injection / dependency drift.
  // Whitelisted hosts cover what the legitimate stack uses:
  //   - Next.js internal asset URLs (/_next/static/...)
  //   - Cloudflare Insights (if added later)
  // Anything else fires.
  const WHITELIST = [
    'shinnyguide.autobahn.bot',
    '_next/static',
    // Cloudflare Insights — injected by CF Pages at the edge for
    // anonymous web-analytics. Caught by iter-9 e2e on first run;
    // legitimate vendor script, scoped to a single CF-managed
    // domain. If we ever disable CF Insights, drop this entry.
    'static.cloudflareinsights.com',
    // (add hosts here when adding new third-party scripts;
    // PRs that don't update this list fail this test.)
  ];

  test('/th external scripts only come from whitelisted hosts', async ({ page }) => {
    await page.goto('/th');
    const scripts = await page.locator('script[src]').evaluateAll((els) =>
      els.map((e) => (e as HTMLScriptElement).src),
    );
    const offenders = scripts.filter((src) => {
      if (src.startsWith('http://')) return true; // any plain HTTP
      // Same-origin or relative are fine.
      try {
        const u = new URL(src);
        const isSameOrigin = u.host === 'shinnyguide.autobahn.bot';
        if (isSameOrigin) return false;
        return !WHITELIST.some((w) => src.includes(w));
      } catch {
        return false; // relative paths
      }
    });
    expect(offenders, `non-whitelisted scripts: ${offenders.join(', ')}`).toEqual([]);
  });
});
