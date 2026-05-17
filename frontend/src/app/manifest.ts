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
    // Icons reference the App Router-managed `src/app/icon.png` and
    // `src/app/apple-icon.png`. NOTE: those files currently return
    // 404 in production — tracked as a separate issue. The manifest
    // is still useful as documentation of intended icon sizes and
    // unlocks PWA install flows once the icon serving is fixed.
    icons: [
      { src: '/icon.png', sizes: '640x640', type: 'image/png' },
      { src: '/apple-icon.png', sizes: '640x640', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
