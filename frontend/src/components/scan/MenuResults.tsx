'use client';

import { useTranslations } from 'next-intl';
import { Heart, Zap, Shield, Salad, Dumbbell, Sparkles, AlertTriangle, ThumbsUp, ThumbsDown } from 'lucide-react';
import type { AiMenuResponse } from '@/lib/ai-prompt';

const SCENARIO_CONFIG: Record<string, { emoji: string; icon: typeof Heart; color: string; bg: string }> = {
    light: { emoji: '🥗', icon: Salad, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    protein: { emoji: '💪', icon: Dumbbell, color: 'text-blue-600', bg: 'bg-blue-50' },
    gut_friendly: { emoji: '❤️', icon: Heart, color: 'text-pink-600', bg: 'bg-pink-50' },
    blood_sugar_safe: { emoji: '🛡️', icon: Shield, color: 'text-violet-600', bg: 'bg-violet-50' },
    balanced: { emoji: '⚖️', icon: Sparkles, color: 'text-teal-600', bg: 'bg-teal-50' },
    indulgent: { emoji: '🍰', icon: Zap, color: 'text-amber-600', bg: 'bg-amber-50' },
};

interface MenuResultsProps {
    data: AiMenuResponse;
}

export default function MenuResults({ data }: MenuResultsProps) {
    const t = useTranslations('scan');

    const getHealthIndicator = (score: number) => {
        if (score >= 70) return { color: 'bg-green-500', label: '🟢', ring: 'ring-green-200' };
        if (score >= 45) return { color: 'bg-yellow-500', label: '🟡', ring: 'ring-yellow-200' };
        return { color: 'bg-red-500', label: '🔴', ring: 'ring-red-200' };
    };

    return (
        <div className="space-y-6 animate-slide-up">
            {/* Menu Items List */}
            <div className="backdrop-blur-md bg-white/90 rounded-3xl p-6 shadow-glass">
                <h2 className="text-xl font-bold text-gray-800 mb-1">{t('menu_scan.items_found')}</h2>
                <p className="text-sm text-gray-500 mb-4">{data.menuItems.length} {t('menu_scan.items_label')}</p>

                <div className="space-y-3">
                    {data.menuItems.map((item, i) => {
                        const indicator = getHealthIndicator(item.healthScore);
                        return (
                            <div key={i} className={`p-4 rounded-2xl border transition-all hover:-translate-y-0.5 hover:shadow-glass ${indicator.ring} ring-1 bg-white`}>
                                <div className="flex items-start justify-between mb-2">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className="text-lg">{indicator.label}</span>
                                            <h3 className="text-base font-bold text-gray-900">{item.name}</h3>
                                        </div>
                                        {item.originalName && item.originalName !== item.name && (
                                            <p className="text-xs text-gray-400 mt-0.5">{item.originalName}</p>
                                        )}
                                    </div>
                                    <div className="text-right flex-shrink-0">
                                        <p className={`text-2xl font-black ${item.healthScore >= 70 ? 'text-green-500' : item.healthScore >= 45 ? 'text-yellow-500' : 'text-red-500'}`}>
                                            {item.healthScore}
                                        </p>
                                        <p className="text-[10px] text-gray-400">/100</p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 mb-2">
                                    <span className="text-xs text-gray-500">~{item.estimatedCalories} kcal</span>
                                    {item.price && (
                                        <span className="text-xs text-gray-500">{item.price}</span>
                                    )}
                                    {item.tags.length > 0 && (
                                        <div className="flex gap-1 flex-wrap">
                                            {item.tags.slice(0, 3).map((tag, j) => (
                                                <span key={j} className="px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded-md text-[10px]">{tag}</span>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="flex gap-4 text-xs">
                                    {item.pros.length > 0 && (
                                        <div className="flex items-start gap-1 text-green-600">
                                            <ThumbsUp className="w-3 h-3 mt-0.5 flex-shrink-0" />
                                            <span>{item.pros.slice(0, 2).join(', ')}</span>
                                        </div>
                                    )}
                                    {item.cons.length > 0 && (
                                        <div className="flex items-start gap-1 text-red-500">
                                            <ThumbsDown className="w-3 h-3 mt-0.5 flex-shrink-0" />
                                            <span>{item.cons.slice(0, 2).join(', ')}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Scenario Recommendations */}
            {Object.keys(data.recommendations).length > 0 && (
                <div className="backdrop-blur-md bg-white/90 rounded-3xl p-6 shadow-glass">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-white shadow-md">
                            <img src="/images/shinny_avatar_explaining.png" alt="Shinny" className="w-full h-full object-cover" />
                        </div>
                        <h2 className="text-lg font-bold text-gray-800">{t('menu_scan.recommendations')}</h2>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {Object.entries(data.recommendations).map(([key, rec]) => {
                            const config = SCENARIO_CONFIG[key];
                            if (!config || rec.itemIndex >= data.menuItems.length) return null;
                            const item = data.menuItems[rec.itemIndex];

                            return (
                                <div key={key} className={`${config.bg} rounded-2xl p-3 transition-all hover:-translate-y-0.5 hover:shadow-md`}>
                                    <div className="flex items-center gap-1.5 mb-2">
                                        <span className="text-lg">{config.emoji}</span>
                                        <span className={`text-xs font-bold ${config.color}`}>{t(`menu_scan.scenarios.${key}`)}</span>
                                    </div>
                                    <p className="text-sm font-bold text-gray-800 mb-1">{item.name}</p>
                                    <p className="text-[11px] text-gray-500 leading-snug">{rec.reason}</p>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Combo Suggestion */}
            {data.combo && data.combo.items.length > 1 && (
                <div className="backdrop-blur-md bg-gradient-to-br from-violet-50/90 to-indigo-50/90 rounded-3xl p-5 shadow-glass border border-violet-100/50">
                    <h3 className="text-sm font-bold text-violet-700 mb-2 flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4" /> {t('menu_scan.combo_title')}
                    </h3>
                    <div className="flex items-center gap-2 mb-2">
                        {data.combo.items.map((idx, i) => {
                            const item = data.menuItems[idx];
                            if (!item) return null;
                            return (
                                <span key={i} className="flex items-center gap-1">
                                    <span className="px-3 py-1.5 bg-white/80 rounded-xl text-sm font-semibold text-gray-800 shadow-sm">
                                        {item.name}
                                    </span>
                                    {i < data.combo.items.length - 1 && <span className="text-violet-400 text-lg">+</span>}
                                </span>
                            );
                        })}
                    </div>
                    <p className="text-xs text-gray-600">{data.combo.reason}</p>
                </div>
            )}

            {/* Overall Tip */}
            {data.overallTip && (
                <div className="backdrop-blur-md bg-gradient-to-br from-brand-primary-50/90 to-brand-secondary-50/90 rounded-3xl p-5 shadow-glass">
                    <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 border-2 border-white shadow-md">
                            <img src="/images/shinny_avatar_explaining.png" alt="Shinny" className="w-full h-full object-cover" />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-brand-primary-700 mb-0.5">{t('shinny_tip_title')}</p>
                            <p className="text-sm text-gray-700 leading-relaxed">{data.overallTip}</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
