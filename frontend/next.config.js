/** @type {import('next').NextConfig} */
const withNextIntl = require('next-intl/plugin')('./src/i18n.ts');

const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['localhost'],
    formats: ['image/avif', 'image/webp'],
  },
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  /**
   * Security headers applied to every HTML page response.
   *
   * Bug-hunt May 2026 UX-audit round 3: probed the rendered HTML for
   * the standard defence-in-depth headers. The only ones already set
   * (by Cloudflare's edge, not by Next.js) were HSTS and
   * `X-Content-Type-Options: nosniff`. Everything below was missing.
   *
   * Why each one matters even when no concrete attack happened:
   *   - X-Frame-Options: DENY — prevents the site being framed by any
   *     other origin. The app has no iframe-embed use case; deny is
   *     the safest default.
   *   - Referrer-Policy: strict-origin-when-cross-origin — sends the
   *     full URL only to same-origin destinations; sends just the
   *     origin cross-origin. Stops leakage of locale-tagged URLs
   *     (which can carry `?debug=1` etc.) to third-party CDNs.
   *   - Permissions-Policy: camera=(self) microphone=() geolocation=()
   *     — the scan flow uses the camera API; everything else stays
   *     off so a compromised dependency can't quietly call them.
   *
   * Content-Security-Policy is NOT included. CSP would require a full
   * audit of every inline style/script Next.js emits (plus the
   * dev-mode HMR client's `unsafe-eval`). Tracked as a follow-up.
   */
  /**
   * URL rewrite so `/sitemap.xml` lands at `/api/sitemap`.
   *
   * Background: Next.js's `app/sitemap.ts` convention and the
   * subsequent `app/sitemap.xml/route.ts` attempt both 404'd on
   * OpenNext-on-Pages (PR #34 → #36 → this PR). The cause is opaque
   * but tied to Next.js's `sitemap.{js,ts,xml}` special-filename
   * recognition not surviving the adapter's route compilation.
   *
   * Workaround: serve the sitemap from the well-tested `/api/*`
   * surface and rewrite the public-facing URL. Search engines and
   * the robots.txt entry can still link to `/sitemap.xml` — the
   * rewrite is transparent to the client.
   */
  async rewrites() {
    return [
      {
        source: '/sitemap.xml',
        destination: '/api/sitemap',
      },
    ];
  },
  async headers() {
    return [
      {
        // Match every non-API route. API routes already set
        // `Cache-Control: no-store` via `lib/api-response.ts` and
        // don't render HTML, so framing/referrer headers don't apply.
        source: '/((?!api/).*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(self), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()',
          },
        ],
      },
    ];
  },
}

module.exports = withNextIntl(nextConfig);
