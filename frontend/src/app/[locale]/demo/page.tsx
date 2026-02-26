'use client';

import { useState, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import Link from 'next/link';
import { ArrowLeft, ChevronRight, PlayCircle, Scan, UserPlus, Sparkles } from 'lucide-react';
import { logger } from '@/lib/logger';

const STEP_KEYS = ['fiber', 'protein', 'carbs', 'sweets'] as const;
const STEP_EMOJIS = ['🥦', '🍗', '🍚', '🍰'];
const STEP_COLORS = ['bg-sequence-fiber', 'bg-sequence-protein', 'bg-sequence-carb', 'bg-sequence-sugar'];

export default function DemoPage() {
    const t = useTranslations('demo');
    const tCommon = useTranslations('common');
    const tMascot = useTranslations('mascot');
    const locale = useLocale();
    const [activeStep, setActiveStep] = useState(0);
    const [showCurve, setShowCurve] = useState(false);

    useEffect(() => {
        logger.trackFeature('Demo Page', 'loading', { locale });
    }, [locale]);

    useEffect(() => {
        const timer = setTimeout(() => setShowCurve(true), 500);
        return () => clearTimeout(timer);
    }, []);

    return (
        <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-brand-primary-50 via-white to-brand-secondary-50">
            {/* Background */}
            <div className="absolute top-0 -left-1/4 w-1/2 h-1/2 bg-brand-primary-400/20 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-float"></div>
            <div className="absolute -bottom-1/4 right-1/4 w-1/2 h-1/2 bg-brand-secondary-400/20 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-float" style={{ animationDelay: '2s' }}></div>
            <div className="absolute top-1/3 right-0 w-1/3 h-1/3 bg-brand-accent-400/15 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-float" style={{ animationDelay: '4s' }}></div>

            {/* Header */}
            <div className="container mx-auto px-4 pt-6 pb-2 relative z-10">
                <Link href={`/${locale}`} className="inline-flex items-center gap-2 px-4 py-2 bg-white/80 backdrop-blur-sm rounded-xl text-gray-600 hover:text-brand-primary-500 transition-colors border border-gray-200">
                    <ArrowLeft className="w-4 h-4" /> {tCommon('back_to_home')}
                </Link>
            </div>

            <div className="container mx-auto px-4 py-8 relative z-10 max-w-5xl">
                {/* Title */}
                <div className="text-center mb-10">
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-brand-primary-100 rounded-full mb-4">
                        <PlayCircle className="w-5 h-5 text-brand-primary-500" />
                        <span className="text-brand-primary-600 font-semibold text-sm">{tMascot('demo_welcome')}</span>
                    </div>
                    <h1 className="text-3xl md:text-5xl font-black bg-clip-text text-transparent bg-gradient-to-r from-brand-primary-500 to-brand-secondary-500 mb-3">
                        {t('title')}
                    </h1>
                    <p className="text-gray-600 text-lg">{t('subtitle')}</p>
                </div>

                {/* Step Navigator */}
                <div className="flex justify-center gap-2 mb-8">
                    {STEP_KEYS.map((_, i) => (
                        <button
                            key={i}
                            onClick={() => setActiveStep(i)}
                            className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl transition-all duration-300 ${activeStep === i
                                ? `${STEP_COLORS[i]} text-white scale-110 shadow-lg`
                                : 'bg-white/80 hover:bg-white shadow-sm'
                                }`}
                        >
                            {STEP_EMOJIS[i]}
                        </button>
                    ))}
                </div>

                {/* Active Step Card */}
                <div className="backdrop-blur-md bg-white/90 rounded-3xl p-8 md:p-10 max-w-3xl mx-auto shadow-glass mb-10 transition-all duration-500">
                    <div className="flex items-start gap-6">
                        <div className={`w-16 h-16 ${STEP_COLORS[activeStep]} rounded-2xl flex items-center justify-center text-3xl shadow-lg flex-shrink-0`}>
                            {STEP_EMOJIS[activeStep]}
                        </div>
                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-xs font-bold uppercase text-gray-400">{t('step_label')} {activeStep + 1}/4</span>
                            </div>
                            <h2 className="text-2xl font-bold text-gray-800 mb-3">
                                {t(`steps.${STEP_KEYS[activeStep]}.title`)}
                            </h2>
                            <p className="text-gray-600 leading-relaxed mb-4">
                                {t(`steps.${STEP_KEYS[activeStep]}.description`)}
                            </p>
                            <div className="flex items-center gap-2 px-4 py-3 bg-brand-primary-50 rounded-xl">
                                <img src="/images/shinny_avatar_explaining.png" alt="Shinny" className="w-6 h-6 rounded-full border border-brand-primary-200" />
                                <p className="text-brand-primary-700 text-sm font-medium italic">
                                    &ldquo;{t(`steps.${STEP_KEYS[activeStep]}.tip`)}&rdquo;
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Step navigation buttons */}
                    <div className="flex justify-between mt-8">
                        <button
                            onClick={() => setActiveStep(Math.max(0, activeStep - 1))}
                            disabled={activeStep === 0}
                            className="px-5 py-2.5 rounded-xl font-medium text-gray-500 bg-gray-100 hover:bg-gray-200 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                            {tCommon('previous')}
                        </button>
                        <button
                            onClick={() => setActiveStep(Math.min(3, activeStep + 1))}
                            disabled={activeStep === 3}
                            className="px-5 py-2.5 rounded-xl font-medium text-white bg-gradient-to-r from-brand-primary-400 to-brand-secondary-400 shadow-brand hover:shadow-brand-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1"
                        >
                            {tCommon('next')} <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Blood Sugar Curve Comparison */}
                <div className="backdrop-blur-md bg-white/90 rounded-3xl p-6 md:p-8 max-w-3xl mx-auto shadow-glass mb-10">
                    <h2 className="text-xl font-bold text-gray-800 mb-6 text-center">{t('blood_sugar.title')}</h2>
                    <div className="grid md:grid-cols-2 gap-6">
                        {/* Without sequencing */}
                        <div className="p-4 bg-red-50 rounded-2xl">
                            <p className="text-sm font-semibold text-red-600 mb-3">{t('blood_sugar.without_sequence')}</p>
                            <svg viewBox="0 0 200 80" className="w-full">
                                <defs>
                                    <linearGradient id="redGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#ef4444" stopOpacity="0.3" />
                                        <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
                                    </linearGradient>
                                </defs>
                                {/* Baseline */}
                                <line x1="10" y1="65" x2="190" y2="65" stroke="#ddd" strokeWidth="1" strokeDasharray="4" />
                                {/* Spike curve */}
                                <path
                                    d={showCurve ? "M10,65 C40,65 50,10 80,10 C110,10 120,55 150,58 C170,60 180,62 190,65" : "M10,65 L190,65"}
                                    fill="url(#redGrad)" stroke="#ef4444" strokeWidth="2.5"
                                    style={{ transition: 'all 1.5s ease-out' }}
                                />
                                {showCurve && (
                                    <text x="70" y="8" fill="#ef4444" fontSize="8" fontWeight="bold">{t('blood_sugar.spike')}</text>
                                )}
                            </svg>
                        </div>
                        {/* With sequencing */}
                        <div className="p-4 bg-green-50 rounded-2xl">
                            <p className="text-sm font-semibold text-green-600 mb-3">{t('blood_sugar.with_sequence')}</p>
                            <svg viewBox="0 0 200 80" className="w-full">
                                <defs>
                                    <linearGradient id="greenGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#22c55e" stopOpacity="0.3" />
                                        <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
                                    </linearGradient>
                                </defs>
                                <line x1="10" y1="65" x2="190" y2="65" stroke="#ddd" strokeWidth="1" strokeDasharray="4" />
                                <path
                                    d={showCurve ? "M10,65 C40,62 60,40 90,38 C120,36 140,50 160,55 C175,58 185,62 190,65" : "M10,65 L190,65"}
                                    fill="url(#greenGrad)" stroke="#22c55e" strokeWidth="2.5"
                                    style={{ transition: 'all 1.5s ease-out', transitionDelay: '0.5s' }}
                                />
                                {showCurve && (
                                    <text x="70" y="35" fill="#22c55e" fontSize="8" fontWeight="bold">{t('blood_sugar.flat')}</text>
                                )}
                            </svg>
                        </div>
                    </div>
                    <div className="text-center mt-4">
                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-100 rounded-full">
                            <Sparkles className="w-4 h-4 text-green-600" />
                            <span className="text-green-700 font-bold text-sm">{t('blood_sugar.reduction')}</span>
                        </div>
                    </div>
                </div>

                {/* CTA Section */}
                <div className="backdrop-blur-md bg-gradient-to-r from-brand-primary-100/80 to-brand-secondary-100/80 rounded-3xl p-8 max-w-3xl mx-auto shadow-glass text-center">
                    <h2 className="text-2xl font-bold text-gray-800 mb-2">{t('try_it.title')}</h2>
                    <p className="text-gray-600 mb-6">{t('try_it.description')}</p>
                    <div className="flex flex-col sm:flex-row justify-center gap-4">
                        <Link
                            href={`/${locale}/scan`}
                            className="flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-brand-primary-400 to-brand-secondary-400 text-white font-bold rounded-xl hover:shadow-brand-lg transition-all"
                        >
                            <Scan className="w-5 h-5" /> {t('try_it.cta_scan')}
                        </Link>
                        <Link
                            href={`/${locale}/login`}
                            className="flex items-center justify-center gap-2 px-6 py-3 bg-white text-brand-primary-600 font-bold rounded-xl border-2 border-brand-primary-200 hover:bg-brand-primary-50 transition-all"
                        >
                            <UserPlus className="w-5 h-5" /> {t('try_it.cta_register')}
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
