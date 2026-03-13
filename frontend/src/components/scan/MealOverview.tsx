'use client';

import { useTranslations } from 'next-intl';
import { ChevronRight, Sparkles, TrendingDown } from 'lucide-react';
import type { AiMultiDishResponse } from '@/lib/ai-prompt';

const CATEGORY_COLORS: Record<string, string> = {
    fiber: 'bg-sequence-fiber',
    protein: 'bg-sequence-protein',
    carb: 'bg-sequence-carb',
    sugar: 'bg-sequence-sugar',
};

interface MealOverviewProps {
    data: AiMultiDishResponse;
}

export default function MealOverview({ data }: MealOverviewProps) {
    const t = useTranslations('scan');

    // Aggregate nutrition across all dishes
    const totalNutrition = data.dishes.reduce(
        (acc, dish) => ({
            calories: acc.calories + dish.nutritionSummary.calories,
            protein: acc.protein + dish.nutritionSummary.protein,
            carbs: acc.carbs + dish.nutritionSummary.carbs,
            fat: acc.fat + dish.nutritionSummary.fat,
            fiber: acc.fiber + dish.nutritionSummary.fiber,
        }),
        { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
    );

    // Average spike reduction
    const avgSpikeReduction = Math.round(
        data.dishes.reduce((sum, d) => sum + d.spikeReduction, 0) / data.dishes.length
    );

    return (
        <div className="backdrop-blur-md bg-gradient-to-br from-brand-primary-50/90 to-brand-secondary-50/90 rounded-3xl p-6 shadow-glass border border-brand-primary-100/50">
            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-primary-400 to-brand-secondary-400 flex items-center justify-center shadow-brand">
                    <span className="text-xl">🍽️</span>
                </div>
                <div>
                    <h2 className="text-lg font-bold text-gray-900">{t('multi_dish.overview_title')}</h2>
                    <p className="text-xs text-gray-500">{data.dishCount} {data.dishCount > 1 ? 'dishes' : 'dish'}</p>
                </div>
            </div>

            {/* Total Nutrition */}
            <div className="bg-white/60 rounded-2xl p-4 mb-4">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{t('multi_dish.total_nutrition')}</h3>
                <div className="grid grid-cols-5 gap-2">
                    {[
                        { key: 'calories', val: totalNutrition.calories, unit: '' },
                        { key: 'protein_g', val: totalNutrition.protein, unit: 'g' },
                        { key: 'carbs_g', val: totalNutrition.carbs, unit: 'g' },
                        { key: 'fat_g', val: totalNutrition.fat, unit: 'g' },
                        { key: 'fiber_g', val: totalNutrition.fiber, unit: 'g' },
                    ].map(({ key, val, unit }) => (
                        <div key={key} className="text-center p-2 bg-white/80 rounded-xl">
                            <p className="text-[10px] text-gray-400">{t(key)}</p>
                            <p className="text-lg font-black text-gray-800">{val}{unit && <span className="text-xs text-gray-400">{unit}</span>}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Cross-Dish Eating Sequence */}
            {data.crossDishSequence.length > 0 && (
                <div className="bg-white/60 rounded-2xl p-4 mb-4">
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">{t('multi_dish.cross_dish_sequence')}</h3>
                    <div className="space-y-2">
                        {data.crossDishSequence.map((step, i) => (
                            <div key={i} className="flex items-center gap-3 p-2.5 bg-white/80 rounded-xl group hover:shadow-sm transition-all">
                                <div className={`w-8 h-8 ${CATEGORY_COLORS[step.category]} text-white rounded-lg flex items-center justify-center font-bold text-sm shadow-sm`}>
                                    {step.step}
                                </div>
                                <span className="text-xl">{step.emoji}</span>
                                <div className="flex-1">
                                    <p className="text-sm text-gray-700 font-medium">{step.items}</p>
                                    {data.dishCount > 1 && (
                                        <p className="text-[10px] text-gray-400">
                                            {t('multi_dish.dish_label', { n: step.dishIndex + 1 })}
                                        </p>
                                    )}
                                </div>
                                {i < data.crossDishSequence.length - 1 && (
                                    <ChevronRight className="w-4 h-4 text-gray-300" />
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Spike Reduction + Overall Tip */}
            <div className="flex items-center gap-3">
                <div className="flex-1 p-3 bg-green-50/80 rounded-xl flex items-center gap-2">
                    <TrendingDown className="w-5 h-5 text-green-500" />
                    <span className="text-green-700 font-semibold text-sm">
                        {t('sequence.spike_reduction')}: <span className="text-lg">{avgSpikeReduction}%</span>
                    </span>
                </div>
            </div>

            {/* Shinny's Overall Tip */}
            {data.overallTip && (
                <div className="mt-4 flex items-start gap-3 p-3 bg-white/60 rounded-xl">
                    <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 border-2 border-white shadow-sm">
                        <img src="/images/shinny_avatar_explaining.png" alt="Shinny" className="w-full h-full object-cover" />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-brand-primary-700 mb-0.5">{t('shinny_tip_title')}</p>
                        <p className="text-sm text-gray-700 leading-relaxed">{data.overallTip}</p>
                    </div>
                </div>
            )}
        </div>
    );
}
