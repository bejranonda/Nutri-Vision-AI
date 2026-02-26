import React from 'react';
import { cn } from '@/lib/utils'; // Assuming tailwind-merge util is present, or simple class concatenation

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode;
    className?: string;
    intensity?: 'light' | 'medium' | 'heavy';
}

export function GlassCard({ children, className, intensity = 'medium', ...props }: GlassCardProps) {

    const intensityMap = {
        light: 'bg-white/40 backdrop-blur-sm border-white/20',
        medium: 'bg-white/70 backdrop-blur-md border-white/40',
        heavy: 'bg-white/90 backdrop-blur-lg border-white/60'
    };

    return (
        <div
            className={cn(
                'rounded-3xl border shadow-xl',
                intensityMap[intensity],
                className
            )}
            {...props}
        >
            {children}
        </div>
    );
}
