import type { MetadataRoute } from 'next';
import { locales } from '@/lib/i18n-config';

/**
 * Sitemap — served at `/sitemap.xml`.
 *
 * Bug-hunt May 2026 UX-audit round 3: `/sitemap.xml` returned 404 from
 * production, hurting SEO discoverability across our four locales.
 * Search engines now have to guess which `/th/scan` vs `/en/scan` vs
 * `/de/scan` is the canonical form (the answer is "all four, with
 * `hreflang` alternates pointing at each other"). Without a sitemap,
 * discovery relies on the homepage's internal links plus whatever
 * Googlebot happens to crawl naturally.
 *
 * Next.js App Router serves this file via the `sitemap.{ts,js}`
 * convention. Default-exported function returns `MetadataRoute.Sitemap`.
 *
 * Routes included
 *   The public surface: `/`, `/scan`, `/demo`, `/pricing`, `/recipes`,
 *   `/login`. Each locale gets its own URL with the others listed as
 *   `alternates.languages` so search engines understand they're
 *   translations of the same page (not duplicates).
 *
 * Routes EXCLUDED
 *   - `/dashboard`, `/chat`: require auth; indexing the URL would point
 *     search users at a redirect-to-login experience, which is worse
 *     than not appearing at all.
 *   - `/admin/*`: admin console — never appropriate to index.
 *   - `/api/*`: never user-facing.
 *   - Locale roots without trailing path (e.g. `/th`): redundant with
 *     `/` once `alternates.languages` is present; the bare-root entry
 *     is enough.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://shinnyguide.autobahn.bot';
  const publicPaths = ['', '/scan', '/demo', '/pricing', '/recipes', '/login'];

  // Per-path priority signals the relative importance to crawlers.
  // The home page and scan flow are the entry surfaces; pricing/login
  // are secondary; demo/recipes are content depth.
  const priority: Record<string, number> = {
    '': 1.0,
    '/scan': 1.0,
    '/demo': 0.8,
    '/pricing': 0.7,
    '/recipes': 0.6,
    '/login': 0.5,
  };

  const now = new Date();

  return publicPaths.map((path) => ({
    url: `${base}/${locales[0]}${path}`, // canonical: Thai (the primary launch locale)
    lastModified: now,
    changeFrequency: 'weekly' as const,
    priority: priority[path] ?? 0.5,
    alternates: {
      languages: Object.fromEntries(
        locales.map((locale) => [locale, `${base}/${locale}${path}`]),
      ),
    },
  }));
}
