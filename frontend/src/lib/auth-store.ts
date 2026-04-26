import { create } from 'zustand';
import { SubscriptionTier } from './tier-config';

export interface User {
    id: string;
    email: string;
    displayName: string;
    subscriptionTier: SubscriptionTier;
    scansThisMonth: number;
    totalPoints: number;
    streakDays: number;
    trialExpiresAt?: Date | null;
}

// The new Zustand store focuses only on React state.
// All persistence and security is handled by HttpOnly cookies and /api/* routes.

interface AuthState {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    error: string | null;

    initAuth: () => Promise<void>;
    login: (email: string, password: string) => Promise<boolean>;
    register: (name: string, email: string, password: string, voucherCode?: string) => Promise<boolean>;
    logout: () => Promise<void>;
    redeemCode: (code: string) => Promise<{ success: boolean; message: string }>;
    isFeatureAvailable: (featureKey: string) => boolean;
    clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
    user: null,
    isAuthenticated: false,
    // `isLoading` is true only while an async action (login, register,
    // redeem, session-probe) is in flight. We start at FALSE — nothing
    // calls initAuth() during the module-evaluation phase, so starting
    // at true would leave the store permanently stuck (login button
    // disabled forever). Consumers that want an on-mount session probe
    // must call initAuth() themselves in a useEffect.
    isLoading: false,
    error: null,

    initAuth: async () => {
        try {
            const res = await fetch('/api/auth/me');
            if (res.ok) {
                const data = await res.json();
                set({ user: data.user, isAuthenticated: true, isLoading: false, error: null });
            } else {
                set({ user: null, isAuthenticated: false, isLoading: false });
            }
        } catch (e) {
            set({ user: null, isAuthenticated: false, isLoading: false });
        }
    },

    login: async (email, password) => {
        set({ isLoading: true, error: null });
        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Login failed');

            set({ user: data.user, isAuthenticated: true, isLoading: false });
            return true;
        } catch (e: any) {
            set({ error: e.message, isLoading: false });
            return false;
        }
    },

    register: async (name, email, password, voucherCode) => {
        set({ isLoading: true, error: null });
        try {
            // Only send `voucherCode` when it's non-empty. Omitting it lets
            // the server apply the feature-flag default ("voucher required?")
            // rather than us guessing client-side.
            const body: Record<string, string> = { displayName: name, email, password };
            if (voucherCode && voucherCode.trim()) body.voucherCode = voucherCode.trim();

            const res = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Registration failed');

            set({ user: data.user, isAuthenticated: true, isLoading: false });
            return true;
        } catch (e: any) {
            set({ error: e.message, isLoading: false });
            return false;
        }
    },

    logout: async () => {
        set({ isLoading: true });
        try {
            await fetch('/api/auth/logout', { method: 'POST' });
        } finally {
            // Clear state regardless of API success to ensure client logs out
            set({ user: null, isAuthenticated: false, isLoading: false, error: null });
        }
    },

    redeemCode: async (code) => {
        set({ isLoading: true, error: null });
        try {
            const res = await fetch('/api/promo/redeem', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to redeem code');

            // Re-fetch user to get updated tier
            await get().initAuth();

            set({ isLoading: false });
            return { success: true, message: data.message };
        } catch (e: any) {
            set({ error: e.message, isLoading: false });
            return { success: false, message: e.message };
        }
    },

    isFeatureAvailable: (featureKey) => {
        // Client-side quick check, backend enforces actual limits
        const { user, isAuthenticated } = get();
        if (!isAuthenticated || !user) return false;

        // Simplistic feature check for UI rendering (e.g. showing "Upgrade" buttons)
        // Real logic runs on edge via tierFeatureLimits
        if (user.subscriptionTier === 'free' && featureKey === 'fullScores') return false;
        return true;
    },

    clearError: () => set({ error: null })
}));
