/**
 * Shinny Guide — Feature Tier Configuration
 * Maps features to subscription tiers (free/premium/family)
 * Designed for freemium → subscription business model
 */

export type SubscriptionTier = 'free' | 'premium' | 'family';

export interface TierLimits {
    scansPerMonth: number;
    aiQuestionsPerDay: number;
    maxPhotosPerScan: number;
    recipesAccess: number;
    scoresDimensions: number;
    familyMembers: number;
    mealPlanning: boolean;
    progressTracking: boolean;
    dataExport: boolean;
    noAds: boolean;
    prioritySupport: boolean;
}

export const TIER_LIMITS: Record<SubscriptionTier, TierLimits> = {
    free: {
        scansPerMonth: 10,
        aiQuestionsPerDay: 3,
        maxPhotosPerScan: 3,
        recipesAccess: 100,
        scoresDimensions: 3, // Only overall, blood sugar, gut health
        familyMembers: 0,
        mealPlanning: false,
        progressTracking: false,
        dataExport: false,
        noAds: false,
        prioritySupport: false,
    },
    premium: {
        scansPerMonth: Infinity,
        aiQuestionsPerDay: Infinity,
        maxPhotosPerScan: 10,
        recipesAccess: 1000,
        scoresDimensions: 8,
        familyMembers: 0,
        mealPlanning: true,
        progressTracking: true,
        dataExport: true,
        noAds: true,
        prioritySupport: true,
    },
    family: {
        scansPerMonth: Infinity,
        aiQuestionsPerDay: Infinity,
        maxPhotosPerScan: 10,
        recipesAccess: 1000,
        familyMembers: 5,
        scoresDimensions: 8,
        mealPlanning: true,
        progressTracking: true,
        dataExport: true,
        noAds: true,
        prioritySupport: true,
    },
};

export interface TierPricing {
    monthly: number;       // THB
    annual: number;        // THB
    annualMonthly: number; // THB (annual / 12)
    discountPercent: number;
    currency: string;
}

export const TIER_PRICING: Record<Exclude<SubscriptionTier, 'free'>, TierPricing> = {
    premium: {
        monthly: 199,
        annual: 1699,
        annualMonthly: 142,
        discountPercent: 29,
        currency: 'THB',
    },
    family: {
        monthly: 299,
        annual: 2499,
        annualMonthly: 208,
        discountPercent: 30,
        currency: 'THB',
    },
};

export const FREE_SCORE_DIMENSIONS = ['overall', 'bloodSugar', 'gutHealth'];
export const ALL_SCORE_DIMENSIONS = [
    'bloodSugar',
    'gutHealth',
    'inflammation',
    'nutrientDensity',
    'processing',
    'proteinQuality',
    'micronutrient',
    'overall',
];

/** Map camelCase score keys to i18n translation keys (used in scan page) */
export const SCORE_I18N_KEYS: Record<string, string> = {
    bloodSugar: 'blood_sugar',
    gutHealth: 'gut_health',
    inflammation: 'inflammation',
    nutrientDensity: 'nutrient_density',
    processing: 'processing',
    proteinQuality: 'protein_quality',
    micronutrient: 'micronutrient',
    overall: 'overall',
};

export function isFeatureAvailable(tier: SubscriptionTier, feature: keyof TierLimits): boolean {
    const limits = TIER_LIMITS[tier];
    const value = limits[feature];
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value > 0;
    return false;
}

export function canScan(tier: SubscriptionTier, currentMonthScans: number): boolean {
    return currentMonthScans < TIER_LIMITS[tier].scansPerMonth;
}

export function canAskAI(tier: SubscriptionTier, todayQuestions: number): boolean {
    return todayQuestions < TIER_LIMITS[tier].aiQuestionsPerDay;
}

export function canAddMorePhotos(tier: SubscriptionTier, currentPhotoCount: number): boolean {
    return currentPhotoCount < TIER_LIMITS[tier].maxPhotosPerScan;
}
