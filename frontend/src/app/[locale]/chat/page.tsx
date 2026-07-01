'use client';

/**
 * /[locale]/chat — AI Coach Shinny.
 *
 * Server logic (rate limit, tier gate, fallback chain) lives in
 * /api/chat. This page is a deliberately thin client:
 *
 *   - Loads persisted conversation from localStorage on mount, so
 *     refreshing the page doesn't blow away the thread. Server-side
 *     persistence in `chat_messages` is the source of truth, but the
 *     client fetches it lazily (we don't have a /api/chat/history
 *     endpoint yet — separate PR).
 *
 *   - Sends the last 10 turns as context with each new user message.
 *     /api/chat caps at 20 in zod, but we trim earlier on the client
 *     to keep wire size and Groq prompt cost low.
 *
 *   - On 429 with reason='daily_limit_reached', shows a tier-specific
 *     upgrade nudge instead of the generic rate-limit copy.
 *
 *   - Treats network/server errors as recoverable — failed turns are
 *     marked as failed locally so the user can retry without
 *     re-typing.
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Send, Sparkles, AlertCircle, RotateCcw } from 'lucide-react';
import { useAuthStore } from '@/lib/auth-store';
import { takeChatSeed } from '@/lib/chat-seed';

const STORAGE_KEY = 'shinny-chat-history-v1';
const MAX_HISTORY_TURNS = 50;
const SEND_HISTORY_TURNS = 10;

interface Turn {
  role: 'user' | 'assistant';
  content: string;
  /** Local timestamp ms; only used for keying/display, server is source of truth. */
  ts: number;
  /** True when this user-turn failed and the user can retry. */
  failed?: boolean;
}

function loadHistory(): Turn[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(-MAX_HISTORY_TURNS);
  } catch {
    return [];
  }
}

function persistHistory(turns: Turn[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(turns.slice(-MAX_HISTORY_TURNS)));
  } catch {
    // Quota / disabled storage — silent. Server still has the source of truth.
  }
}

