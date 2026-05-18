'use client';

/**
 * In-line "Ask Shinny" chat that appears below the scan results.
 *
 * The standalone /chat page is the full coach experience. This panel
 * is the *follow-up* chat tied to a specific scan: the user just got
 * a result card and wants to ask "should I really eat the rice last?"
 * without leaving the page.
 *
 * Server: re-uses /api/chat — same auth gate, same rate limit, same
 * tier-counter. We bake the just-scanned meal into the first assistant
 * turn so /api/chat sees it as conversation context on every follow-up
 * request without us having to plumb a separate scan-context field
 * through the API.
 *
 * Anonymous users: /api/chat is auth-only by design (anti-abuse). For
 * a not-signed-in user we show a CTA toward /login instead of the input,
 * so the rest of the scan UX still works for guests.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { Send, Sparkles, AlertCircle, LogIn } from 'lucide-react';
import type {
    ScanMode,
    AiMultiDishResponse,
    AiMenuResponse,
    AiDrinkSnackResponse,
} from '@/lib/ai-prompt';

interface Turn {
    role: 'user' | 'assistant';
    content: string;
    ts: number;
    failed?: boolean;
}

interface ScanResultChatProps {
    scanMode: ScanMode;
    mealData?: AiMultiDishResponse | null;
    menuData?: AiMenuResponse | null;
    drinkData?: AiDrinkSnackResponse | null;
    locale: string;
    isAuthenticated: boolean;
}

const MAX_SEND_TURNS = 10;

/**
 * Build the initial Shinny greeting shown when the chat panel mounts.
 *
 * The greeting doubles as the *AI's* conversational context: we include
 * it in `history` on every send so the model sees the meal it was
 * referring to even on the user's first follow-up.
 */
function buildGreeting(
    scanMode: ScanMode,
    mealData: AiMultiDishResponse | null | undefined,
    menuData: AiMenuResponse | null | undefined,
    drinkData: AiDrinkSnackResponse | null | undefined,
    t: (key: string, values?: Record<string, any>) => string,
): string {
    if (scanMode === 'meal' && mealData) {
        const dishNames = mealData.dishes.map((d) => d.name).filter(Boolean);
        const list =
            dishNames.length === 0
                ? t('greeting_meal_no_names')
                : dishNames.join(', ');
        const sequence = mealData.crossDishSequence
            .map((s) => `${s.emoji} ${s.items}`)
            .join(' → ');
        if (sequence) {
            return t('greeting_meal_with_sequence', {
                dishes: list,
                sequence,
            });
        }
        return t('greeting_meal', { dishes: list });
    }

    if (scanMode === 'drink_snack' && drinkData) {
        return t('greeting_drink_snack', {
            item: drinkData.itemName,
        });
    }

    if (scanMode === 'menu' && menuData) {
        const itemCount = menuData.menuItems?.length || 0;
        return t('greeting_menu', { count: itemCount });
    }

    return t('greeting_fallback');
}

/**
 * Suggested starter questions, contextualised to the scan mode. Click
 * to send — same as typing & pressing Enter.
 */
function buildStarters(
    scanMode: ScanMode,
    t: (key: string) => string,
): string[] {
    if (scanMode === 'menu') {
        return [t('starters.menu_1'), t('starters.menu_2'), t('starters.menu_3')];
    }
    if (scanMode === 'drink_snack') {
        return [
            t('starters.drink_1'),
            t('starters.drink_2'),
            t('starters.drink_3'),
        ];
    }
    return [t('starters.meal_1'), t('starters.meal_2'), t('starters.meal_3')];
}

