/**
 * Locale-aware 404 page.
 *
 * Next.js App Router convention: a `not-found.tsx` file in any segment
 * is rendered when that segment can't resolve a child route. Placing
 * it under `[locale]/` means any unrecognised path inside a locale
 * (e.g. `/th/nonexistent`) renders in that locale — Thai for Thai
 * visitors, English for English, etc.
 *
 * Bug-hunt May 2026 UX-audit round 4: probing
 * `/th/this-route-does-not-exist` returned Next.js's default 404 with
 * the English title "404: This page could not be found." and zero
 * Thai content. For a Thai-primary app whose entire UX is built on
 * the localised Shinny persona, this broke the locale contract.
 *
 * The Shinny avatar above mirrors the persona pattern used elsewhere
 * (e.g. the 503 error card in `/[locale]/scan`) so the not-found
 * experience reads as "Shinny is sorry the page is missing" rather
 * than "the server has thrown an error". Two CTAs (home + scan)
 * give the user something to do rather than dead-end.
 */
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { Home, Scan } from 'lucide-react';

export default function NotFound() {
  const t = useTranslations('not_found');

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-brand-primary-50 to-white px-6 py-12">
      <div className="max-w-md w-full text-center">
        <Image
          src="/images/shinny_avatar.png"
          alt="Shinny — the nutrition coach"
          width={128}
          height={128}
          className="mx-auto mb-6 drop-shadow-md"
          priority
        />
        <h1 className="text-2xl font-bold text-brand-primary-500 mb-2">
          {t('title')}
        </h1>
        <p className="text-lg font-semibold text-gray-800 mb-3">
          {t('headline')}
        </p>
        <p className="text-gray-600 mb-8">
          {t('subtitle')}
        </p>
        <div className="flex flex-col gap-3">
          <Link
            href="/"
            className="w-full py-3 bg-gradient-to-r from-brand-primary-400 to-brand-secondary-400 text-white font-bold rounded-xl shadow-brand hover:shadow-brand-lg transition-all inline-flex items-center justify-center gap-2"
          >
            <Home className="w-5 h-5" />
            {t('back_to_home')}
          </Link>
          <Link
            href="/scan"
            className="w-full py-3 bg-white border-2 border-brand-primary-400 text-brand-primary-500 font-bold rounded-xl hover:bg-brand-primary-50 transition-all inline-flex items-center justify-center gap-2"
          >
            <Scan className="w-5 h-5" />
            {t('start_scan')}
          </Link>
        </div>
      </div>
    </div>
  );
}
