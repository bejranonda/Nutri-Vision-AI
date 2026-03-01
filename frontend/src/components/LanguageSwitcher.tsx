'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { ChevronDown } from 'lucide-react';
import { TH, GB, DE, DK } from 'country-flag-icons/react/3x2';

const locales = [
    { code: 'th', Flag: TH, name: 'ไทย' },
    { code: 'en', Flag: GB, name: 'EN' },
    { code: 'de', Flag: DE, name: 'DE' },
    { code: 'da', Flag: DK, name: 'DA' },
];

export default function LanguageSwitcher({ currentLocale }: { currentLocale: string }) {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const pathname = usePathname();
    const router = useRouter();

    const activeLocale = locales.find((l) => l.code === currentLocale) || locales[0];

    // Close on outside click
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Close on Escape key
    useEffect(() => {
        function handleEscape(event: KeyboardEvent) {
            if (event.key === 'Escape') setIsOpen(false);
        }
        if (isOpen) {
            document.addEventListener('keydown', handleEscape);
            return () => document.removeEventListener('keydown', handleEscape);
        }
    }, [isOpen]);

    /**
     * Build the locale-switched path.
     * /en/scan → /th/scan,  /en → /th
     */
    const getLocalePath = useCallback((targetLocale: string) => {
        const segments = pathname.split('/');
        // segments: ['', 'en', 'scan', ...]
        if (segments.length > 1 && locales.some((l) => l.code === segments[1])) {
            segments[1] = targetLocale;
        } else {
            segments.splice(1, 0, targetLocale);
        }
        return segments.join('/') || `/${targetLocale}`;
    }, [pathname]);

    function handleSelectLocale(targetLocale: string) {
        setIsOpen(false);
        if (targetLocale !== currentLocale) {
            router.push(getLocalePath(targetLocale));
        }
    }

    return (
        <div className="relative" ref={dropdownRef} style={{ zIndex: 9999 }}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                aria-expanded={isOpen}
                aria-haspopup="listbox"
                className="flex items-center gap-2 px-3 py-2 bg-white/90 hover:bg-white backdrop-blur-sm border border-gray-200 rounded-xl shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-brand-primary-400"
            >
                <activeLocale.Flag className="w-5 h-auto rounded-sm shadow-sm" />
                <span className="text-sm font-semibold text-gray-700 hidden sm:block">{activeLocale.name}</span>
                <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div
                    role="listbox"
                    className="absolute right-0 mt-2 w-40 bg-white rounded-2xl shadow-xl border border-gray-100 py-2 animate-bounce-in origin-top-right"
                    style={{ zIndex: 10000 }}
                >
                    {locales.map((loc) => (
                        <button
                            key={loc.code}
                            role="option"
                            aria-selected={currentLocale === loc.code}
                            onClick={() => handleSelectLocale(loc.code)}
                            className={`flex items-center gap-3 w-full px-4 py-2.5 text-left hover:bg-brand-primary-50 transition-colors ${currentLocale === loc.code
                                ? 'bg-brand-primary-50/50 text-brand-primary-600 font-bold'
                                : 'text-gray-700 font-medium'
                                }`}
                        >
                            <loc.Flag className="w-5 h-auto rounded-sm shadow-sm" />
                            <span className="text-sm">{loc.name}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
