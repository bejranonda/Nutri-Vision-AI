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
    // `authChecked` is false until initAuth() has resolved at least once.
    // Auth-gated pages MUST gate their redirects on this — `isAuthenticated`
    // starts false (auth lives in HttpOnly cookies, not Zustand persist),
    // so a guard that redirects on `!isAuthenticated` alone fires during the
    // pre-probe window and bounces users who ARE logged in. /chat was
    // unreachable on hard-load/refresh because of exactly this race.
    authChecked: boolean;
    isLoading: boolean;
    error: string | null;

    initAuth: () => Promise<void>;
    login: (email: string, password: string) => Promise<boolean>;
    register: (name: string, email: string, password: string, voucherCode?: string) => Promise<boolean>;
    logout: () => Promise<void>;
    redeemCode: (code: string) => Promise<{ success: boolean; message: string }>;
    clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
    user: null,
    isAuthenticated: false,
    authChecked: false,
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
            // /api/auth/me answers 200 { authenticated, user } for both the
            // logged-in and anonymous cases (it's a probe, not a gate), so
            // key off `data.user` rather than the status code. Still falls
            // through to the unauthenticated branch if a non-2xx ever slips
            // back in (defensive against a future route regression).
            const res = await fetch('/api/auth/me');
            const data = await res.json().catch(() => ({}));
            if (res.ok && data.user) {
                set({ user: data.user, isAuthenticated: true, authChecked: true, isLoading: false, error: null });
            } else {
                set({ user: null, isAuthenticated: false, authChecked: true, isLoading: false });
            }
        } catch (e) {
            set({ user: null, isAuthenticated: false, authChecked: true, isLoading: false });
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

            set({ user: data.user, isAuthenticated: true, authChecked: true, isLoading: false });
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

            set({ user: data.user, isAuthenticated: true, authChecked: true, isLoading: false });
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
            set({ user: null, isAuthenticated: false, authChecked: true, isLoading: false, error: null });
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

    clearError: () => set({ error: null })
}));
