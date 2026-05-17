/**
 * GET /api/sitemap → exposed publicly at /sitemap.xml via a
 * `next.config.js` rewrite. Multi-locale sitemap as an explicit
 * route handler.
 *
 * History (so the next person doesn't re-discover the bear traps):
 *
 *   - PR #34 used Next.js's `app/sitemap.ts` convention (returns
 *     `MetadataRoute.Sitemap`). Works on stock Next.js + Vercel but
 *     silently 404'd on OpenNext-on-Cloudflare-Pages. No build error,
 *     no log entry, just a 404 in production.
 *
 *   - PR #36 moved to `app/sitemap.xml/route.ts` — an explicit GET
 *     at a dotted folder name. ALSO 404'd on production. Suspected
 *     collision: Next.js's `sitemap.{js,ts,xml,jsx,tsx}` convention
 *     recognises the basename `sitemap` and the dotted folder
 *     `sitemap.xml/` confused either Next.js or the adapter into
 *     treating it as a malformed convention file.
 *
 *   - PR #37 (this file) moves to `/api/sitemap` — a plain API route,
 *     no dotted folder, no convention collision — and adds a
 *     `next.config.js` rewrite so the public-facing URL is still
 *     `/sitemap.xml`. API routes are the most thoroughly-tested
 *     surface in the adapter; this is the conservative path.
 *
 * Trade-offs vs `MetadataRoute.Sitemap`:
 *   + Lose: typed return value.
 *   + Gain: explicit XML construction, predictable serving, full
 *     control over Content-Type header.
 */
import { locales } from '@/lib/i18n-config';

// Public surfaces to advertise. Same list as the prior sitemap.ts.
// Auth-gated routes (`/dashboard`, `/chat`, `/admin/*`) deliberately
// excluded — indexing them points search users at a redirect-to-login.
const PUBLIC_PATHS = ['', '/scan', '/demo', '/pricing', '/recipes', '/login'] as const;
const BASE = 'https://shinnyguide.autobahn.bot';

// Crawler priority hints. Home + scan are the entry surfaces; pricing
// and login are secondary; demo and recipes are content depth.
const PRIORITY: Record<string, number> = {
  '': 1.0,
  '/scan': 1.0,
  '/demo': 0.8,
  '/pricing': 0.7,
  '/recipes': 0.6,
  '/login': 0.5,
};

function xmlEscape(s: string): string {
  // Sitemap URLs in our case are alphanumeric + `/` + locale codes,
  // but we escape defensively in case a path ever contains `&` (which
  // breaks XML if unescaped) or any of the other entity-required chars.
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

export async function GET(): Promise<Response> {
  const now = new Date().toISOString();

  // Build one <url> entry per public path. The canonical entry uses
  // the primary locale (Thai); every other locale is listed as a
  // hreflang alternate so search engines know they're translations
  // of the same content, not duplicates.
  const entries = PUBLIC_PATHS.map((path) => {
    const canonical = `${BASE}/${locales[0]}${path}`;
    const alternates = locales
      .map(
        (locale) =>
          `    <xhtml:link rel="alternate" hreflang="${locale}" href="${xmlEscape(`${BASE}/${locale}${path}`)}"/>`,
      )
      .join('\n');
    return `  <url>
    <loc>${xmlEscape(canonical)}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${PRIORITY[path] ?? 0.5}</priority>
${alternates}
  </url>`;
  }).join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${entries}
</urlset>
`;

  return new Response(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      // Sitemaps benefit from short caching — search engines refetch
      // periodically, so freshness matters more than throughput.
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
