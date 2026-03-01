import { TH, GB, DE, DK } from 'country-flag-icons/react/3x2';

/**
 * Centralized i18n configuration — Single Source of Truth.
 *
 * All locale definitions live here. When adding a new language,
 * update ONLY this file and the corresponding messages/*.json.
 */

export const locales = ['th', 'en', 'de', 'da'] as const;
export type AppLocale = (typeof locales)[number];
export const defaultLocale: AppLocale = 'th';

export const localeConfig: { code: AppLocale; Flag: typeof TH; name: string }[] = [
    { code: 'th', Flag: TH, name: 'ไทย' },
    { code: 'en', Flag: GB, name: 'EN' },
    { code: 'de', Flag: DE, name: 'DE' },
    { code: 'da', Flag: DK, name: 'DA' },
];
