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

  it('icons point at /public/ paths that actually serve (not the broken App Router convention)', () => {
    // PR #40 specifically: the manifest used to reference /icon.png
    // and /apple-icon.png (Next.js App Router convention from
    // src/app/), but those 404'd in production on OpenNext-on-Pages.
    // Swapped for paths under /public/* which Cloudflare Pages serves
    // reliably. A future contributor who reverts breaks the PWA
    // install flow's icon — caught here.
    const srcs = m.icons!.map((i) => i.src);
    expect(srcs).toContain('/favicon.svg');
    expect(srcs.some((s) => s.startsWith('/images/'))).toBe(true);
    // None of the icons may point at the broken convention paths.
    expect(srcs).not.toContain('/icon.png');
    expect(srcs).not.toContain('/apple-icon.png');
  });

  it('favicon.svg file actually exists in /public/', () => {
    // Static-file existence check — if someone deletes the SVG
    // without updating the manifest, the install flow's icon breaks.
    const svgPath = resolve(__dirname, '../public/favicon.svg');
    const svg = readFileSync(svgPath, 'utf8');
    // Must be a valid SVG envelope. Defensive — catches the case
    // where the file gets accidentally cleared or corrupted.
    expect(svg).toMatch(/^<svg[\s\S]*<\/svg>\s*$/);
    expect(svg).toContain('viewBox="0 0 256 256"');
    expect(svg).toContain('#ec7064'); // brand-primary-400 — design contract
  });

  it('start_url is the root so locale detection runs', () => {
    expect(m.start_url).toBe('/');
  });
});

describe('Sitemap (static file at /public/sitemap.xml)', () => {
  // History of this surface:
  //   PR #34: app/sitemap.ts (Next.js convention)               → 404 on OpenNext-on-Pages
  //   PR #36: app/sitemap.xml/route.ts (dotted folder)          → 404 (collides with sitemap.* convention)
  //   PR #37: app/api/sitemap/route.ts + next.config rewrites() → /api/sitemap works, rewrite doesn't fire
  //   PR #38: static /public/sitemap.xml                        → ✓ bulletproof
  //
  // The static-file path loses the dynamic generation but gains
  // predictable serving. Update the file by hand (or via the
  // pre-build script) when adding a locale or public path.
  const xmlPath = resolve(__dirname, '../public/sitemap.xml');
  const xmlBody = readFileSync(xmlPath, 'utf8');

  it('serves a well-formed sitemap envelope', () => {
    expect(xmlBody).toMatch(/^<\?xml version="1\.0"/);
    expect(xmlBody).toContain('<urlset');
    expect(xmlBody).toContain('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"');
    expect(xmlBody).toContain('xmlns:xhtml="http://www.w3.org/1999/xhtml"');
    expect(xmlBody).toMatch(/<\/urlset>\s*$/);
  });

  it('includes the home + scan entries (the highest-priority surfaces)', () => {
    expect(xmlBody).toMatch(/<loc>https:\/\/shinnyguide\.autobahn\.bot\/th<\/loc>/);
    expect(xmlBody).toMatch(/<loc>https:\/\/shinnyguide\.autobahn\.bot\/th\/scan<\/loc>/);
  });

  it('excludes auth-gated and admin routes', () => {
    expect(xmlBody).not.toContain('/dashboard');
    expect(xmlBody).not.toContain('/chat');
    expect(xmlBody).not.toContain('/admin');
    expect(xmlBody).not.toContain('/api/');
  });

  it('every entry has hreflang alternates covering all 4 locales', () => {
    for (const locale of locales) {
      expect(xmlBody).toContain(`hreflang="${locale}"`);
    }
  });

  it('uses absolute URLs against the production host', () => {
    const locs = Array.from(xmlBody.matchAll(/<loc>([^<]+)<\/loc>/g)).map((m) => m[1]);
    expect(locs.length).toBeGreaterThan(0);
    for (const loc of locs) {
      expect(loc).toMatch(/^https:\/\/shinnyguide\.autobahn\.bot\//);
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

  it('declares explicit icon paths pointing at /public/ files (not the App Router convention)', () => {
    // Bug-hunt May 2026 round 3 caught that `src/app/icon.png` and
    // `src/app/apple-icon.png` 404'd in production on OpenNext-on-
    // Pages even though the files existed. PR #40 swapped the
    // metadata to point at `/public/` paths which serve reliably.
    // Reverting to the convention re-introduces the broken-tab-icon
    // bug, so we lock the explicit paths here.
    expect(source).toMatch(/icons:\s*\{[\s\S]*?icon:\s*'\/favicon\.svg'/);
    expect(source).toMatch(/icons:\s*\{[\s\S]*?apple:\s*'\/images\/shinny_avatar\.png'/);
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
    //
    // Both hrefs MUST carry the locale prefix. Bare `/scan` doesn't
    // match the i18n middleware matcher (`['/', '/(th|en|de|da)/:path*']`)
    // so it 404'd again — turning the anti-dead-end page INTO a
    // dead-end. Bare `/` dropped a non-default locale back to Thai.
    expect(source).toMatch(/href=\{`\/\$\{locale\}`\}/);
    expect(source).toMatch(/href=\{`\/\$\{locale\}\/scan`\}/);
    // Guard against the bare (locale-less) forms creeping back in.
    expect(source).not.toMatch(/href=\"\/scan\"/);
    expect(source).not.toMatch(/href=\"\/\"/);
  });
});

describe('locale catch-all forces the [locale] segment to enter on unknown paths', () => {
  // Round 4 follow-up: shipping `app/[locale]/not-found.tsx` alone
  // wasn't enough — OpenNext-on-Pages was short-circuiting to a
  // static 404 fallback before the locale segment ran, so `/th/no-such`
  // still rendered the English framework default with no
  // `<html lang="th">`. Adding `app/[locale]/[...slug]/page.tsx` that
  // calls `notFound()` forces the segment chain to execute; Next.js
  // then finds the closest `not-found.tsx` inside `[locale]/` and
  // renders it with the locale layout's translations + fonts intact.
  //
  // Sibling routes (`/th/scan`, `/th/login`, …) take precedence over
  // the catch-all by Next.js's specificity rules, so this file only
  // fires when no explicit child matches.
  const source = readFileSync(
    resolve(__dirname, '../src/app/[locale]/[...slug]/page.tsx'),
    'utf8',
  );

  it('imports `notFound` from `next/navigation`', () => {
    expect(source).toMatch(/import\s*\{[^}]*\bnotFound\b[^}]*\}\s*from\s*'next\/navigation'/);
  });

  it('calls `notFound()` as the route handler', () => {
    // Body must invoke notFound() — the function whose only job is
    // to trigger Next.js's not-found render path.
    expect(source).toMatch(/notFound\(\)/);
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
