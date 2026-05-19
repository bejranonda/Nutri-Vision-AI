import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { Inter, Prompt, Plus_Jakarta_Sans } from "next/font/google";
import "../globals.css";
import type { Metadata } from 'next';
import { logger } from '@/lib/logger';

const inter = Inter({ subsets: ["latin"], variable: '--font-inter' });
const prompt = Prompt({ subsets: ["thai", "latin"], weight: ["300", "400", "500", "600", "700"], variable: '--font-prompt' });
const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: '--font-jakarta' });

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
    <html lang={locale} className={`${inter.variable} ${prompt.variable} ${jakarta.variable}`}>
      <body className={`${inter.className} antialiased`}>
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
