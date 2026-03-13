'use client';

import { useTranslations } from 'next-intl';
import { Sparkles, ChevronRight } from 'lucide-react';
import type { AiDishAnalysis } from '@/lib/ai-prompt';

const CATEGORY_COLORS: Record<string, string> = {
    fiber: 'bg-sequence-fiber',
    protein: 'bg-sequence-protein',
    carb: 'bg-sequence-carb',
    sugar: 'bg-sequence-sugar',
};

interface DishCardProps {
    dish: AiDishAnalysis;
    index: number;
    totalDishes: number;
}

export default function DishCard({ dish, index, totalDishes }: DishCardProps) {
    const t = useTranslations('scan');

    const overallScore = Math.round(
        (dish.scores.bloodSugar + dish.scores.gutHealth + dish.scores.inflammation +
         dish.scores.nutrientDensity + dish.scores.processing + dish.scores.proteinQuality +
         dish.scores.micronutrient) / 7
    );
    const scoreColor = overallScore >= 75 ? 'text-green-500' : overallScore >= 50 ? 'text-yellow-500' : 'text-red-500';
    const scoreBg = overallScore >= 75 ? 'bg-green-50 border-green-200' : overallScore >= 50 ? 'bg-yellow-50 border-yellow-200' : 'bg-red-50 border-red-200';

    return (
        <div className="backdrop-blur-md bg-white/90 rounded-2xl p-5 shadow-glass border border-gray-100 transition-all hover:-translate-y-0.5 hover:shadow-glass-hover">
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    {totalDishes > 1 && (
                        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-gradient-to-br from-brand-primary-400 to-brand-secondary-400 text-white text-xs font-bold shadow-sm">
                            {index + 1}
                        </span>
                    )}
                    <h3 className="text-lg font-bold text-gray-900 leading-tight">{dish.name}</h3>
                </div>
                <div className={`px-3 py-1 rounded-xl text-sm font-black ${scoreColor} ${scoreBg} border`}>
                    {overallScore}<span className="text-xs text-gray-400 font-medium">/100</span>
                </div>
            </div>

            {/* Detected Items */}
            <div className="flex flex-wrap gap-1.5 mb-3">
                {dish.detectedItems.map((item, i) => (
                    <span key={i} className="px-2.5 py-1 bg-brand-primary-50 text-brand-primary-700 rounded-full text-xs font-medium">
                        {item}
                    </span>
                ))}
            </div>

            {/* Compact Nutrition */}
            <div className="grid grid-cols-5 gap-1.5 mb-3">
                {[
                    { key: 'calories', val: dish.nutritionSummary.calories, unit: '' },
                    { key: 'protein_g', val: dish.nutritionSummary.protein, unit: 'g' },
                    { key: 'carbs_g', val: dish.nutritionSummary.carbs, unit: 'g' },
                    { key: 'fat_g', val: dish.nutritionSummary.fat, unit: 'g' },
                    { key: 'fiber_g', val: dish.nutritionSummary.fiber, unit: 'g' },
                ].map(({ key, val, unit }) => (
                    <div key={key} className="text-center p-1.5 bg-gray-50 rounded-lg">
                        <p className="text-[10px] text-gray-400">{t(key)}</p>
                        <p className="text-sm font-bold text-gray-800">{val}{unit && <span className="text-[10px] text-gray-400">{unit}</span>}</p>
                    </div>
                ))}
            </div>

            {/* Per-Dish Eating Sequence */}
            <div className="flex items-center gap-1.5">
                {dish.sequence.map((step, i) => (
                    <div key={i} className="flex items-center gap-1">
                        <div className={`w-7 h-7 ${CATEGORY_COLORS[step.category]} text-white rounded-lg flex items-center justify-center text-xs font-bold`}>
                            {step.emoji}
                        </div>
                        {i < dish.sequence.length - 1 && (
                            <ChevronRight className="w-3 h-3 text-gray-300" />
                        )}
                    </div>
                ))}
                <div className="ml-auto flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-green-500" />
                    <span className="text-xs text-green-600 font-semibold">-{dish.spikeReduction}%</span>
                </div>
            </div>

            {/* Tip */}
            {dish.tip && (
                <p className="mt-3 text-xs text-gray-500 italic border-t border-gray-100 pt-2">
                    💡 {dish.tip}
                </p>
            )}
        </div>
    );
}
