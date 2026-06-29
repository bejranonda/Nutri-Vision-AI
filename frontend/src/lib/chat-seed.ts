/**
 * Hand-off channel from a scan result to the chat page.
 *
 * The scan page's "Ask Shinny about this" CTA stashes a pre-written
 * question here, then navigates to /[locale]/chat. The chat page reads
 * it once on mount, pre-fills the input, and clears it.
 *
 * Why localStorage and not a query param: chat is login-gated. A
 * logged-out user who taps the CTA gets bounced to /login first; a
 * query param would be lost on that redirect, but localStorage survives
 * it, so the seeded question is still waiting when they land back on
 * /chat after signing in. The value is read-once (cleared on read) so a
 * stale seed never re-pops on a later manual visit to /chat.
 */
export const CHAT_SEED_KEY = 'shinny_chat_seed';

/** Stash a seed question for the chat page. Safe on the server (no-op). */
export function setChatSeed(question: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(CHAT_SEED_KEY, question);
  } catch {
    // Quota / disabled storage — the CTA still navigates; chat just
    // opens with an empty composer. Non-fatal.
  }
}

/** Read and clear the pending seed (read-once). Returns '' if none. */
export function takeChatSeed(): string {
  if (typeof window === 'undefined') return '';
  try {
    const seed = window.localStorage.getItem(CHAT_SEED_KEY);
    if (seed) window.localStorage.removeItem(CHAT_SEED_KEY);
    return seed ?? '';
  } catch {
    return '';
  }
}
