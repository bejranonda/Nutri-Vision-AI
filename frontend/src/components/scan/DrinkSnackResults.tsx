'use client';

import { useTranslations } from 'next-intl';
import { AlertTriangle, Clock, Leaf, ArrowRight } from 'lucide-react';
import type { AiDrinkSnackResponse } from '@/lib/ai-prompt';

interface DrinkSnackResultsProps {
    data: AiDrinkSnackResponse;
}

export default function DrinkSnackResults({ data }: DrinkSnackResultsProps) {
    const t = useTranslations('scan');

    const overallScore = Math.round(
        (data.scores.bloodSugar + data.scores.gutHealth + data.scores.inflammation +
         data.scores.nutrientDensity + data.scores.processing + data.scores.proteinQuality +
         data.scores.micronutrient) / 7
    );
    const scoreColor = overallScore >= 75 ? 'text-green-500' : overallScore >= 50 ? 'text-yellow-500' : 'text-red-500';

    return (
        <div className="space-y-6 animate-slide-up">
            {/* Item Header */}
            <div className="backdrop-blur-md bg-white/90 rounded-3xl p-6 shadow-glass">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-2xl font-black text-gray-900">{data.itemName}</h2>
                    <div className={`text-3xl font-black ${scoreColor}`}>
                        {overallScore}
                        <span className="text-sm text-gray-400 font-medium">/100</span>
                    </div>
                </div>

                {/* Nutrition Grid */}
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-4">
                    {[
                        { key: 'calories', val: data.nutritionSummary.calories, unit: '' },
                        { key: 'protein_g', val: data.nutritionSummary.protein, unit: 'g' },
                        { key: 'carbs_g', val: data.nutritionSummary.carbs, unit: 'g' },
                        { key: 'fat_g', val: data.nutritionSummary.fat, unit: 'g' },
                        { key: 'fiber_g', val: data.nutritionSummary.fiber, unit: 'g' },
                        { key: 'drink_snack.sugar_label', val: data.nutritionSummary.sugar, unit: 'g' },
                    ].map(({ key, val, unit }) => (
                        <div key={key} className="text-center p-2 bg-gray-50 rounded-xl">
                            <p className="text-[10px] text-gray-400">{t(key)}</p>
                            <p className="text-lg font-bold text-gray-800">{val}{unit && <span className="text-xs text-gray-400">{unit}</span>}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Sugar Cube Visualization */}
            {data.sugarCubes > 0 && (
                <div className="backdrop-blur-md bg-gradient-to-br from-amber-50/90 to-orange-50/90 rounded-3xl p-6 shadow-glass border border-amber-100/50">
                    <h3 className="text-sm font-bold text-amber-700 mb-3 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" />
                        {t('drink_snack.sugar_cubes', { n: data.sugarCubes })}
                    </h3>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                        {Array.from({ length: Math.min(data.sugarCubes, 20) }).map((_, i) => (
                            <div
                                key={i}
                                className="w-8 h-8 bg-white rounded-lg shadow-sm flex items-center justify-center text-lg border border-amber-200 transition-all hover:scale-110"
                                style={{ animationDelay: `${i * 80}ms` }}
                            >
                                🧊
                            </div>
                        ))}
                        {data.sugarCubes > 20 && (
                            <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center text-xs text-amber-700 font-bold">
                                +{data.sugarCubes - 20}
                            </div>
                        )}
                    </div>
                    <p className="text-xs text-amber-600 mt-2">
                        {data.nutritionSummary.sugar}g {t('drink_snack.of_sugar')}
                    </p>
                </div>
            )}

            {/* Health Alerts */}
            {data.healthAlerts.length > 0 && (
                <div className="backdrop-blur-md bg-white/90 rounded-3xl p-5 shadow-glass">
                    <h3 className="text-sm font-bold text-red-600 mb-3 flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4" /> {t('drink_snack.health_alerts')}
                    </h3>
                    <div className="space-y-2">
                        {data.healthAlerts.map((alert, i) => (
                            <div key={i} className="flex items-start gap-2 p-2.5 bg-red-50 rounded-xl">
                                <span className="text-red-400 text-sm mt-0.5">⚠️</span>
                                <p className="text-sm text-red-700">{alert}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Healthier Alternatives */}
            {data.alternatives.length > 0 && (
                <div className="backdrop-blur-md bg-gradient-to-br from-emerald-50/90 to-teal-50/90 rounded-3xl p-6 shadow-glass border border-emerald-100/50">
                    <h3 className="text-sm font-bold text-emerald-700 mb-3 flex items-center gap-1.5">
                        <Leaf className="w-4 h-4" /> {t('drink_snack.alternatives')}
                    </h3>
                    <div className="space-y-3">
                        {data.alternatives.map((alt, i) => (
                            <div key={i} className="flex items-center gap-3 p-3 bg-white/80 rounded-2xl hover:-translate-y-0.5 transition-all hover:shadow-sm">
                                <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center flex-shrink-0">
                                    <ArrowRight className="w-4 h-4 text-emerald-600" />
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm font-bold text-gray-800">{alt.name}</p>
                                    <p className="text-xs text-gray-500">{alt.reason}</p>
                                </div>
                                {alt.caloriesSaved > 0 && (
                                    <div className="text-right flex-shrink-0">
                                        <p className="text-sm font-bold text-emerald-600">-{alt.caloriesSaved}</p>
                                        <p className="text-[10px] text-gray-400">kcal</p>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Timing Advice */}
            {data.timingAdvice && (
                <div className="backdrop-blur-md bg-gradient-to-br from-blue-50/90 to-indigo-50/90 rounded-3xl p-5 shadow-glass border border-blue-100/50">
                    <div className="flex items-start gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                            <Clock className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                            <h3 className="text-xs font-bold text-blue-700 mb-0.5">{t('drink_snack.timing')}</h3>
                            <p className="text-sm text-gray-700 leading-relaxed">{data.timingAdvice}</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Shinny's Tip */}
            {data.tip && (
                <div className="backdrop-blur-md bg-gradient-to-br from-brand-primary-50/90 to-brand-secondary-50/90 rounded-3xl p-5 shadow-glass">
                    <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 border-2 border-white shadow-md">
                            <img src="/images/shinny_avatar_explaining.png" alt="Shinny" className="w-full h-full object-cover" />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-brand-primary-700 mb-0.5">{t('shinny_tip_title')}</p>
                            <p className="text-sm text-gray-700 leading-relaxed">{data.tip}</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
