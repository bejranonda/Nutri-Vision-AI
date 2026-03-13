'use client';

import { UtensilsCrossed, BookOpen, GlassWater } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ScanMode } from '@/lib/ai-prompt';

interface ScanModeSelectorProps {
    selectedMode: ScanMode;
    onSelect: (mode: ScanMode) => void;
}

const MODES: { mode: ScanMode; icon: typeof UtensilsCrossed; emoji: string; gradient: string; ring: string }[] = [
    {
        mode: 'meal',
        icon: UtensilsCrossed,
        emoji: '🍽️',
        gradient: 'from-emerald-400 to-teal-500',
        ring: 'ring-emerald-400/50',
    },
    {
        mode: 'menu',
        icon: BookOpen,
        emoji: '📋',
        gradient: 'from-violet-400 to-indigo-500',
        ring: 'ring-violet-400/50',
    },
    {
        mode: 'drink_snack',
        icon: GlassWater,
        emoji: '🥤',
        gradient: 'from-amber-400 to-orange-500',
        ring: 'ring-amber-400/50',
    },
];

export default function ScanModeSelector({ selectedMode, onSelect }: ScanModeSelectorProps) {
    const t = useTranslations('scan.scan_modes');

    return (
        <div className="max-w-2xl mx-auto mb-8">
            <h2 className="text-center text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
                {t('title')}
            </h2>
            <div className="grid grid-cols-3 gap-3">
                {MODES.map(({ mode, icon: Icon, emoji, gradient, ring }) => {
                    const isSelected = selectedMode === mode;
                    return (
                        <button
                            key={mode}
                            onClick={() => onSelect(mode)}
                            className={`
                                relative group flex flex-col items-center gap-2 p-4 md:p-5 rounded-2xl
                                transition-all duration-300 ease-out cursor-pointer
                                ${isSelected
                                    ? `bg-gradient-to-br ${gradient} text-white shadow-lg scale-[1.02] ring-4 ${ring}`
                                    : 'bg-white/80 backdrop-blur-sm text-gray-600 hover:bg-white hover:-translate-y-1 hover:shadow-glass border border-gray-100'
                                }
                            `}
                        >
                            {/* Animated glow behind selected */}
                            {isSelected && (
                                <div className={`absolute inset-0 bg-gradient-to-br ${gradient} rounded-2xl opacity-20 blur-xl -z-10 animate-pulse`} />
                            )}

                            {/* Icon */}
                            <div className={`
                                w-12 h-12 md:w-14 md:h-14 rounded-xl flex items-center justify-center text-2xl
                                transition-transform duration-300
                                ${isSelected
                                    ? 'bg-white/20 scale-110'
                                    : 'bg-gray-50 group-hover:scale-105'
                                }
                            `}>
                                <span className="text-2xl md:text-3xl">{emoji}</span>
                            </div>

                            {/* Label */}
                            <div className="text-center">
                                <p className={`text-sm md:text-base font-bold leading-tight ${isSelected ? 'text-white' : 'text-gray-800'}`}>
                                    {t(`${mode}.title`)}
                                </p>
                                <p className={`text-[10px] md:text-xs mt-0.5 leading-tight ${isSelected ? 'text-white/80' : 'text-gray-400'}`}>
                                    {t(`${mode}.description`)}
                                </p>
                            </div>

                            {/* Selection indicator */}
                            {isSelected && (
                                <div className="absolute -top-1 -right-1 w-5 h-5 bg-white rounded-full flex items-center justify-center shadow-md">
                                    <svg className="w-3 h-3 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                </div>
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
