/**
 * Shinny Guide — Promotion / Voucher Code System
 * Supports: TRIAL, DISCOUNT, FANCLUB, REFERRAL code types
 * Client-side implementation; ready for D1 backend swap
 */

import type { SubscriptionTier } from './tier-config';

export type PromoCodeType = 'TRIAL' | 'DISCOUNT' | 'FANCLUB' | 'REFERRAL';

export interface PromoCode {
    id: string;
    code: string;
    type: PromoCodeType;
    description: string;
    descriptionTh: string;
    /** For TRIAL type: number of days granted */
    trialDays?: number;
    /** For DISCOUNT type: percentage off (0-100) */
    discountPercent?: number;
    /** Tier to grant (defaults to 'premium') */
    grantTier: SubscriptionTier;
    /** Max total redemptions allowed */
    usageLimit: number;
    /** Current number of redemptions */
    usageCount: number;
    /** Expiry date ISO string */
    expiresAt: string;
    /** Whether the code is active */
    isActive: boolean;
    createdAt: string;
}

export interface RedemptionResult {
    success: boolean;
    message: string;
    messageTh: string;
    grantedTier?: SubscriptionTier;
    trialDays?: number;
    discountPercent?: number;
}

// Built-in demo promo codes
const BUILT_IN_CODES: PromoCode[] = [
    {
        id: 'promo_shinny2024',
        code: 'SHINNY2024',
        type: 'FANCLUB',
        description: 'Shinny Fanclub — 30 days Premium free!',
        descriptionTh: 'แฟนคลับชินนี่ — ใช้พรีเมียมฟรี 30 วัน!',
        trialDays: 30,
        grantTier: 'premium',
        usageLimit: 10000,
        usageCount: 0,
        expiresAt: '2027-12-31T23:59:59Z',
        isActive: true,
        createdAt: '2024-01-01T00:00:00Z',
    },
    {
        id: 'promo_eatwell',
        code: 'EATWELL',
        type: 'TRIAL',
        description: '7-day Premium trial — Try all features!',
        descriptionTh: 'ทดลองพรีเมียม 7 วัน — ลองฟีเจอร์ทั้งหมด!',
        trialDays: 7,
        grantTier: 'premium',
        usageLimit: 50000,
        usageCount: 0,
        expiresAt: '2027-12-31T23:59:59Z',
        isActive: true,
        createdAt: '2024-01-01T00:00:00Z',
    },
    {
        id: 'promo_launch50',
        code: 'LAUNCH50',
        type: 'DISCOUNT',
        description: 'Launch Special — 50% off first month!',
        descriptionTh: 'โปรเปิดตัว — ลด 50% เดือนแรก!',
        discountPercent: 50,
        grantTier: 'premium',
        usageLimit: 1000,
        usageCount: 0,
        expiresAt: '2027-06-30T23:59:59Z',
        isActive: true,
        createdAt: '2024-01-01T00:00:00Z',
    },
    {
        id: 'promo_family2024',
        code: 'FAMILY2024',
        type: 'TRIAL',
        description: 'Family Plan — 14 days Family tier free!',
        descriptionTh: 'แพลนครอบครัว — ทดลองแฟมิลี่ฟรี 14 วัน!',
        trialDays: 14,
        grantTier: 'family',
        usageLimit: 5000,
        usageCount: 0,
        expiresAt: '2027-12-31T23:59:59Z',
        isActive: true,
        createdAt: '2024-01-01T00:00:00Z',
    },
];

const STORAGE_KEY = 'shinnyguide_promo_codes';
const REDEMPTION_KEY = 'shinnyguide_redemptions';

function getStoredCodes(): PromoCode[] {
    if (typeof window === 'undefined') return BUILT_IN_CODES;
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) return JSON.parse(stored);
    } catch { /* ignore */ }
    // Initialize with built-in codes
    localStorage.setItem(STORAGE_KEY, JSON.stringify(BUILT_IN_CODES));
    return BUILT_IN_CODES;
}

function getRedemptions(): Record<string, string[]> {
    if (typeof window === 'undefined') return {};
    try {
        const stored = localStorage.getItem(REDEMPTION_KEY);
        if (stored) return JSON.parse(stored);
    } catch { /* ignore */ }
    return {};
}

