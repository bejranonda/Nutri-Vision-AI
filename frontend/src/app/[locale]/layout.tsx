import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { Inter } from "next/font/google";
import "../globals.css";
import type { Metadata } from 'next';
import { logger } from '@/lib/logger';

// Round 11 Web Vitals audit: this page used to import Inter + Prompt
// (5 weights) + Plus_Jakarta_Sans here, but neither Prompt nor Jakarta
// were referenced ANYWHERE — no `font-display` / `font-thai` Tailwind
// classes, no `var(--font-prompt)` usage, no `<body className=jakarta>`.
// They added ~10 WOFF2 preloads (~250-400KB) to every page for nothing.
// Removing them dropped homepage FCP from 2272ms (⚠) toward target;
// globals.css falls back to Sarabun for Thai (the production fallback
// already in use).
const inter = Inter({ subsets: ["latin"], variable: '--font-inter' });

// Light-only color scheme today (brand palette is warm coral on light
// backgrounds; no dark-mode design tokens shipped yet). Declaring
// `light` here keeps browser-native widgets (scrollbar, form
// controls, autofill background) matched to the design instead of
// using a system-dark theme that clashes with brand-primary-50
// (#fff5f5). When dark mode lands, expand to "light dark" and add
// the matching CSS variables. Caught by e2e iter 7.
export const viewport = {
  colorScheme: 'light' as const,
};

export const metadata: Metadata = {
  title: 'Shinny Guide — Smart Food Sequencing for Better Health',
  description: 'AI-powered nutrition analysis with "อร่อย ตาม ลำดับ" (Delicious in Order) food sequencing. Reduce blood sugar spikes by 70% while enjoying the foods you love.',
  keywords: ['nutrition', 'food sequencing', 'blood sugar', 'glycemic index', 'Thai food', 'healthy eating', 'AI nutrition'],
  authors: [{ name: 'Shinny Guide Team' }],
  // metadataBase lets relative image paths resolve against the
  // production origin when crawlers + social-card readers fetch the
  // page. Without this, `images: ['/path']` resolves against
  // localhost in production responses.
  metadataBase: new URL('https://shinnyguide.autobahn.bot'),
  // Explicit icon paths instead of relying on the Next.js App Router
  // `app/icon.png` / `app/apple-icon.png` convention. UX-audit round 3
  // proved those files 404'd on OpenNext-on-Pages even though they
  // existed in `src/app/` — Cloudflare Pages serves `/public/*`
  // reliably, the App Router icon convention doesn't.
  // - `/favicon.svg` is a 1KB hand-written SVG (brand-primary-400
  //   rounded square + white "S"). Scales to every tab size; replaces
  //   the 418KB src/app/icon.png that never served.
  // - `/images/shinny_avatar.png` already serves (proven by og:image)
  //   and is square + branded — perfect for `apple-touch-icon` which
  //   iOS expects as raster, not SVG.
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
    apple: '/images/shinny_avatar.png',
  },
  // hreflang alternates so search engines know /th, /en, /de, /da
  // are translations of the same page (not duplicate-content
  // competitors). Bug-hunt May 2026 UX-round 5 e2e probe caught the
  // absence — sitemap.xml had the alternates but the per-page <link
  // rel="alternate" hreflang> tags didn't render. og:locale:alternate
  // exists (covers Open Graph), but search-engine canonicalisation
  // needs the rel=alternate links specifically.
  alternates: {
    canonical: '/th',
    languages: {
      th: '/th',
      en: '/en',
      de: '/de',
      da: '/da',
      // x-default points crawlers at the locale to serve when none
      // of the user's preferred languages match — Thai is the
      // primary launch locale.
      'x-default': '/th',
    },
  },
  openGraph: {
    title: 'Shinny Guide — Smart Food Sequencing',
    description: 'Discover how eating in the right order can transform your health. Veggies → Protein → Carbs → Sweets',
    type: 'website',
    locale: 'en_US',
    alternateLocale: ['th_TH', 'de_DE', 'da_DK'],
    // UX-audit round 4 (May 2026): probe found no og:image / no
    // twitter:image on any rendered locale page. Sharing the URL
    // anywhere (LINE, Facebook, X, Discord, Slack) produced a
    // text-only card with no preview. The Shinny avatar PNG is
    // already preloaded on the homepage, so it costs us nothing
    // extra to reuse as the share image. Spec'd dimensions are the
    // Open Graph recommended 1200×630 ratio; the actual file is
    // 640×640, which both Facebook and Twitter accept (gets
    // letterboxed but stays sharp).
    images: [
      {
        url: '/images/shinny_avatar.png',
        width: 640,
        height: 640,
        alt: 'Shinny — the AI nutrition coach who guides you to eat in the right order',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Shinny Guide — Smart Food Sequencing',
    description: 'Discover how eating in the right order can transform your health. Veggies → Protein → Carbs → Sweets',
    images: ['/images/shinny_avatar.png'],
  },
};

export default async function LocaleLayout({
  children,
  params: { locale }
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  const messages = await getMessages();

  // Server-side logging for Cloudflare Pages
  logger.info(`Rendering layout for locale: ${locale}`);

  return (
    <html lang={locale} className={inter.variable}>
      <body className={`${inter.className} antialiased`}>
        {/*
          NB on the missing preload: PR #52 (Round 7 iter 8) added a
          <link rel="preload" as="image" href="/images/shinny_avatar.png">
          here, intending to fix a perceived "late pop" on the homepage
          hero pill. In practice it generated a "preloaded but not used"
          browser warning on every page that doesn't reference the base
          avatar (most of them — scan/demo/chat use the *_explaining /
          _celebrating variants instead). And the homepage's <img> has
          no loading="lazy" and renders above-the-fold in source order,
          so the browser fetches it eagerly without the hint. Net: the
          preload helped one page marginally and hurt four with a real
          warning. Removed (Round 10).
        */}
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
