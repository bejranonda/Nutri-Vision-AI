/** @type {import('next').NextConfig} */
const withNextIntl = require('next-intl/plugin')('./src/i18n.ts');

// Single source of truth for the displayed app version. Inlined at
// build time so both the client footer and the /api/health endpoint
// read the same string and can't drift from package.json. Previously
// the footer hardcoded "Version 2.1.7" while package.json had moved to
// 2.1.9, and /api/health reported "unknown" because
// process.env.npm_package_version isn't set in the Cloudflare runtime.
const pkg = require('./package.json');

const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_APP_VERSION: pkg.version,
  },
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
   * Content-Security-Policy ships in REPORT-ONLY mode (Round 14).
   * Why report-only: Next.js emits inline scripts (RSC bootstrap) and
   * inline styles (critical CSS), so script/style allow 'unsafe-inline'
   * until a nonce strategy lands — the value of this stage is the
   * ORIGIN allowlist (only self + the Cloudflare Insights beacon may
   * load/connect). Violations surface as console errors in every
   * browser, which our Playwright suites already assert against — the
   * e2e run against the branch preview doubles as the violation scan.
   * Flip to enforcing (drop `-Report-Only`) after a quiet window.
   * Dev-mode HMR needs 'unsafe-eval'; the dev server doesn't apply
   * these production headers paths anyway, and report-only never
   * blocks regardless.
   */
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
          {
            key: 'Content-Security-Policy-Report-Only',
            value: [
              "default-src 'self'",
              // RSC bootstrap + Next inline runtime; nonce strategy is the
              // tracked follow-up that lets us drop 'unsafe-inline'.
              "script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com",
              "style-src 'self' 'unsafe-inline'",
              // data:/blob: — base64 scan thumbnails + canvas previews.
              "img-src 'self' data: blob:",
              "font-src 'self' data:",
              // Beacon POSTs from the CF Insights script.
              "connect-src 'self' https://cloudflareinsights.com https://static.cloudflareinsights.com",
              "worker-src 'self' blob:",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'none'",
            ].join('; '),
          },
        ],
      },
    ];
  },
}

module.exports = withNextIntl(nextConfig);
