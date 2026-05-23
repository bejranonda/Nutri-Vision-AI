'use client';

/**
 * /[locale]/recipes — placeholder page for the recipes feature.
 *
 * Round-7 UX-audit (subagent #5) called this "the most jarring
 * page" — bare "coming soon" text, no Shinny voice, no brand-mark
 * preload, no CTA out. Read like a 503 instead of a friendly tease.
 *
 * Iter 4 redesign:
 *   - Persistent SiteHeader at the top (consistency with iter 3).
 *   - Shinny-voiced empty-state copy that acknowledges the missing
 *     feature without sounding broken: "Shinny's curating healthy
 *     Thai recipes for you — while we cook those up, want to scan
 *     today's meal?"
 *   - Primary CTA back to /scan so users don't dead-end. Uses the
 *     canonical `home.cta` value ("Start your scan" / "เริ่มสแกนเลย")
 *     for cross-page tone consistency (iter 2).
 *
 * When the real recipes feature ships, replace this file's body —
 * the SiteHeader scaffold stays.
 */
import { useTranslations, useLocale } from 'next-intl';
import Link from 'next/link';
import { BookOpen, Scan, ChevronRight } from 'lucide-react';
import SiteHeader from '@/components/SiteHeader';

export default function RecipesPage() {
    const tRecipes = useTranslations('recipes');
    const tHome = useTranslations('home');
    const locale = useLocale();

    return (
        <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-brand-primary-50 via-white to-brand-secondary-50">
            <div className="absolute top-0 -left-1/4 w-1/2 h-1/2 bg-brand-primary-400/20 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-float pointer-events-none"></div>
            <div className="absolute -bottom-1/4 right-1/4 w-1/2 h-1/2 bg-brand-secondary-400/20 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-float pointer-events-none" style={{ animationDelay: '2s' }}></div>

            <SiteHeader locale={locale} />

            <main className="container mx-auto px-4 py-12 relative z-10 flex items-center justify-center min-h-[60vh]">
                <div className="backdrop-blur-md bg-white/80 rounded-3xl p-8 md:p-12 max-w-lg w-full shadow-glass text-center transform hover:-translate-y-2 transition-transform duration-300">
                    <div className="w-20 h-20 mx-auto bg-gradient-to-br from-brand-primary-400 to-brand-secondary-400 rounded-3xl flex items-center justify-center shadow-brand mb-6">
                        <BookOpen className="text-white w-10 h-10" />
                    </div>
                    <h1 className="text-3xl md:text-4xl font-black bg-clip-text text-transparent bg-gradient-to-r from-brand-primary-500 to-brand-secondary-500 mb-4">
                        {tRecipes('placeholder_title')}
                    </h1>
                    <p className="text-gray-600 text-base md:text-lg mb-8">
                        {tRecipes('placeholder_body')}
                    </p>
                    <Link
                        href={`/${locale}/scan`}
                        className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-brand-primary-400 to-brand-secondary-400 text-white text-lg font-bold rounded-2xl hover:scale-105 transition-all shadow-brand-lg"
                    >
                        <Scan className="w-5 h-5" />
                        {tHome('cta')}
                        <ChevronRight className="w-5 h-5" />
                    </Link>
                </div>
            </main>
        </div>
    );
}