export function validateCode(code: string): { valid: boolean; promo?: PromoCode; error?: string; errorTh?: string } {
    const codes = getStoredCodes();
    const promo = codes.find((c) => c.code.toUpperCase() === code.toUpperCase().trim());

    if (!promo) {
        return { valid: false, error: 'Invalid promotion code', errorTh: 'รหัสโปรโมชั่นไม่ถูกต้อง' };
    }
    if (!promo.isActive) {
        return { valid: false, error: 'This code is no longer active', errorTh: 'รหัสนี้ไม่ได้ใช้งานแล้ว' };
    }
    if (new Date(promo.expiresAt) < new Date()) {
        return { valid: false, error: 'This code has expired', errorTh: 'รหัสนี้หมดอายุแล้ว' };
    }
    if (promo.usageCount >= promo.usageLimit) {
        return { valid: false, error: 'This code has reached its usage limit', errorTh: 'รหัสนี้ถูกใช้ครบจำนวนแล้ว' };
    }

    return { valid: true, promo };
}

export function redeemCode(code: string, userId: string): RedemptionResult {
    const validation = validateCode(code);
    if (!validation.valid || !validation.promo) {
        return {
            success: false,
            message: validation.error || 'Invalid code',
            messageTh: validation.errorTh || 'รหัสไม่ถูกต้อง',
        };
    }

    const promo = validation.promo;

    // Check if user already redeemed this code
    const redemptions = getRedemptions();
    const userRedemptions = redemptions[userId] || [];
    if (userRedemptions.includes(promo.id)) {
        return {
            success: false,
            message: 'You have already redeemed this code',
            messageTh: 'คุณได้ใช้รหัสนี้แล้ว',
        };
    }

    // Record redemption
    userRedemptions.push(promo.id);
    redemptions[userId] = userRedemptions;
    localStorage.setItem(REDEMPTION_KEY, JSON.stringify(redemptions));

    // Increment usage count
    const codes = getStoredCodes();
    const idx = codes.findIndex((c) => c.id === promo.id);
    if (idx >= 0) {
        codes[idx].usageCount++;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(codes));
    }

    switch (promo.type) {
        case 'TRIAL':
        case 'FANCLUB':
            return {
                success: true,
                message: `${promo.description} — Enjoy ${promo.trialDays} days of ${promo.grantTier}!`,
                messageTh: `${promo.descriptionTh} — ใช้ ${promo.grantTier} ได้ ${promo.trialDays} วัน!`,
                grantedTier: promo.grantTier,
                trialDays: promo.trialDays,
            };
        case 'DISCOUNT':
            return {
                success: true,
                message: `${promo.description} — ${promo.discountPercent}% discount applied!`,
                messageTh: `${promo.descriptionTh} — ลดราคา ${promo.discountPercent}% แล้ว!`,
                grantedTier: promo.grantTier,
                discountPercent: promo.discountPercent,
            };
        case 'REFERRAL':
            return {
                success: true,
                message: `Referral code redeemed! Enjoy your benefits.`,
                messageTh: `ใช้รหัสแนะนำสำเร็จ! เพลิดเพลินกับสิทธิประโยชน์`,
                grantedTier: promo.grantTier,
                trialDays: promo.trialDays,
            };
    }
}

/**
 * Generate a new promo code (admin utility).
 * In production, this would be a server-side API.
 */
export function generateCode(config: {
    type: PromoCodeType;
    prefix?: string;
    trialDays?: number;
    discountPercent?: number;
    grantTier?: SubscriptionTier;
    usageLimit?: number;
    expiresInDays?: number;
    description?: string;
    descriptionTh?: string;
}): PromoCode {
    const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
    const prefix = config.prefix || config.type.substring(0, 3);
    const code = `${prefix}-${randomPart}`;

    const newPromo: PromoCode = {
        id: `promo_${Date.now()}_${randomPart}`,
        code,
        type: config.type,
        description: config.description || `${config.type} promotion`,
        descriptionTh: config.descriptionTh || `โปรโมชั่น ${config.type}`,
        trialDays: config.trialDays,
        discountPercent: config.discountPercent,
        grantTier: config.grantTier || 'premium',
        usageLimit: config.usageLimit || 100,
        usageCount: 0,
        expiresAt: new Date(Date.now() + (config.expiresInDays || 90) * 86400000).toISOString(),
        isActive: true,
        createdAt: new Date().toISOString(),
    };

    const codes = getStoredCodes();
    codes.push(newPromo);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(codes));

    return newPromo;
}

/** Get all available promo codes (admin) */
export function getAllCodes(): PromoCode[] {
    return getStoredCodes();
}
