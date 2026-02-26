/**
 * EatInOrder — Auth Store (Zustand)
 * Client-side authentication with localStorage persistence.
 * Ready to swap for Cloudflare D1 + Workers API.
 */

'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { SubscriptionTier } from './tier-config';
import { redeemCode as redeemPromoCode, type RedemptionResult } from './promo-codes';

export interface User {
    id: string;
    email: string;
    displayName: string;
    tier: SubscriptionTier;
    trialExpiresAt: string | null;
    promoSource: string | null;
    scansThisMonth: number;
    aiQuestionsToday: number;
    streakDays: number;
    totalPoints: number;
    createdAt: string;
}

interface AuthState {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    error: string | null;

    // Actions
    login: (email: string, password: string) => Promise<boolean>;
    register: (displayName: string, email: string, password: string) => Promise<boolean>;
    logout: () => void;
    redeemCode: (code: string) => RedemptionResult;
    incrementScans: () => void;
    incrementAiQuestions: () => void;
    addPoints: (points: number) => void;
    clearError: () => void;
    getEffectiveTier: () => SubscriptionTier;
}

const USERS_DB_KEY = 'eatinorder_users_db';

function getUsersDb(): Record<string, { user: User; passwordHash: string }> {
    if (typeof window === 'undefined') return {};
    try {
        const stored = localStorage.getItem(USERS_DB_KEY);
        if (stored) return JSON.parse(stored);
    } catch { /* ignore */ }
    return {};
}

function saveUsersDb(db: Record<string, { user: User; passwordHash: string }>) {
    localStorage.setItem(USERS_DB_KEY, JSON.stringify(db));
}

// Simple hash for demo purposes (NOT for production!)
function simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set, get) => ({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,

            login: async (email: string, password: string): Promise<boolean> => {
                set({ isLoading: true, error: null });

                // Simulate network delay
                await new Promise((r) => setTimeout(r, 500));

                const db = getUsersDb();
                const entry = Object.values(db).find(
                    (e) => e.user.email.toLowerCase() === email.toLowerCase()
                );

                if (!entry) {
                    set({ isLoading: false, error: 'User not found. Please register first.' });
                    return false;
                }

                if (entry.passwordHash !== simpleHash(password)) {
                    set({ isLoading: false, error: 'Incorrect password.' });
                    return false;
                }

                set({
                    user: entry.user,
                    isAuthenticated: true,
                    isLoading: false,
                    error: null,
                });
                return true;
            },

            register: async (displayName: string, email: string, password: string): Promise<boolean> => {
                set({ isLoading: true, error: null });

                await new Promise((r) => setTimeout(r, 500));

                const db = getUsersDb();
                const exists = Object.values(db).some(
                    (e) => e.user.email.toLowerCase() === email.toLowerCase()
                );

                if (exists) {
                    set({ isLoading: false, error: 'An account with this email already exists.' });
                    return false;
                }

                const userId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
                const newUser: User = {
                    id: userId,
                    email,
                    displayName,
                    tier: 'free',
                    trialExpiresAt: null,
                    promoSource: null,
                    scansThisMonth: 0,
                    aiQuestionsToday: 0,
                    streakDays: 1,
                    totalPoints: 10, // Welcome bonus
                    createdAt: new Date().toISOString(),
                };

                db[userId] = { user: newUser, passwordHash: simpleHash(password) };
                saveUsersDb(db);

                set({
                    user: newUser,
                    isAuthenticated: true,
                    isLoading: false,
                    error: null,
                });
                return true;
            },

            logout: () => {
                set({ user: null, isAuthenticated: false, error: null });
            },

            redeemCode: (code: string): RedemptionResult => {
                const { user } = get();
                if (!user) {
                    return { success: false, message: 'Please login first', messageTh: 'กรุณาเข้าสู่ระบบก่อน' };
                }

                const result = redeemPromoCode(code, user.id);
                if (result.success && result.grantedTier) {
                    const updatedUser: User = {
                        ...user,
                        tier: result.grantedTier,
                        promoSource: code,
                    };
                    if (result.trialDays) {
                        updatedUser.trialExpiresAt = new Date(
                            Date.now() + result.trialDays * 86400000
                        ).toISOString();
                    }

                    // Update user in DB
                    const db = getUsersDb();
                    if (db[user.id]) {
                        db[user.id].user = updatedUser;
                        saveUsersDb(db);
                    }

                    set({ user: updatedUser });
                }

                return result;
            },

            incrementScans: () => {
                const { user } = get();
                if (!user) return;
                const updatedUser = { ...user, scansThisMonth: user.scansThisMonth + 1, totalPoints: user.totalPoints + 5 };
                set({ user: updatedUser });
                const db = getUsersDb();
                if (db[user.id]) { db[user.id].user = updatedUser; saveUsersDb(db); }
            },

            incrementAiQuestions: () => {
                const { user } = get();
                if (!user) return;
                const updatedUser = { ...user, aiQuestionsToday: user.aiQuestionsToday + 1 };
                set({ user: updatedUser });
                const db = getUsersDb();
                if (db[user.id]) { db[user.id].user = updatedUser; saveUsersDb(db); }
            },

            addPoints: (points: number) => {
                const { user } = get();
                if (!user) return;
                const updatedUser = { ...user, totalPoints: user.totalPoints + points };
                set({ user: updatedUser });
                const db = getUsersDb();
                if (db[user.id]) { db[user.id].user = updatedUser; saveUsersDb(db); }
            },

            clearError: () => set({ error: null }),

            getEffectiveTier: (): SubscriptionTier => {
                const { user } = get();
                if (!user) return 'free';
                // Check if trial has expired
                if (user.trialExpiresAt && new Date(user.trialExpiresAt) < new Date()) {
                    return 'free';
                }
                return user.tier;
            },
        }),
        {
            name: 'eatinorder-auth',
            partialize: (state) => ({
                user: state.user,
                isAuthenticated: state.isAuthenticated,
            }),
        }
    )
);