export default function ScanResultChat({
    scanMode,
    mealData,
    menuData,
    drinkData,
    locale,
    isAuthenticated,
}: ScanResultChatProps) {
    const t = useTranslations('scan.result_chat');

    // Key derived only from the data that affects the greeting's
    // CONTENT. Used as the reset trigger below — `t` cannot be in
    // useEffect deps (next-intl rebuilds it on locale change in ways
    // that aren't reference-stable) without causing reset loops.
    const scanKey = useMemo(() => {
        if (scanMode === 'meal' && mealData) {
            return `meal:${mealData.dishes.map((d) => d.name).join('|')}`;
        }
        if (scanMode === 'drink_snack' && drinkData) {
            return `drink:${drinkData.itemName}`;
        }
        if (scanMode === 'menu' && menuData) {
            return `menu:${menuData.menuItems?.length || 0}`;
        }
        return scanMode;
    }, [scanMode, mealData, menuData, drinkData]);

    const starters = useMemo(() => buildStarters(scanMode, t), [scanMode, t]);

    const [turns, setTurns] = useState<Turn[]>([]);
    const [draft, setDraft] = useState('');
    const [sending, setSending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [limitHit, setLimitHit] = useState(false);

    const scrollRef = useRef<HTMLDivElement | null>(null);

    // Reset whenever the analyzed meal changes — a different dish means
    // the greeting's context is no longer relevant. We rebuild the
    // greeting inside the effect so `t` doesn't have to be a dep.
    useEffect(() => {
        const greeting = buildGreeting(
            scanMode,
            mealData,
            menuData,
            drinkData,
            t,
        );
        setTurns([
            {
                role: 'assistant',
                content: greeting,
                ts: Date.now(),
            },
        ]);
        setError(null);
        setLimitHit(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [scanKey]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [turns, sending]);

    async function send(rawText: string) {
        const text = rawText.trim();
        if (!text || sending || limitHit) return;

        const userTurn: Turn = { role: 'user', content: text, ts: Date.now() };
        const next = [...turns, userTurn];
        setTurns(next);
        setDraft('');
        setError(null);
        setSending(true);

        try {
            // The greeting is the AI's first turn — by including it as
            // the head of `history` we give the model conversational
            // context for follow-ups without needing a separate
            // "scan-context" API field.
            const history = next
                .slice(-1 - MAX_SEND_TURNS, -1)
                .map(({ role, content }) => ({ role, content }));

            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: text, history, locale }),
            });

            if (res.status === 429) {
                const body = await res.json().catch(() => ({}));
                if (body?.error === 'daily_limit_reached') {
                    setLimitHit(true);
                    setTurns((prev) => {
                        const updated = [...prev];
                        const last = updated[updated.length - 1];
                        if (last?.role === 'user') {
                            updated[updated.length - 1] = { ...last, failed: true };
                        }
                        return updated;
                    });
                    return;
                }
                setError(t('error_rate_limited'));
                return;
            }

            if (res.status === 401) {
                setError(t('error_signin'));
                return;
            }

            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                setError(body?.error || t('error_generic'));
                setTurns((prev) => {
                    const updated = [...prev];
                    const last = updated[updated.length - 1];
                    if (last?.role === 'user') {
                        updated[updated.length - 1] = { ...last, failed: true };
                    }
                    return updated;
                });
                return;
            }

            const data = await res.json();
            setTurns((prev) => [
                ...prev,
                {
                    role: 'assistant',
                    content: String(data.reply ?? '').trim(),
                    ts: Date.now(),
                },
            ]);
        } catch (e) {
            setError(t('error_network'));
            setTurns((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last?.role === 'user') {
                    updated[updated.length - 1] = { ...last, failed: true };
                }
                return updated;
            });
        } finally {
            setSending(false);
        }
    }

    function onKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            send(draft);
        }
    }

    return (
        <section className="mt-8 max-w-6xl mx-auto animate-slide-up" aria-label={t('aria_label')}>
            <div className="backdrop-blur-md bg-white/90 rounded-3xl shadow-glass border border-white/40 overflow-hidden">
                {/* Header */}
                <div className="px-5 py-4 bg-gradient-to-r from-brand-primary-500 to-brand-secondary-500 text-white flex items-center gap-3">
                    <div className="relative">
                        <div className="w-11 h-11 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm border border-white/40 overflow-hidden">
                            <img
                                src="/images/shinny_avatar_explaining.png"
                                alt="Shinny"
                                className="w-full h-full object-cover"
                            />
                        </div>
                        <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-400 border-2 border-white rounded-full"></div>
                    </div>
                    <div>
                        <h3 className="font-bold text-base leading-tight flex items-center gap-1.5">
                            <Sparkles className="w-4 h-4" />
                            {t('title')}
                        </h3>
                        <p className="text-xs text-white/85">{t('subtitle')}</p>
                    </div>
                </div>

                {/* Messages */}
                <div
                    ref={scrollRef}
                    className="px-4 py-4 overflow-y-auto flex flex-col gap-3 bg-slate-50/50"
                    style={{ maxHeight: '50vh', minHeight: '220px' }}
                >
                    {turns.map((turn, idx) => (
                        <Bubble key={turn.ts + ':' + idx} turn={turn} />
                    ))}
                    {sending && (
                        <div className="self-start bg-white px-4 py-3 rounded-2xl rounded-tl-sm border border-gray-200 shadow-sm flex gap-1.5 items-center">
                            <div className="w-1.5 h-1.5 bg-brand-primary-400 rounded-full animate-bounce" />
                            <div
                                className="w-1.5 h-1.5 bg-brand-primary-400 rounded-full animate-bounce"
                                style={{ animationDelay: '0.15s' }}
                            />
                            <div
                                className="w-1.5 h-1.5 bg-brand-primary-400 rounded-full animate-bounce"
                                style={{ animationDelay: '0.3s' }}
                            />
                        </div>
                    )}

                    {turns.length === 1 && !sending && isAuthenticated && (
                        <div className="mt-2 grid gap-2">
                            <p className="text-xs text-gray-400 font-medium px-1">
                                {t('try_asking')}
                            </p>
                            {starters.map((q, i) => (
                                <button
                                    key={i}
                                    type="button"
                                    onClick={() => send(q)}
                                    className="text-sm text-left px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl hover:border-brand-primary-300 hover:bg-brand-primary-50/30 transition-all text-gray-700"
                                >
                                    💭 {q}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {error && (
                    <div className="mx-4 mb-3 flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-xl text-red-600 text-xs">
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        <span className="flex-1">{error}</span>
                    </div>
                )}

                {limitHit && (
                    <div className="mx-4 mb-3 px-4 py-3 bg-yellow-50 border border-yellow-200 rounded-xl text-yellow-800 text-sm">
                        <p className="font-semibold mb-1">{t('limit_title')}</p>
                        <p className="text-yellow-700 text-xs">{t('limit_body')}</p>
                        <Link
                            href={`/${locale}/pricing`}
                            className="inline-block mt-2 text-xs font-bold px-3 py-1.5 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600"
                        >
                            {t('limit_cta')} →
                        </Link>
                    </div>
                )}

                {/* Input or sign-in CTA */}
                {isAuthenticated ? (
                    <div className="px-4 py-3 bg-white border-t border-gray-100">
                        <div className="flex items-end gap-2">
                            <textarea
                                value={draft}
                                onChange={(e) => setDraft(e.target.value)}
                                onKeyDown={onKey}
                                disabled={sending || limitHit}
                                placeholder={
                                    limitHit
                                        ? t('input_placeholder_limit')
                                        : t('input_placeholder')
                                }
                                rows={1}
                                maxLength={2000}
                                className="flex-1 resize-none px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-brand-primary-400 focus:border-transparent outline-none transition-all text-gray-900 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                style={{ maxHeight: '120px' }}
                            />
                            <button
                                type="button"
                                onClick={() => send(draft)}
                                disabled={sending || limitHit || !draft.trim()}
                                className="px-4 py-2.5 bg-gradient-to-r from-brand-primary-400 to-brand-secondary-400 text-white font-bold rounded-2xl hover:shadow-brand disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                                aria-label={t('send')}
                            >
                                <Send className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="px-5 py-5 bg-white border-t border-gray-100 text-center">
                        <p className="text-sm text-gray-600 mb-3">
                            {t('signin_prompt')}
                        </p>
                        <Link
                            href={`/${locale}/login`}
                            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-brand-primary-400 to-brand-secondary-400 text-white font-bold rounded-xl shadow-brand hover:shadow-brand-lg transition-all text-sm"
                        >
                            <LogIn className="w-4 h-4" />
                            {t('signin_cta')}
                        </Link>
                    </div>
                )}
            </div>
        </section>
    );
}

function Bubble({ turn }: { turn: Turn }) {
    const isUser = turn.role === 'user';
    return (
        <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
            <div
                className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap shadow-sm ${
                    isUser
                        ? `bg-gradient-to-br from-brand-primary-400 to-brand-secondary-400 text-white rounded-tr-sm ${
                              turn.failed ? 'opacity-60' : ''
                          }`
                        : 'bg-white border border-gray-200 text-gray-800 rounded-tl-sm'
                }`}
            >
                {turn.content}
            </div>
        </div>
    );
}
