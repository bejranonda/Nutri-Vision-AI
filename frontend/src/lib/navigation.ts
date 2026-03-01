import { createNavigation } from 'next-intl/navigation';
import { locales, defaultLocale } from './i18n-config';

/**
 * Locale-aware navigation utilities powered by next-intl.
 *
 * These wrappers automatically handle locale prefix replacement
 * when navigating between pages, eliminating manual string manipulation.
 *
 * Usage:
 *   import { Link, useRouter, usePathname } from '@/lib/navigation';
 */
export const { Link, useRouter, usePathname, redirect } = createNavigation({
    locales,
    defaultLocale,
});
