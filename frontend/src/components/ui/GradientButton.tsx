import React, { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

interface GradientButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    children: React.ReactNode;
    variant?: 'primary' | 'secondary' | 'danger';
    isLoading?: boolean;
    className?: string;
    size?: 'sm' | 'md' | 'lg';
}

export function GradientButton({
    children,
    variant = 'primary',
    isLoading = false,
    size = 'md',
    className,
    disabled,
    ...props
}: GradientButtonProps) {

    const variants = {
        primary: 'bg-gradient-to-r from-BrandOrange to-BrandMagenta text-white hover:brightness-110 shadow-lg shadow-BrandOrange/20',
        secondary: 'bg-white text-BrandViolet border border-BrandViolet hover:bg-slate-50 shadow-md',
        danger: 'bg-gradient-to-r from-red-500 to-rose-600 text-white hover:brightness-110 shadow-lg shadow-red-500/20'
    };

    const sizes = {
        sm: 'text-sm py-2 px-4',
        md: 'text-base py-3 px-6 font-semibold',
        lg: 'text-lg py-4 px-8 font-bold'
    };

    return (
        <button
            className={cn(
                'rounded-full transition-all duration-300 transform hover:-translate-y-1 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center',
                variants[variant],
                sizes[size],
                className
            )}
            disabled={disabled || isLoading}
            {...props}
        >
            {isLoading && <Loader2 className="w-5 h-5 mr-2 animate-spin" />}
            {children}
        </button>
    );
}
