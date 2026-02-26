'use client';

import { useState, useRef, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
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

    const activeLocale = locales.find((l) => l.code === currentLocale) || locales[0];

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    /**
     * Build the locale-switched path.
     * Current pathname: /en/scan → replace /en with /th → /th/scan
     * If on root /en → /th
     */
    function getLocalePath(targetLocale: string) {
        // Remove the current locale prefix and prepend the new one
        const segments = pathname.split('/');
        // segments[0] = '', segments[1] = currentLocale, segments[2..] = rest
        if (segments.length > 1 && locales.some((l) => l.code === segments[1])) {
            segments[1] = targetLocale;
        } else {
            segments.splice(1, 0, targetLocale);
        }
        return segments.join('/') || `/${targetLocale}`;
    }

    return (
        <div className="relative z-50" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-3 py-2 bg-white/80 hover:bg-white backdrop-blur-sm border border-gray-200 rounded-xl shadow-sm transition-all focus:outline-none"
            >
                <activeLocale.Flag className="w-5 h-auto rounded-sm shadow-sm" />
                <span className="text-sm font-semibold text-gray-700 hidden sm:block">{activeLocale.name}</span>
                <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-36 bg-white rounded-2xl shadow-glass-hover border border-gray-100 overflow-hidden z-[100] animate-bounce-in origin-top-right">
                    <div className="py-2">
                        {locales.map((loc) => (
                            <Link
                                key={loc.code}
                                href={getLocalePath(loc.code)}
                                onClick={() => setIsOpen(false)}
                                className={`flex items-center gap-3 px-4 py-2.5 hover:bg-brand-primary-50 transition-colors ${currentLocale === loc.code ? 'bg-brand-primary-50/50 text-brand-primary-600 font-bold' : 'text-gray-700 font-medium'
                                    }`}
                            >
                                <loc.Flag className="w-5 h-auto rounded-sm shadow-sm" />
                                <span className="text-sm">{loc.name}</span>
                            </Link>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
