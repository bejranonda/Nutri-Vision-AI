import type { MetadataRoute } from 'next';

/**
 * PWA manifest — served at `/manifest.webmanifest`.
 *
 * Bug-hunt May 2026 UX-audit round 3: `/manifest.json` and
 * `/manifest.webmanifest` both returned 404 from production. The app is
 * mobile-first ("ลองอัปโหลดรูปอาหารดูสิ — Try uploading a food photo"
 * is the home CTA, and the scan flow opens the device camera) but
 * users had no "Add to Home Screen" install path because the manifest
 * wasn't being served at all.
 *
 * Next.js App Router serves this file via the `manifest.{ts,js,json}`
 * convention. Default-exported function returns `MetadataRoute.Manifest`.
 *
 * Locale note: we set `lang: 'th'` because Thai is the primary
 * launch locale. `start_url: '/'` resolves to the locale-detection
 * redirect, which sends Thai-default browsers to `/th` and others
 * to `/en` (etc.) per `src/middleware.ts`. The display name stays
 * English to match the Apple/Google "App Library" convention of
 * Latin-script names — the in-app strings are localized regardless.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Shinny Guide — Smart Food Sequencing',
    short_name: 'Shinny Guide',
    description:
      'AI-powered nutrition coach: scan a meal, get a personalised "Veggies → Protein → Carbs → Sweets" eating sequence to flatten your blood-sugar curve.',
    lang: 'th',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    theme_color: '#ec7064', // brand-primary-400 — matches the scan-button gradient
    background_color: '#fff5f5', // brand-primary-50 — matches the auth-card background
    categories: ['food', 'health', 'lifestyle', 'medical'],
    // Icons reference files that actually serve from /public/. The
    // earlier /icon.png + /apple-icon.png (App Router convention from
    // src/app/) 404'd in production — PR #40 swapped those for paths
    // Cloudflare Pages serves reliably. `/favicon.svg` is the 1KB
    // brand mark; `/images/shinny_avatar.png` is the 640×640 raster
    // already used as the og:image (proven to serve correctly).
    icons: [
      { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml' },
      { src: '/images/shinny_avatar.png', sizes: '640x640', type: 'image/png' },
      { src: '/images/shinny_avatar.png', sizes: '640x640', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
