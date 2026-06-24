/**
 * Catch-all route under `[locale]/`.
 *
 * Why this file exists: round-4 UX audit shipped
 * `src/app/[locale]/not-found.tsx` with a locale-aware design (Shinny
 * avatar, Thai/EN/DE/DA strings, two CTAs). Post-deploy probing
 * `/th/no-such-path` still returned Next.js's English default
 * "404: This page could not be found." with zero Thai chars and no
 * `<html lang="th">` — meaning the locale layout never executed at
 * all. OpenNext-on-Cloudflare-Pages was short-circuiting to a static
 * 404 fallback before the segment chain ran.
 *
 * This catch-all forces the segment to enter. Any path under
 * `/th/anything-not-otherwise-routed` matches `[locale]/[...slug]`,
 * which renders this server component, which immediately calls
 * `notFound()`. Next.js then renders the **closest** `not-found.tsx`
 * — `app/[locale]/not-found.tsx`. That file inherits the locale
 * layout (HTML lang, fonts, next-intl provider), so its
 * `useTranslations('not_found')` calls resolve correctly in the
 * user's language.
 *
 * Sibling routes (`/th/scan`, `/th/login`, …) are NOT affected:
 * Next.js prefers explicit segment matches over catch-alls, so
 * `[...slug]` only fires when no other child of `[locale]/` matches.
 */
import { notFound } from 'next/navigation';

export default function CatchAllNotFound(): never {
  notFound();
}
