'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Link, usePathname } from '@/lib/navigation';
import { ChevronDown } from 'lucide-react';
import { localeConfig, type AppLocale } from '@/lib/i18n-config';

/**
 * LanguageSwitcher — A fully accessible, locale-aware language dropdown.
 *
 * Features:
 *  - Uses next-intl's Link for native browser link behavior (right-click, Ctrl+click)
 *  - Full keyboard navigation (ArrowUp/Down, Home/End, Enter, Escape)
 *  - WCAG 2.1 AA compliant (focus management, ARIA attributes)
 *  - Centralized locale config from i18n-config.ts
 *  - Tailwind-only styling (no inline styles)
 */
export default function LanguageSwitcher({ currentLocale }: { currentLocale: string }) {
    const [isOpen, setIsOpen] = useState(false);
    const [focusedIndex, setFocusedIndex] = useState(-1);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const optionRefs = useRef<(HTMLAnchorElement | null)[]>([]);
    const pathname = usePathname();

    const currentIndex = localeConfig.findIndex((l) => l.code === currentLocale);
    const activeLocale = localeConfig[currentIndex] || localeConfig[0];

    // ── Close on outside click ──────────────────────────────────────
    // Uses 'click' (not 'mousedown') so that Link's mousedown → navigation
    // fires before the dropdown closes. This fixes the race condition where
    // mousedown on a Link closed the dropdown before navigation could happen.
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        if (isOpen) {
            document.addEventListener('click', handleClickOutside, true);
            return () => document.removeEventListener('click', handleClickOutside, true);
        }
    }, [isOpen]);

    // ── Focus management: focus selected item when dropdown opens ────
    useEffect(() => {
        if (isOpen) {
            const idx = currentIndex >= 0 ? currentIndex : 0;
            setFocusedIndex(idx);
            // Slight delay to ensure DOM is ready
            requestAnimationFrame(() => {
                optionRefs.current[idx]?.focus();
            });
        } else {
            setFocusedIndex(-1);
        }
    }, [isOpen, currentIndex]);

    // ── Keyboard handler for the dropdown panel ─────────────────────
    const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
        const itemCount = localeConfig.length;

        switch (event.key) {
            case 'ArrowDown': {
                event.preventDefault();
                const next = (focusedIndex + 1) % itemCount;
                setFocusedIndex(next);
                optionRefs.current[next]?.focus();
                break;
            }
            case 'ArrowUp': {
                event.preventDefault();
                const prev = (focusedIndex - 1 + itemCount) % itemCount;
                setFocusedIndex(prev);
                optionRefs.current[prev]?.focus();
                break;
            }
            case 'Home': {
                event.preventDefault();
                setFocusedIndex(0);
                optionRefs.current[0]?.focus();
                break;
            }
            case 'End': {
                event.preventDefault();
                const last = itemCount - 1;
                setFocusedIndex(last);
                optionRefs.current[last]?.focus();
                break;
            }
            case 'Escape': {
                event.preventDefault();
                setIsOpen(false);
                triggerRef.current?.focus();
                break;
            }
            case 'Tab': {
                // Close dropdown on Tab and let focus move naturally
                setIsOpen(false);
                break;
            }
        }
    }, [focusedIndex]);

    // ── Trigger keyboard: open with ArrowDown/Enter/Space ───────────
    function handleTriggerKeyDown(event: React.KeyboardEvent) {
        if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            setIsOpen(true);
        }
    }

    function handleToggle() {
        setIsOpen((prev) => !prev);
    }

    return (
        <div className="relative z-[9999]" ref={dropdownRef}>
            <button
                ref={triggerRef}
                onClick={handleToggle}
                onKeyDown={handleTriggerKeyDown}
                aria-expanded={isOpen}
                aria-haspopup="listbox"
                aria-label="Select language"
                className="flex items-center gap-2 px-3 py-2 bg-white/90 hover:bg-white backdrop-blur-sm border border-gray-200 rounded-xl shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-brand-primary-400"
            >
                <activeLocale.Flag className="w-5 h-auto rounded-sm shadow-sm" />
                <span className="text-sm font-semibold text-gray-700 hidden sm:block">{activeLocale.name}</span>
                <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div
                    role="listbox"
                    aria-label="Available languages"
                    aria-activedescendant={focusedIndex >= 0 ? `lang-option-${localeConfig[focusedIndex].code}` : undefined}
                    onKeyDown={handleKeyDown}
                    className="absolute right-0 mt-2 w-40 bg-white rounded-2xl shadow-xl border border-gray-100 py-2 z-[10000] animate-bounce-in origin-top-right"
                >
                    {localeConfig.map((loc, index) => (
                        <Link
                            key={loc.code}
                            ref={(el: HTMLAnchorElement | null) => { optionRefs.current[index] = el; }}
                            href={pathname}
                            locale={loc.code as AppLocale}
                            id={`lang-option-${loc.code}`}
                            role="option"
                            aria-selected={currentLocale === loc.code}
                            tabIndex={focusedIndex === index ? 0 : -1}
                            onClick={() => setIsOpen(false)}
                            className={`flex items-center gap-3 w-full px-4 py-2.5 text-left outline-none transition-colors
                                focus:bg-brand-primary-50 hover:bg-brand-primary-50
                                ${currentLocale === loc.code
                                    ? 'bg-brand-primary-50/50 text-brand-primary-600 font-bold'
                                    : 'text-gray-700 font-medium'
                                }`}
                        >
                            <loc.Flag className="w-5 h-auto rounded-sm shadow-sm" />
                            <span className="text-sm">{loc.name}</span>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
