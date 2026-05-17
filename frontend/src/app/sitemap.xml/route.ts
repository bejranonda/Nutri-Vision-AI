/**
 * GET /sitemap.xml — multi-locale sitemap as an explicit route handler.
 *
 * History: PR #34 used Next.js's `app/sitemap.ts` convention (returns
 * `MetadataRoute.Sitemap`). That works on stock Next.js + Vercel but
 * **silently 404s on the OpenNext-on-Cloudflare-Pages adapter** —
 * deploy-validated round 3 confirmed `/manifest.webmanifest` (same
 * convention family) returned 200 while `/sitemap.xml` returned 404.
 * No build error, no log entry, just a 404 in production.
 *
 * Rather than spend more time diagnosing the adapter's
 * convention-handling differences, this file bypasses the convention
 * entirely. `route.ts` is the lowest-common-denominator handler in
 * App Router — explicit `GET` returns a `Response` with whatever body
 * we want. Always works on every adapter.
 *
 * The trade-off: we lose Next.js's typed `MetadataRoute.Sitemap`
 * helper. In exchange we get explicit XML construction plus a
 * `Content-Type: application/xml` header. Net win.
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