export default function ChatPage() {
  const t = useTranslations('chat');
  const locale = useLocale();
  const router = useRouter();

  const { user, isAuthenticated, authChecked, initAuth } = useAuthStore();

  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dailyRemaining, setDailyRemaining] = useState<number | null>(null);
  const [limitHit, setLimitHit] = useState(false);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Auth probe on mount + redirect unauthenticated visitors.
  useEffect(() => {
    initAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Only redirect once initAuth has actually resolved (authChecked).
    // isAuthenticated starts false before the probe completes, so
    // redirecting on `=== false` alone bounced logged-in users who
    // hard-loaded /chat → /login → /dashboard, making the page
    // unreachable on refresh/bookmark. The !sending guard additionally
    // prevents a redirect mid-request.
    // mode=login: a gated-page bounce usually means an expired session,
    // i.e. an existing account — open the auth page on the Login tab.
    if (authChecked && !isAuthenticated && !sending) {
      // Carry a return path so that after signing in the user lands back
      // here (not on /dashboard) — otherwise a logged-out "Ask Shinny
      // about this" hand-off from a scan result would silently strand
      // them and the seeded question would never be delivered.
      const next = encodeURIComponent(`/${locale}/chat`);
      router.push(`/${locale}/login?mode=login&next=${next}`);
    }
  }, [authChecked, isAuthenticated, sending, locale, router]);

  // Hydrate history from localStorage (client-only).
  useEffect(() => {
    setTurns(loadHistory());
  }, []);

  // Pick up a pending "Ask Shinny about this" question handed over from the
  // scan result. Read-once (takeChatSeed clears it), and only pre-fill an
  // empty composer so it never clobbers something the user is mid-typing.
  // The user still taps Send — we don't auto-fire, so they can tweak the
  // question first and the login gate stays in control of delivery.
  //
  // Gate on `isAuthenticated`: a logged-out visit to /chat mounts briefly
  // and then redirects to /login. If we consumed the seed on that throwaway
  // mount, takeChatSeed would clear it and the question would be lost by the
  // time the user returned post-login. Waiting for the authenticated state
  // means the seed survives the round-trip and is consumed exactly once, on
  // the mount that actually renders the composer.
  useEffect(() => {
    if (!authChecked || !isAuthenticated) return;
    const seed = takeChatSeed();
    if (seed) setDraft((current) => (current ? current : seed));
  }, [authChecked, isAuthenticated]);

  // Auto-scroll to the latest message whenever turns or sending changes.
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [turns, sending]);

  const sendMessage = useCallback(
    async (rawText: string) => {
      const text = rawText.trim();
      if (!text || sending) return;

      const userTurn: Turn = { role: 'user', content: text, ts: Date.now() };
      const optimistic = [...turns, userTurn];
      setTurns(optimistic);
      setDraft('');
      setError(null);
      setSending(true);

      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: text,
            // Send last N turns as context; server caps at 20.
            history: optimistic.slice(-1 - SEND_HISTORY_TURNS, -1).map(({ role, content }) => ({
              role,
              content,
            })),
            locale,
          }),
        });

        if (res.status === 429) {
          const body = await res.json().catch(() => ({}));
          if (body?.error === 'daily_limit_reached') {
            setLimitHit(true);
            // Mark the optimistic user turn as failed so the UI can
            // visually distinguish "you sent this but it didn't go".
            setTurns((prev) => {
              const updated = [...prev];
              const last = updated[updated.length - 1];
              if (last?.role === 'user') updated[updated.length - 1] = { ...last, failed: true };
              return updated;
            });
            return;
          }
          setError(t('error_rate_limited'));
          return;
        }

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          // Always show the localized generic line — server error strings
          // are English diagnostics, not user copy (Round 13). Keep the
          // raw detail in the console for debugging.
          console.warn('chat send failed', res.status, body?.error);
          setError(t('error_generic'));
          // Mark this user turn as failed so the retry button shows up.
          setTurns((prev) => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last?.role === 'user') updated[updated.length - 1] = { ...last, failed: true };
            return updated;
          });
          return;
        }

        const data = await res.json();
        const assistantTurn: Turn = {
          role: 'assistant',
          content: String(data.reply ?? '').trim(),
          ts: Date.now(),
        };
        setTurns((prev) => {
          const next = [...prev, assistantTurn];
          persistHistory(next);
          return next;
        });
        if (typeof data.dailyRemaining === 'number') {
          setDailyRemaining(data.dailyRemaining);
        }
      } catch (err: any) {
        setError(t('error_network'));
        setTurns((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last?.role === 'user') updated[updated.length - 1] = { ...last, failed: true };
          return updated;
        });
      } finally {
        setSending(false);
        textareaRef.current?.focus();
      }
    },
    [turns, sending, locale, t],
  );

  const retryLastFailed = useCallback(() => {
    const lastFailed = [...turns].reverse().find((tt) => tt.role === 'user' && tt.failed);
    if (!lastFailed) return;
    // Drop the failed turn, then re-send.
    setTurns((prev) => {
      const idx = prev.lastIndexOf(lastFailed);
      return idx >= 0 ? prev.slice(0, idx) : prev;
    });
    sendMessage(lastFailed.content);
  }, [turns, sendMessage]);

  const clearChat = useCallback(() => {
    setTurns([]);
    setError(null);
    setLimitHit(false);
    persistHistory([]);
  }, []);

  function onTextareaKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Enter to send, Shift+Enter for newline. Common chat convention.
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(draft);
    }
  }

  // Until the session probe resolves, show a spinner rather than the
  // chat UI — avoids flashing the full interface to an anonymous
  // visitor for the split-second before the redirect-to-login fires.
  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-primary-50 via-white to-brand-secondary-50">
        <div className="w-8 h-8 border-3 border-brand-primary-400/30 border-t-brand-primary-400 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-primary-50 via-white to-brand-secondary-50">
      {/* Header */}
      <header className="sticky top-0 z-10 backdrop-blur-md bg-white/80 border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link
            href={`/${locale}/dashboard`}
            className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-brand-primary-500"
          >
            <ArrowLeft className="w-4 h-4" /> {t('back')}
          </Link>
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-brand-accent-500" />
            <h1 className="text-base font-bold text-gray-900">{t('title')}</h1>
          </div>
          <button
            type="button"
            onClick={clearChat}
            className="text-xs text-gray-500 hover:text-rose-500"
            aria-label={t('clear')}
          >
            {t('clear')}
          </button>
        </div>
        {dailyRemaining !== null && (
          <div className="max-w-3xl mx-auto px-4 pb-2 text-xs text-gray-500">
            {t('quota_remaining', { n: dailyRemaining })}
          </div>
        )}
      </header>

      {/* Messages */}
      <div ref={scrollRef} className="max-w-3xl mx-auto px-4 pt-6 pb-32 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 190px)' }}>
        {turns.length === 0 && (
          <div className="text-center py-12 px-6">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-brand-primary-400 to-brand-secondary-400 flex items-center justify-center shadow-brand">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-lg font-bold text-gray-900 mb-2">{t('welcome_title')}</h2>
            <p className="text-sm text-gray-600 max-w-md mx-auto">{t('welcome_subtitle')}</p>
            <div className="mt-6 grid gap-2 max-w-md mx-auto">
              {[
                t('starter.q1'),
                t('starter.q2'),
                t('starter.q3'),
              ].map((suggestion, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => sendMessage(suggestion)}
                  className="text-sm text-left px-4 py-2.5 bg-white border border-gray-200 rounded-xl hover:border-brand-primary-300 hover:bg-brand-primary-50/30 transition-all text-gray-700"
                >
                  💭 {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-3">
          {turns.map((tt) => (
            <Bubble key={tt.ts} turn={tt} locale={locale} />
          ))}
          {sending && (
            <div className="flex items-center gap-2 text-sm text-gray-500 px-4">
              <div className="w-1.5 h-1.5 bg-brand-primary-400 rounded-full animate-bounce" />
              <div className="w-1.5 h-1.5 bg-brand-primary-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
              <div className="w-1.5 h-1.5 bg-brand-primary-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
              <span>{t('thinking')}</span>
            </div>
          )}
        </div>

        {error && (
          <div className="mt-3 mx-2 flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span className="flex-1">{error}</span>
            {turns.some((tt) => tt.failed) && (
              <button
                type="button"
                onClick={retryLastFailed}
                className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 bg-white border border-red-300 rounded-md hover:bg-red-100"
              >
                <RotateCcw className="w-3 h-3" /> {t('retry')}
              </button>
            )}
          </div>
        )}

        {limitHit && (
          <div className="mt-4 px-4 py-3 bg-yellow-50 border border-yellow-200 rounded-xl text-yellow-800 text-sm">
            <p className="font-semibold mb-1">{t('limit.title')}</p>
            <p className="text-yellow-700">{t('limit.body')}</p>
            <Link
              href={`/${locale}/pricing`}
              className="inline-block mt-2 text-xs font-bold px-3 py-1.5 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600"
            >
              {t('limit.cta')} →
            </Link>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="fixed bottom-0 inset-x-0 bg-white/90 backdrop-blur-md border-t border-gray-200">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onTextareaKey}
            disabled={sending || limitHit}
            placeholder={limitHit ? t('limit.placeholder') : t('input_placeholder')}
            rows={1}
            maxLength={2000}
            className="flex-1 resize-none px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-brand-primary-400 focus:border-transparent outline-none transition-all text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ maxHeight: '120px' }}
          />
          <button
            type="button"
            onClick={() => sendMessage(draft)}
            disabled={sending || limitHit || !draft.trim()}
            className="px-4 py-2.5 bg-gradient-to-r from-brand-primary-400 to-brand-secondary-400 text-white font-bold rounded-2xl hover:shadow-brand-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
            aria-label={t('send')}
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function Bubble({ turn, locale }: { turn: Turn; locale: string }) {
  const t = useTranslations('chat');
  const isUser = turn.role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
          isUser
            ? `bg-gradient-to-br from-brand-primary-400 to-brand-secondary-400 text-white ${
                turn.failed ? 'opacity-60' : ''
              }`
            : 'bg-white border border-gray-200 text-gray-900 shadow-sm'
        }`}
      >
        {turn.content}
        {turn.failed && (
          <div className="text-xs italic mt-1 text-white/80">
            {t('not_sent')}
          </div>
        )}
      </div>
    </div>
  );
}
