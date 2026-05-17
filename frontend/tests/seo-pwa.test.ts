/**
 * Tests for `src/app/manifest.ts`, `src/app/sitemap.ts`, and the SEO
 * metadata in `src/app/[locale]/layout.tsx` — the SEO/PWA surfaces
 * added in the round-3 and round-4 UX audits.
 *
 * Bug-hunt May 2026 round 3 probed for `/manifest.json`,
 * `/manifest.webmanifest`, and `/sitemap.xml`. All three returned
 * 404 from production. Round 4 then probed the rendered HTML and
 * found no `og:image` / `twitter:image` on any locale page —
 * sharing the URL produced text-only cards with no preview, plus a
 * fully-English 404 page for Thai-locale URLs.
 *
 * These tests pin the response/source shape so a future contributor
 * can't silently break "this page is installable", "share previews
 * have an image", "search engines see all four locales", or "the
 * 404 page shows in the user's language".
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import manifest from '@/app/manifest';
import sitemap from '@/app/sitemap';
import { locales } from '@/lib/i18n-config';

describe('PWA manifest', () => {
  const m = manifest();

  it('has the brand name and short_name in the expected slot', () => {
    expect(m.name).toMatch(/Shinny Guide/);
    expect(m.short_name).toBeDefined();
    // App-launcher labels truncate ~12 chars — keep short_name tight.
    expect(m.short_name!.length).toBeLessThanOrEqual(20);
  });

  it('declares standalone display + portrait orientation for the mobile-first scan flow', () => {
    expect(m.display).toBe('standalone');
    expect(m.orientation).toBe('portrait');
  });

  it('uses the brand colour tokens for theme + background', () => {
    // theme_color matches the scan-button gradient anchor
    // (brand-primary-400 = #ec7064 per globals.css).
    expect(m.theme_color).toBe('#ec7064');
    // background_color matches the auth-card background
    // (brand-primary-50 = #fff5f5).
    expect(m.background_color).toBe('#fff5f5');
  });

  it('references at least one icon entry', () => {
    expect(Array.isArray(m.icons)).toBe(true);
    expect(m.icons!.length).toBeGreaterThan(0);
    for (const icon of m.icons!) {
      expect(icon.src).toMatch(/^\//); // must be absolute path
      expect(icon.sizes).toBeDefined();
    }
  });

  it('start_url is the root so locale detection runs', () => {
    expect(m.start_url).toBe('/');
  });
});

describe('Sitemap', () => {
  const entries = sitemap();

  it('includes the home + scan entries (the highest-priority surfaces)', () => {
    const urls = entries.map((e) => e.url);
    // Home is the bare locale root (no path suffix).
    expect(urls.some((u) => u.endsWith(`/${locales[0]}`))).toBe(true);
    expect(urls.some((u) => u.endsWith(`/${locales[0]}/scan`))).toBe(true);
  });

  it('excludes auth-gated and admin routes', () => {
    const urls = entries.map((e) => e.url).join(' ');
    // /dashboard and /chat require auth — indexing them points search
    // users at a redirect-to-login.
    expect(urls).not.toContain('/dashboard');
    expect(urls).not.toContain('/chat');
    // /admin is never appropriate to index.
    expect(urls).not.toContain('/admin');
    // /api/* is never user-facing.
    expect(urls).not.toContain('/api/');
  });

  it('every entry has hreflang alternates covering all 4 locales', () => {
    // Without this, search engines don't know /th/scan and /en/scan
    // are the same page in different languages — they'd treat them as
    // duplicate-content competitors.
    for (const entry of entries) {
      expect(entry.alternates).toBeDefined();
      expect(entry.alternates!.languages).toBeDefined();
      const langs = Object.keys(entry.alternates!.languages!);
      for (const locale of locales) {
        expect(langs).toContain(locale);
      }
    }
  });

  it('uses absolute URLs against the production host', () => {
    // Relative URLs in sitemaps are technically allowed but many
    // crawlers handle them inconsistently. Absolute is the safe form.
    for (const entry of entries) {
      expect(entry.url).toMatch(/^https:\/\/shinnyguide\.autobahn\.bot\//);
    }
  });
});

describe('locale layout metadata — Open Graph + Twitter share previews', () => {
  const source = readFileSync(
    resolve(__dirname, '../src/app/[locale]/layout.tsx'),
    'utf8',
  );

  it('declares an og:image so social shares render a preview card', () => {
    // Bug-hunt May 2026 round 4: rendered HTML had no og:image on
    // any locale, so LINE/FB/X/Discord all rendered text-only cards
    // when users shared a scan URL. Open Graph spec recommends
    // 1200×630; our /images/shinny_avatar.png is 640×640 — both
    // Facebook and Twitter accept (gets letterboxed but stays sharp).
    expect(source).toMatch(/openGraph[\s\S]*?images:\s*\[/);
    expect(source).toContain('/images/shinny_avatar.png');
  });

  it('declares twitter:card and twitter:image', () => {
    expect(source).toMatch(/twitter:\s*\{[\s\S]*?card:\s*'summary_large_image'/);
    expect(source).toMatch(/twitter:\s*\{[\s\S]*?images:/);
  });

  it('sets metadataBase so relative image paths resolve against prod origin', () => {
    // Without metadataBase, `images: ['/path']` resolves against
    // localhost when crawlers fetch the page in production. The og
    // tag would then contain `http://localhost/path` which fails to
    // load for actual users.
    expect(source).toMatch(/metadataBase:\s*new URL\('https:\/\/shinnyguide\.autobahn\.bot'\)/);
  });
});

describe('locale-aware 404 page', () => {
  const source = readFileSync(
    resolve(__dirname, '../src/app/[locale]/not-found.tsx'),
    'utf8',
  );

  it('uses next-intl `useTranslations` from the `not_found` namespace', () => {
    // Bug-hunt May 2026 round 4: probing /th/this-route-does-not-exist
    // returned the default Next.js 404 with English title and zero
    // Thai content. The localised page reads `not_found.*` keys per
    // user locale.
    expect(source).toContain("useTranslations('not_found')");
  });

  it("references all five not_found keys we added to the locale JSONs", () => {
    for (const key of ['title', 'headline', 'subtitle', 'back_to_home', 'start_scan']) {
      expect(source).toContain(`t('${key}')`);
    }
  });

  it('offers both a home link and a scan link (not a dead-end)', () => {
    // A 404 page that only says "page not found" without a CTA is a
    // dead-end. We give the user two paths back into the app —
    // home for general recovery, scan for the primary feature.
    expect(source).toMatch(/href=\"\/\"/);
    expect(source).toMatch(/href=\"\/scan\"/);
  });
});

describe('locale JSONs carry the not_found namespace', () => {
  // Lock the cross-locale completeness even though check:i18n already
  // walks every t('...') call site. The not_found keys are
  // referenced in `not-found.tsx`, but a defensive direct check here
  // catches the case where someone deletes the namespace from
  // (say) th.json without touching the page.
  for (const locale of locales) {
    it(`messages/${locale}.json has all not_found.* keys`, () => {
      const path = resolve(__dirname, `../src/messages/${locale}.json`);
      const data = JSON.parse(readFileSync(path, 'utf8'));
      expect(data.not_found).toBeDefined();
      for (const key of ['title', 'headline', 'subtitle', 'back_to_home', 'start_scan']) {
        expect(data.not_found[key]).toBeDefined();
        expect(String(data.not_found[key]).trim().length).toBeGreaterThan(0);
      }
    });
  }
});
