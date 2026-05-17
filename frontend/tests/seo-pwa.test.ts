/**
 * Tests for `src/app/manifest.ts` and `src/app/sitemap.ts` — the two
 * SEO/PWA route handlers added in the round-3 UX audit.
 *
 * Bug-hunt May 2026 round 3 probed for `/manifest.json`,
 * `/manifest.webmanifest`, and `/sitemap.xml`. All three returned
 * 404 from production. The app is mobile-first (the scan flow opens
 * the device camera) but users had no Add-to-Home-Screen path and
 * search engines had no canonical-vs-alternate signal across our
 * four locales.
 *
 * These tests pin the response shape so a future contributor can't
 * silently break "this page is installable" or "search engines know
 * about the Thai/English/German/Danish variants".
 */
import { describe, it, expect } from 'vitest';
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
