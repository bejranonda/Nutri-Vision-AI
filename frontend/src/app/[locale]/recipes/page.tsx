'use client';

import { useTranslations, useLocale } from 'next-intl';
import Link from 'next/link';
import { ArrowLeft, BookOpen } from 'lucide-react';
import LanguageSwitcher from '@/components/LanguageSwitcher';

export default function RecipesPage() {
    const t = useTranslations('nav');
    const tCommon = useTranslations('common');
    const tSoon = useTranslations('coming_soon');
    const locale = useLocale();

    return (
        <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-brand-primary-50 via-white to-brand-secondary-50 flex flex-col items-center justify-center p-4">
            <div className="absolute top-0 -left-1/4 w-1/2 h-1/2 bg-brand-primary-400/20 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-float"></div>
            <div className="absolute -bottom-1/4 right-1/4 w-1/2 h-1/2 bg-brand-secondary-400/20 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-float" style={{ animationDelay: '2s' }}></div>

            {/* Language Switcher */}
            <div className="absolute top-4 right-4 z-20">
                <LanguageSwitcher currentLocale={locale} />
            </div>

            <div className="z-10 backdrop-blur-md bg-white/80 rounded-3xl p-8 md:p-12 max-w-lg w-full mx-auto shadow-glass text-center transform hover:-translate-y-2 transition-transform duration-300">
                <div className="w-20 h-20 mx-auto bg-gradient-to-br from-brand-primary-400 to-brand-secondary-400 rounded-3xl flex items-center justify-center shadow-brand mb-6">
                    <BookOpen className="text-white w-10 h-10" />
                </div>
                <h1 className="text-4xl font-black bg-clip-text text-transparent bg-gradient-to-r from-brand-primary-500 to-brand-secondary-500 mb-4">
                    {t('recipes')}
                </h1>
                <p className="text-gray-600 text-lg mb-8">
                    {tSoon('recipes')}
                </p>
                <Link
                    href={`/${locale}`}
                    className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-brand-primary-400 to-brand-secondary-400 text-white font-bold rounded-xl hover:shadow-brand-lg transition-all"
                >
                    <ArrowLeft className="w-5 h-5" /> {tCommon('back_to_home')}
                </Link>
            </div>
        </div>
    );
}
