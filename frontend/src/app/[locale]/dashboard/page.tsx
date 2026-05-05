'use client';

import { useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Scan, Flame, Award, Sparkles, Star, ChevronRight, LogOut, Utensils, LayoutDashboard, MessageCircle } from 'lucide-react';
import { useAuthStore } from '@/lib/auth-store';
import { TIER_LIMITS } from '@/lib/tier-config';
import { logger } from '@/lib/logger';

export default function DashboardPage() {
    const t = useTranslations('dashboard');
    const tNav = useTranslations('nav');
    const tCommon = useTranslations('common');
    const tGamify = useTranslations('gamification');
    const locale = useLocale();
    const router = useRouter();

    const { user, isAuthenticated, logout } = useAuthStore();

    useEffect(() => {
        if (!isAuthenticated) {
            router.push(`/${locale}/login`);
        }
    }, [isAuthenticated, locale, router]);

    useEffect(() => {
        logger.trackFeature('Dashboard', 'loading', { locale });
    }, [locale]);

    if (!isAuthenticated || !user) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="w-8 h-8 border-3 border-brand-primary-400/30 border-t-brand-primary-400 rounded-full animate-spin"></div>
            </div>
        );
    }

    const rawTier = user.subscriptionTier || 'free';
    const tier = (['free', 'premium', 'family'].includes(rawTier) ? rawTier : 'free') as 'free' | 'premium' | 'family';
    const limits = TIER_LIMITS[tier];
    const trialDaysLeft = user.trialExpiresAt
        ? Math.max(0, Math.ceil((new Date(user.trialExpiresAt).getTime() - Date.now()) / 86400000))
        : null;

    const levelName = user.totalPoints >= 5000 ? tGamify('levels.ninja')
        : user.totalPoints >= 2000 ? tGamify('levels.master')
            : user.totalPoints >= 500 ? tGamify('levels.practitioner')
                : user.totalPoints >= 100 ? tGamify('levels.learner')
                    : tGamify('levels.beginner');

    const tierBadgeColors = {
        free: 'bg-gray-100 text-gray-600',
        premium: 'bg-gradient-to-r from-brand-primary-400 to-brand-secondary-400 text-white',
        family: 'bg-gradient-to-r from-brand-secondary-400 to-brand-accent-400 text-white',
    };

    return (
        <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-brand-primary-50 via-white to-brand-secondary-50">
            <div className="absolute top-0 -left-1/4 w-1/2 h-1/2 bg-brand-primary-400/20 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-float"></div>
            <div className="absolute -bottom-1/4 right-1/4 w-1/2 h-1/2 bg-brand-secondary-400/20 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-float" style={{ animationDelay: '2s' }}></div>

            {/* Header */}
            <header className="container mx-auto px-4 py-4 md:py-6 relative z-10 backdrop-blur-md bg-white/70 rounded-b-3xl shadow-glass">
                <nav className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-brand-primary-400 to-brand-secondary-400 rounded-2xl flex items-center justify-center shadow-brand">
                            <LayoutDashboard className="text-white w-5 h-5" />
                        </div>
                        <div>
                            <span className="text-lg font-bold text-gray-800">{t('your_dashboard')}</span>
                            <p className="text-xs text-gray-500">{t('welcome')}, {user.displayName}!</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${tierBadgeColors[tier]}`}>
                            {tCommon(tier)}
                        </span>
                        <button onClick={() => { logout(); router.push(`/${locale}`); }} className="p-2 rounded-xl bg-white/80 border border-gray-200 shadow-sm hover:bg-red-50 transition-all" title="Logout">
                            <LogOut className="w-4 h-4 text-gray-500" />
                        </button>
                    </div>
                </nav>
            </header>

            <div className="container mx-auto px-4 py-8 relative z-10 max-w-5xl">
                {/* Trial expiry warning */}
                {trialDaysLeft !== null && trialDaysLeft > 0 && (
                    <div className="mb-6 p-4 bg-brand-accent-100 rounded-2xl flex items-center gap-3 animate-slide-up">
                        <Sparkles className="w-5 h-5 text-brand-accent-600" />
                        <span className="text-brand-accent-700 font-medium text-sm">
                            {t('trial_expires', { days: String(trialDaysLeft) })}
                        </span>
                        <Link href={`/${locale}/pricing`} className="ml-auto text-brand-accent-700 font-bold text-sm hover:underline">
                            {t('upgrade_cta')} →
                        </Link>
                    </div>
                )}

                {/* Quick Stats */}
                <h2 className="text-lg font-bold text-gray-700 mb-4">{t('quick_stats')}</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    <div className="backdrop-blur-md bg-white/80 rounded-2xl p-5 shadow-glass text-center hover:-translate-y-1 transition-all">
                        <Scan className="w-8 h-8 text-brand-primary-500 mx-auto mb-2" />
                        <p className="text-2xl font-black text-gray-800">{user.scansThisMonth}</p>
                        <p className="text-xs text-gray-500">{t('scans_used')}</p>
                        <p className="text-xs text-brand-primary-500 mt-1">
                            / {limits.scansPerMonth === Infinity ? '∞' : limits.scansPerMonth}
                        </p>
                    </div>
                    <div className="backdrop-blur-md bg-white/80 rounded-2xl p-5 shadow-glass text-center hover:-translate-y-1 transition-all">
                        <Flame className="w-8 h-8 text-orange-500 mx-auto mb-2 animate-pulse-soft" />
                        <p className="text-2xl font-black text-gray-800">{user.streakDays}</p>
                        <p className="text-xs text-gray-500">{t('streak')}</p>
                    </div>
                    <div className="backdrop-blur-md bg-white/80 rounded-2xl p-5 shadow-glass text-center hover:-translate-y-1 transition-all">
                        <Award className="w-8 h-8 text-brand-accent-500 mx-auto mb-2" />
                        <p className="text-2xl font-black text-gray-800">{user.totalPoints.toLocaleString()}</p>
                        <p className="text-xs text-gray-500">{t('points')}</p>
                    </div>
                    <div className="backdrop-blur-md bg-white/80 rounded-2xl p-5 shadow-glass text-center hover:-translate-y-1 transition-all">
                        <Star className="w-8 h-8 text-brand-secondary-500 mx-auto mb-2" />
                        <p className="text-lg font-bold text-gray-800">{levelName}</p>
                        <p className="text-xs text-gray-500">{tGamify('level')}</p>
                    </div>
                </div>

                {/* Daily Challenge + Scan CTA */}
                <div className="grid md:grid-cols-2 gap-6 mb-8">
                    <div className="backdrop-blur-md bg-gradient-to-br from-brand-primary-50 to-brand-secondary-50 rounded-3xl p-6 shadow-glass">
                        <h3 className="font-bold text-gray-800 mb-2 flex items-center gap-2">
                            <Sparkles className="w-5 h-5 text-brand-accent-500" /> {t('daily_challenge')}
                        </h3>
                        <p className="text-gray-600 text-sm mb-3">{t('challenge_text')}</p>
                        <div className="flex items-center gap-2">
                            <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold">{t('challenge_reward')}</span>
                        </div>
                    </div>

                    <Link href={`/${locale}/scan`} className="group backdrop-blur-md bg-gradient-to-br from-brand-primary-400 to-brand-secondary-400 rounded-3xl p-6 shadow-brand text-white hover:shadow-brand-lg transition-all flex items-center gap-4">
                        <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center">
                            <Scan className="w-8 h-8" />
                        </div>
                        <div>
                            <h3 className="font-bold text-lg">{t('scan_now')}</h3>
                            <p className="text-white/80 text-sm">{t('scans_used')}: {user.scansThisMonth}</p>
                        </div>
                        <ChevronRight className="w-6 h-6 ml-auto group-hover:translate-x-1 transition-transform" />
                    </Link>
                </div>

                {/* AI Coach card — sits between the scan CTA and recent-scans
                    so users discover it after their first scan. Goes to
                    /[locale]/chat which is auth-gated server-side and
                    quota-gated per tier. */}
                <Link
                    href={`/${locale}/chat`}
                    className="group block backdrop-blur-md bg-white/80 rounded-3xl p-5 shadow-glass mb-8 hover:shadow-brand transition-all"
                >
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-accent-400 to-brand-accent-500 flex items-center justify-center text-white shadow-warning">
                            <MessageCircle className="w-6 h-6" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-gray-900">{t('chat_card_title')}</h3>
                            <p className="text-sm text-gray-600 truncate">{t('chat_card_subtitle')}</p>
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-brand-primary-500 group-hover:translate-x-1 transition-all" />
                    </div>
                </Link>

                {/* Recent Scans (empty state) */}
                <div className="backdrop-blur-md bg-white/80 rounded-3xl p-6 shadow-glass mb-8">
                    <h3 className="font-bold text-gray-800 mb-4">{t('recent_scans')}</h3>
                    {user.scansThisMonth === 0 ? (
                        <div className="text-center py-8">
                            <Utensils className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                            <p className="text-gray-500">{t('no_scans')}</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {/* Mock recent scan entries */}
                            {Array.from({ length: Math.min(user.scansThisMonth, 3) }).map((_, i) => (
                                <div key={i} className="flex items-center gap-4 p-3 bg-gray-50 rounded-xl">
                                    <div className="w-12 h-12 bg-brand-primary-100 rounded-xl flex items-center justify-center text-xl">
                                        {['🍜', '🥗', '🍛'][i % 3]}
                                    </div>
                                    <div className="flex-1">
                                        <p className="font-semibold text-gray-800 text-sm">{['Pad Thai', 'Som Tam', 'Green Curry'][i % 3]}</p>
                                        <p className="text-xs text-gray-500">Score: {[61, 82, 68][i % 3]}/100</p>
                                    </div>
                                    <span className="text-xs text-gray-400">Today</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Upgrade CTA for free users */}
                {tier === 'free' && (
                    <Link href={`/${locale}/pricing`} className="block backdrop-blur-md bg-gradient-to-r from-brand-primary-50 to-brand-secondary-50 rounded-3xl p-6 shadow-glass text-center hover:-translate-y-1 transition-all">
                        <Star className="w-8 h-8 text-brand-primary-500 mx-auto mb-2" />
                        <p className="font-bold text-brand-primary-600">{t('upgrade_cta')}</p>
                        <p className="text-sm text-gray-500 mt-1">THB 199/month → {tCommon('unlimited')} scans + 8-dimension scores</p>
                    </Link>
                )}
            </div>
        </div>
    );
}
