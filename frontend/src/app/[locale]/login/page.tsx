'use client';

import { useState, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, UserCircle, Mail, Lock, User, Eye, EyeOff, Gift, Sparkles, ChevronRight } from 'lucide-react';
import { useAuthStore } from '@/lib/auth-store';
import { logger } from '@/lib/logger';
import LanguageSwitcher from '@/components/LanguageSwitcher';

export default function LoginPage() {
    const t = useTranslations('auth');
    const tCommon = useTranslations('common');
    const locale = useLocale();
    const router = useRouter();

    const { login, register, redeemCode, initAuth, isAuthenticated, isLoading, error, clearError } = useAuthStore();

    const [mode, setMode] = useState<'login' | 'register'>('login');
    const [showPassword, setShowPassword] = useState(false);
    const [promoInput, setPromoInput] = useState('');
    const [promoMessage, setPromoMessage] = useState('');
    const [promoSuccess, setPromoSuccess] = useState(false);
    const [successMsg, setSuccessMsg] = useState('');

    // Form fields
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [voucherCode, setVoucherCode] = useState('');
    const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

    // Voucher live-check state. `voucherStatus` is one of:
    //   - 'idle'     : no input yet, or too short to check
    //   - 'checking' : the debounced fetch is in flight
    //   - 'valid'    : server said the code is usable
    //   - 'invalid'  : server said the code is not usable; `voucherReason` holds the enum
    const [voucherStatus, setVoucherStatus] = useState<'idle' | 'checking' | 'valid' | 'invalid'>('idle');
    const [voucherReason, setVoucherReason] = useState<string | null>(null);
    const [voucherInfo, setVoucherInfo] = useState<{
        remainingSeats: number | null;
        expiresAt: string | null;
        grantTier: string | null;
        trialDays: number | null;
    } | null>(null);

    // Probe the session cookie on mount. If the user already has a valid
    // session (e.g. they hit /login directly after logging in in another
    // tab), initAuth() will flip `isAuthenticated` to true and the effect
    // below bounces them straight to /dashboard — no redundant login UI.
    useEffect(() => {
        initAuth();
        // intentionally empty deps — run exactly once on mount.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (isAuthenticated) {
            setTimeout(() => router.push(`/${locale}/dashboard`), 1500);
        }
    }, [isAuthenticated, locale, router]);

    useEffect(() => {
        logger.trackFeature('Login Page', 'loading', { locale, mode });
    }, [locale, mode]);

    // Debounced voucher-code live-check. Runs whenever the user types
    // in register mode. Cancellation via AbortController so a stale
    // response can't overwrite a newer one.
    useEffect(() => {
        if (mode !== 'register') return;
        const code = voucherCode.trim();
        if (code.length < 3) {
            setVoucherStatus('idle');
            setVoucherReason(null);
            setVoucherInfo(null);
            return;
        }
        setVoucherStatus('checking');
        const ctrl = new AbortController();
        const handle = setTimeout(async () => {
            try {
                const res = await fetch(`/api/voucher/check?code=${encodeURIComponent(code)}`, {
                    signal: ctrl.signal,
                });
                if (!res.ok) {
                    // 400 (malformed) / 429 (rate-limited) / 500 — treat as
                    // invalid but don't block re-tries; user can edit + retry.
                    setVoucherStatus('invalid');
                    setVoucherReason(res.status === 429 ? 'rate_limited' : 'check_failed');
                    setVoucherInfo(null);
                    return;
                }
                const data = await res.json();
                if (data.valid) {
                    setVoucherStatus('valid');
                    setVoucherReason(null);
                    setVoucherInfo({
                        remainingSeats: data.remainingSeats ?? null,
                        expiresAt: data.expiresAt ?? null,
                        grantTier: data.grantTier ?? null,
                        trialDays: data.trialDays ?? null,
                    });
                } else {
                    setVoucherStatus('invalid');
                    setVoucherReason(data.reason ?? 'not_found');
                    setVoucherInfo(null);
                }
            } catch (e) {
                // AbortError is the expected cancellation path — don't flip state.
                if ((e as any)?.name === 'AbortError') return;
                setVoucherStatus('invalid');
                setVoucherReason('check_failed');
                setVoucherInfo(null);
            }
        }, 350);
        return () => {
            ctrl.abort();
            clearTimeout(handle);
        };
    }, [voucherCode, mode]);

    function validate(): boolean {
        const errors: Record<string, string> = {};
        if (!email.trim()) errors.email = t('validation.email_required');
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = t('validation.email_invalid');
        if (!password) errors.password = t('validation.password_required');
        else if (password.length < 6) errors.password = t('validation.password_min');
        if (mode === 'register') {
            if (!displayName.trim()) errors.displayName = t('validation.name_required');
            if (password !== confirmPassword) errors.confirmPassword = t('validation.password_mismatch');
        }
        setValidationErrors(errors);
        return Object.keys(errors).length === 0;
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        clearError();
        if (!validate()) return;

        let success: boolean;
        if (mode === 'login') {
            success = await login(email, password);
            if (success) setSuccessMsg(t('login_success'));
        } else {
            // Block submission while a voucher is still being checked; we
            // don't want to race a stale "checking" state against the
            // server's authoritative validation. If the code is empty, let
            // the server enforce its feature-flag default (voucher required
            // or not) and surface the error — don't second-guess client-side.
            if (voucherStatus === 'checking') return;
            if (voucherCode.trim() && voucherStatus === 'invalid') return;
            success = await register(displayName, email, password, voucherCode);
            if (success) setSuccessMsg(t('register_success'));
        }
    }

    async function handlePromoRedeem() {
        if (!promoInput.trim()) return;
        const result = await redeemCode(promoInput);
        setPromoSuccess(result.success);
        setPromoMessage(result.message);
    }

    return (
        <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-brand-primary-50 via-white to-brand-secondary-50 flex flex-col items-center justify-center p-4">
            {/* Background blobs */}
            <div className="absolute top-0 -left-1/4 w-1/2 h-1/2 bg-brand-primary-400/20 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-float"></div>
            <div className="absolute -bottom-1/4 right-1/4 w-1/2 h-1/2 bg-brand-secondary-400/20 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-float" style={{ animationDelay: '2s' }}></div>

            {/* Back button + Language */}
            <div className="absolute top-4 left-4 right-4 z-20 flex items-center justify-between">
                <Link href={`/${locale}`} className="inline-flex items-center gap-2 px-4 py-2 bg-white/80 backdrop-blur-sm rounded-xl text-gray-600 hover:text-brand-primary-500 transition-colors border border-gray-200">
                    <ArrowLeft className="w-4 h-4" /> {tCommon('back_to_home')}
                </Link>
                <LanguageSwitcher currentLocale={locale} />
            </div>

            {/* Success state */}
            {successMsg && (
                <div className="z-10 backdrop-blur-md bg-white/90 rounded-3xl p-8 max-w-md w-full mx-auto shadow-glass text-center animate-bounce-in">
                    <div className="w-20 h-20 mx-auto bg-gradient-to-br from-green-400 to-emerald-500 rounded-3xl flex items-center justify-center shadow-success mb-6">
                        <Sparkles className="text-white w-10 h-10" />
                    </div>
                    <h2 className="text-2xl font-bold text-green-600 mb-2">{tCommon('success')}</h2>
                    <p className="text-gray-600">{successMsg}</p>
                </div>
            )}

            {/* Main form card */}
            {!successMsg && (
                <div className="z-10 backdrop-blur-md bg-white/90 rounded-3xl p-8 max-w-md w-full mx-auto shadow-glass animate-slide-up">
                    {/* Header */}
                    <div className="text-center mb-6">
                        <div className="w-16 h-16 mx-auto bg-gradient-to-br from-brand-primary-400 to-brand-secondary-400 rounded-2xl flex items-center justify-center shadow-brand mb-4">
                            <UserCircle className="text-white w-8 h-8" />
                        </div>
                        <h1 className="text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-brand-primary-500 to-brand-secondary-500">
                            {mode === 'login' ? t('welcome_back') : t('create_account')}
                        </h1>
                        <p className="text-gray-500 text-sm mt-1">
                            {mode === 'login' ? t('login_subtitle') : t('register_subtitle')}
                        </p>
                    </div>

                    {/* Mode tabs */}
                    <div className="flex bg-gray-100 rounded-xl p-1 mb-6">
                        <button
                            onClick={() => { setMode('login'); clearError(); setValidationErrors({}); }}
                            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${mode === 'login' ? 'bg-white text-brand-primary-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            {t('login')}
                        </button>
                        <button
                            onClick={() => { setMode('register'); clearError(); setValidationErrors({}); }}
                            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${mode === 'register' ? 'bg-white text-brand-primary-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            {t('register')}
                        </button>
                    </div>

                    {/* Error message */}
                    {error && (
                        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4 text-red-600 text-sm animate-slide-up">
                            {error}
                        </div>
                    )}

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {mode === 'register' && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">{t('display_name')}</label>
                                <div className="relative">
                                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input
                                        type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)}
                                        className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-primary-400 focus:border-transparent outline-none transition-all text-gray-900"
                                        placeholder="Shinny"
                                    />
                                </div>
                                {validationErrors.displayName && <p className="text-red-500 text-xs mt-1">{validationErrors.displayName}</p>}
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">{t('email')}</label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                                    className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-primary-400 focus:border-transparent outline-none transition-all text-gray-900"
                                    placeholder="you@example.com"
                                />
                            </div>
                            {validationErrors.email && <p className="text-red-500 text-xs mt-1">{validationErrors.email}</p>}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">{t('password')}</label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)}
                                    className="w-full pl-10 pr-12 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-primary-400 focus:border-transparent outline-none transition-all text-gray-900"
                                    placeholder="••••••"
                                />
                                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                            {validationErrors.password && <p className="text-red-500 text-xs mt-1">{validationErrors.password}</p>}
                        </div>

                        {mode === 'register' && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">{t('confirm_password')}</label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input
                                        type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                                        className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-primary-400 focus:border-transparent outline-none transition-all text-gray-900"
                                        placeholder="••••••"
                                    />
                                </div>
                                {validationErrors.confirmPassword && <p className="text-red-500 text-xs mt-1">{validationErrors.confirmPassword}</p>}
                            </div>
                        )}

                        {mode === 'register' && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    {t('voucher_label')}
                                </label>
                                <div className="relative">
                                    <Gift className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input
                                        type="text"
                                        value={voucherCode}
                                        onChange={(e) => setVoucherCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ''))}
                                        maxLength={64}
                                        autoComplete="off"
                                        spellCheck={false}
                                        className={`w-full pl-10 pr-10 py-3 bg-gray-50 border rounded-xl focus:ring-2 focus:border-transparent outline-none transition-all font-mono text-gray-900 ${
                                            voucherStatus === 'valid'
                                                ? 'border-green-300 focus:ring-green-400'
                                                : voucherStatus === 'invalid'
                                                    ? 'border-red-300 focus:ring-red-400'
                                                    : 'border-gray-200 focus:ring-brand-primary-400'
                                        }`}
                                        placeholder={t('voucher_placeholder')}
                                    />
                                    {voucherStatus === 'checking' && (
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-gray-300 border-t-brand-primary-500 rounded-full animate-spin" aria-label="Checking" />
                                    )}
                                    {voucherStatus === 'valid' && (
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                                            <span className="text-white text-xs font-bold">✓</span>
                                        </div>
                                    )}
                                </div>
                                <p className="text-xs text-gray-500 mt-1">{t('voucher_help')}</p>
                                {voucherStatus === 'valid' && voucherInfo && (
                                    <p className="text-xs text-green-600 mt-1">
                                        {t('voucher_valid_banner', {
                                            tier: voucherInfo.grantTier ?? 'free',
                                            days: voucherInfo.trialDays ?? 0,
                                        })}
                                        {voucherInfo.remainingSeats !== null && (
                                            <> · {t('voucher_seats_remaining', { n: voucherInfo.remainingSeats })}</>
                                        )}
                                    </p>
                                )}
                                {voucherStatus === 'invalid' && voucherReason && (
                                    <p className="text-xs text-red-500 mt-1">
                                        {voucherReason === 'inactive' && t('voucher_invalid.inactive')}
                                        {voucherReason === 'expired' && t('voucher_invalid.expired')}
                                        {voucherReason === 'exhausted' && t('voucher_invalid.exhausted')}
                                        {voucherReason === 'wrong_scope' && t('voucher_invalid.wrong_scope')}
                                        {voucherReason === 'rate_limited' && t('voucher_invalid.rate_limited')}
                                        {voucherReason === 'check_failed' && t('voucher_invalid.check_failed')}
                                        {(voucherReason === 'not_found' || !['inactive','expired','exhausted','wrong_scope','rate_limited','check_failed'].includes(voucherReason)) && t('voucher_invalid.not_found')}
                                    </p>
                                )}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={
                                isLoading ||
                                // Block submit while the voucher check is pending or
                                // if the user typed a code that the server rejected.
                                // Empty code is fine — the server enforces the
                                // feature-flag default and surfaces the error.
                                (mode === 'register' && voucherStatus === 'checking') ||
                                (mode === 'register' && voucherCode.trim().length > 0 && voucherStatus === 'invalid')
                            }
                            className="w-full py-3.5 bg-gradient-to-r from-brand-primary-400 to-brand-secondary-400 text-white font-bold rounded-xl hover:shadow-brand-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {isLoading ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            ) : (
                                <>
                                    {mode === 'login' ? t('login') : t('register')}
                                    <ChevronRight className="w-4 h-4" />
                                </>
                            )}
                        </button>
                    </form>

                    {/* Social login */}
                    <div className="mt-6">
                        <div className="relative">
                            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200"></div></div>
                            <div className="relative flex justify-center text-sm"><span className="px-3 bg-white text-gray-400">{t('or')}</span></div>
                        </div>
                        <div className="mt-4 grid grid-cols-2 gap-3">
                            <button
                                onClick={() => { setPromoMessage(t('social_coming_soon')); setPromoSuccess(false); }}
                                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-all text-sm font-medium text-gray-600"
                            >
                                <svg className="w-4 h-4" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" /><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" /><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" /><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" /></svg>
                                Google
                            </button>
                            <button
                                onClick={() => { setPromoMessage(t('social_coming_soon')); setPromoSuccess(false); }}
                                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-[#06C755] border border-[#06C755] rounded-xl hover:bg-[#05b64d] transition-all text-sm font-medium text-white"
                            >
                                LINE
                            </button>
                        </div>
                    </div>

                    {/* Promo code section */}
                    <div className="mt-6 pt-6 border-t border-gray-100">
                        <div className="flex items-center gap-2 mb-3">
                            <Gift className="w-4 h-4 text-brand-accent-500" />
                            <span className="text-sm font-medium text-gray-600">{t('promo_section')}</span>
                        </div>
                        <div className="flex gap-2">
                            <input
                                type="text" value={promoInput} onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                                placeholder={t('promo_placeholder')}
                                className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-accent-400 focus:border-transparent outline-none text-gray-900"
                            />
                            <button
                                onClick={handlePromoRedeem}
                                className="px-4 py-2.5 bg-gradient-to-r from-brand-accent-400 to-brand-accent-500 text-white text-sm font-semibold rounded-xl hover:shadow-warning transition-all whitespace-nowrap"
                            >
                                {t('promo_apply')}
                            </button>
                        </div>
                        {promoMessage && (
                            <p className={`text-sm mt-2 ${promoSuccess ? 'text-green-600' : 'text-red-500'}`}>
                                {promoMessage}
                            </p>
                        )}
                    </div>

                    {/* Switch mode */}
                    <p className="text-center text-sm text-gray-500 mt-4">
                        {mode === 'login' ? t('no_account') : t('has_account')}{' '}
                        <button onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); clearError(); }} className="text-brand-primary-500 font-semibold hover:underline">
                            {mode === 'login' ? t('register_here') : t('login_here')}
                        </button>
                    </p>
                </div>
            )}
        </div>
    );
}
