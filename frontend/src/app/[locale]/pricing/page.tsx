'use client';

import { useState, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import Link from 'next/link';
import { ArrowLeft, Check, Star, Gift, ChevronRight, Building } from 'lucide-react';
import { useAuthStore } from '@/lib/auth-store';
import { TIER_PRICING } from '@/lib/tier-config';
import { logger } from '@/lib/logger';
import LanguageSwitcher from '@/components/LanguageSwitcher';

export default function PricingPage() {
    const t = useTranslations('pricing');
    const tCommon = useTranslations('common');
    const tAuth = useTranslations('auth');
    const locale = useLocale();
    const { isAuthenticated, user, redeemCode } = useAuthStore();

    const [isAnnual, setIsAnnual] = useState(true);
    const [promoInput, setPromoInput] = useState('');
    const [promoMsg, setPromoMsg] = useState('');
    const [promoOk, setPromoOk] = useState(false);

    useEffect(() => {
        logger.trackFeature('Pricing Page', 'loading', { locale });
    }, [locale]);

    async function handlePromo() {
        if (!promoInput.trim()) return;
        if (!isAuthenticated) {
            setPromoMsg(locale === 'th' ? 'กรุณาเข้าสู่ระบบก่อน' : 'Please login first');
            setPromoOk(false);
            return;
        }
        const result = await redeemCode(promoInput);
        setPromoOk(result.success);
        setPromoMsg(result.message);
    }

    const currentTier = user?.subscriptionTier || 'free';

    const tiers = [
        {
            key: 'free',
            name: t('free_tier.name'),
            desc: t('free_tier.description'),
            price: 0,
            annualPrice: 0,
            features: t.raw('free_tier.features') as string[],
            cta: currentTier === 'free' ? t('current_plan') : t('get_started'),
            isCurrent: currentTier === 'free',
            popular: false,
            gradient: 'from-gray-100 to-white',
            borderColor: 'border-gray-200',
        },
        {
            key: 'premium',
            name: t('premium_tier.name'),
            desc: t('premium_tier.description'),
            price: TIER_PRICING.premium.monthly,
            annualPrice: TIER_PRICING.premium.annualMonthly,
            annualTotal: TIER_PRICING.premium.annual,
            discount: TIER_PRICING.premium.discountPercent,
            features: t.raw('premium_tier.features') as string[],
            cta: currentTier === 'premium' ? t('current_plan') : t('upgrade_now'),
            isCurrent: currentTier === 'premium',
            popular: true,
            gradient: 'from-brand-primary-50 to-brand-secondary-50',
            borderColor: 'border-brand-primary-300',
        },
        {
            key: 'family',
            name: t('family_tier.name'),
            desc: t('family_tier.description'),
            price: TIER_PRICING.family.monthly,
            annualPrice: TIER_PRICING.family.annualMonthly,
            annualTotal: TIER_PRICING.family.annual,
            discount: TIER_PRICING.family.discountPercent,
            features: t.raw('family_tier.features') as string[],
            cta: currentTier === 'family' ? t('current_plan') : t('upgrade_now'),
            isCurrent: currentTier === 'family',
            popular: false,
            gradient: 'from-brand-secondary-50 to-brand-accent-50',
            borderColor: 'border-brand-secondary-200',
        },
    ];

    return (
        <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-brand-primary-50 via-white to-brand-secondary-50">
            <div className="absolute top-0 -left-1/4 w-1/2 h-1/2 bg-brand-primary-400/20 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-float"></div>
            <div className="absolute -bottom-1/4 right-1/4 w-1/2 h-1/2 bg-brand-secondary-400/20 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-float" style={{ animationDelay: '2s' }}></div>

            <div className="container mx-auto px-4 pt-6 pb-4 relative z-10">
                <div className="flex items-center justify-between">
                    <Link href={`/${locale}`} className="inline-flex items-center gap-2 px-4 py-2 bg-white/80 backdrop-blur-sm rounded-xl text-gray-600 hover:text-brand-primary-500 transition-colors border border-gray-200">
                        <ArrowLeft className="w-4 h-4" /> {tCommon('back_to_home')}
                    </Link>
                    <LanguageSwitcher currentLocale={locale} />
                </div>
            </div>

            <div className="container mx-auto px-4 py-8 relative z-10 max-w-6xl">
                {/* Header */}
                <div className="text-center mb-10">
                    <h1 className="text-3xl md:text-5xl font-black bg-clip-text text-transparent bg-gradient-to-r from-brand-primary-500 to-brand-secondary-500 mb-3">{t('title')}</h1>
                    <p className="text-gray-600 text-lg mb-6">{t('subtitle')}</p>

                    {/* Billing toggle */}
                    <div className="inline-flex items-center gap-3 bg-white/80 backdrop-blur-sm p-1.5 rounded-2xl border border-gray-200 shadow-sm">
                        <button onClick={() => setIsAnnual(false)} className={`px-5 py-2.5 rounded-xl font-semibold text-sm transition-all ${!isAnnual ? 'bg-brand-primary-400 text-white shadow-brand' : 'text-gray-500'}`}>
                            {t('monthly')}
                        </button>
                        <button onClick={() => setIsAnnual(true)} className={`px-5 py-2.5 rounded-xl font-semibold text-sm transition-all flex items-center gap-1 ${isAnnual ? 'bg-brand-primary-400 text-white shadow-brand' : 'text-gray-500'}`}>
                            {t('annual')}
                            <span className={`text-xs px-2 py-0.5 rounded-full ${isAnnual ? 'bg-white/20' : 'bg-green-100 text-green-700'}`}>
                                {t('save_percent', { percent: '30' })}
                            </span>
                        </button>
                    </div>
                </div>

                {/* Tier Cards */}
                <div className="grid md:grid-cols-3 gap-6 mb-12">
                    {tiers.map((tier) => (
                        <div key={tier.key} className={`relative bg-gradient-to-br ${tier.gradient} backdrop-blur-md rounded-3xl p-6 border-2 ${tier.borderColor} shadow-glass ${tier.popular ? 'md:-mt-4 md:mb-0 md:pb-10 ring-2 ring-brand-primary-300' : ''} transition-all hover:-translate-y-2 hover:shadow-glass-hover`}>
                            {tier.popular && (
                                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-brand-primary-400 to-brand-secondary-400 text-white text-xs font-bold rounded-full shadow-brand flex items-center gap-1">
                                    <Star className="w-3 h-3" /> {t('most_popular')}
                                </div>
                            )}

                            <h3 className="text-xl font-bold text-gray-800 mb-1">{tier.name}</h3>
                            <p className="text-sm text-gray-500 mb-4">{tier.desc}</p>

                            <div className="mb-6">
                                {tier.price === 0 ? (
                                    <div className="text-4xl font-black text-gray-800">{tCommon('free')}</div>
                                ) : (
                                    <>
                                        <div className="flex items-baseline gap-1">
                                            <span className="text-sm text-gray-400">฿</span>
                                            <span className="text-4xl font-black text-gray-800">
                                                {isAnnual ? tier.annualPrice : tier.price}
                                            </span>
                                            <span className="text-gray-400 text-sm">{t('per_month')}</span>
                                        </div>
                                        {isAnnual && tier.annualTotal && (
                                            <p className="text-xs text-gray-400 mt-1">
                                                ฿{tier.annualTotal}{t('per_year')} · <span className="text-green-600 font-semibold">{t('save_percent', { percent: String(tier.discount) })}</span>
                                            </p>
                                        )}
                                    </>
                                )}
                            </div>

                            <ul className="space-y-2.5 mb-6">
                                {tier.features.map((feature, i) => (
                                    <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                                        <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                                        <span>{feature}</span>
                                    </li>
                                ))}
                            </ul>

                            {tier.isCurrent ? (
                                <div className="w-full py-3 text-center bg-gray-100 text-gray-500 font-semibold rounded-xl">
                                    {t('current_plan')}
                                </div>
                            ) : (
                                <Link href={tier.key === 'free' ? `/${locale}/login` : `/${locale}/login`} className={`block w-full py-3 text-center font-semibold rounded-xl transition-all ${tier.popular
                                    ? 'bg-gradient-to-r from-brand-primary-400 to-brand-secondary-400 text-white shadow-brand hover:shadow-brand-lg'
                                    : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                                    }`}>
                                    {tier.cta} <ChevronRight className="w-4 h-4 inline" />
                                </Link>
                            )}
                        </div>
                    ))}
                </div>

                {/* Enterprise CTA */}
                <div className="backdrop-blur-md bg-gradient-to-r from-gray-50 to-brand-secondary-50 rounded-3xl p-8 max-w-3xl mx-auto shadow-glass text-center mb-10">
                    <Building className="w-10 h-10 text-brand-secondary-500 mx-auto mb-3" />
                    <h2 className="text-xl font-bold text-gray-800 mb-2">{t('enterprise.title')}</h2>
                    <p className="text-gray-600 mb-4">{t('enterprise.description')}</p>
                    <button className="px-6 py-3 bg-gray-800 text-white font-semibold rounded-xl hover:bg-gray-700 transition-all">
                        {t('enterprise.cta')}
                    </button>
                </div>

                {/* Promo Code */}
                <div className="max-w-md mx-auto mb-10">
                    <div className="flex items-center gap-2 mb-3 justify-center">
                        <Gift className="w-5 h-5 text-brand-accent-500" />
                        <span className="font-semibold text-gray-700">{t('promo_code')}</span>
                    </div>
                    <div className="flex gap-2">
                        <input
                            type="text" value={promoInput} onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                            placeholder={tAuth('promo_placeholder')}
                            className="flex-1 px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-accent-400 focus:border-transparent outline-none text-gray-900"
                        />
                        <button onClick={handlePromo} className="px-5 py-3 bg-gradient-to-r from-brand-accent-400 to-brand-accent-500 text-white font-semibold rounded-xl hover:shadow-warning transition-all whitespace-nowrap">
                            {tAuth('promo_apply')}
                        </button>
                    </div>
                    {promoMsg && <p className={`text-sm mt-2 text-center ${promoOk ? 'text-green-600' : 'text-red-500'}`}>{promoMsg}</p>}
                </div>

                {/* FAQ */}
                <div className="max-w-3xl mx-auto">
                    <h2 className="text-2xl font-bold text-gray-800 text-center mb-6">{t('faq.title')}</h2>
                    <div className="space-y-4">
                        {[1, 2, 3, 4].map((i) => (
                            <details key={i} className="group backdrop-blur-md bg-white/80 rounded-2xl border border-gray-100 shadow-sm">
                                <summary className="cursor-pointer p-5 font-semibold text-gray-700 list-none flex items-center justify-between hover:text-brand-primary-500 transition-colors">
                                    {t(`faq.q${i}`)}
                                    <ChevronRight className="w-4 h-4 text-gray-400 group-open:rotate-90 transition-transform" />
                                </summary>
                                <div className="px-5 pb-5 text-gray-600 text-sm leading-relaxed">
                                    {t(`faq.a${i}`)}
                                </div>
                            </details>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
