# Claude AI — Project Guide for EatInOrder

## Project Overview
EatInOrder (previously Nutri-Vision AI) is a **food sequencing app** that helps users eat meals in the optimal order (Veggies → Protein → Carbs → Sweets) to reduce blood sugar spikes by up to 70%.

## Tech Stack
- **Framework**: Next.js 14 (App Router) with TypeScript
- **Styling**: Tailwind CSS with custom brand design tokens
- **i18n**: next-intl with 4 locales (en, th, de, da)
- **State**: Zustand with persist middleware (localStorage)
- **Database**: Drizzle ORM + Cloudflare D1 (SQLite)
- **Deploy**: Cloudflare Pages + Workers
- **AI**: Cloudflare Workers AI for food recognition

## Key Architecture Decisions
1. **Edge-native security** via Cloudflare D1 + Web Crypto + HttpOnly cookies
2. **Freemium model**: Free (10 scans/mo) → Premium (฿199/mo, unlimited) → Family (฿299/mo, 5 members)
3. **Promotion code system**: TRIAL, DISCOUNT, FANCLUB, REFERRAL types
4. **Feature gating**: `tier-config.ts` maps features to subscription tiers
5. **Mascot "Shinny"**: AI coaching persona throughout the app
6. **Shared `<SiteHeader/>`** (`src/components/SiteHeader.tsx`, added Round 7 iter 3): every page renders the same nav — brand mark + Scan/Recipes/Pricing + LanguageSwitcher + auth-aware Login/Dashboard CTA + mobile hamburger. Don't reintroduce per-page back-to-home stubs.
7. **Canonical primary CTA**: every "go scan" entry-point reads *Start your scan* / *เริ่มสแกนเลย* / *Scan starten* / *Start dit scan* (Round 7 iter 2, `home.cta`). Three different scan verbs across three pages was the previous bug — don't restore it.

## File Structure
```
frontend/src/
├── app/[locale]/       # Locale-aware pages
├── lib/auth-store.ts   # Zustand auth (login/register/promo)
├── lib/promo-codes.ts  # Code generation, validation, redemption
├── lib/tier-config.ts  # Feature gating per tier
├── db/schema.ts        # Drizzle ORM tables
└── messages/           # i18n JSON files
```

## Coding Guidelines
- Always use `useTranslations` from next-intl for text
- Use brand design tokens from `globals.css` (e.g., `bg-brand-primary-400`)
- Components should be responsive (mobile-first)
- Use `'use client'` directive for interactive pages
- Logger: `import { logger } from '@/lib/logger'`

## Key Documents
- [Business Strategy](file:///d:/Git/Werapol/Nutri-Vision-AI/docs/business-strategy.md) — Problem, solution, personas, GTM, financials
- [Monetization](file:///d:/Git/Werapol/Nutri-Vision-AI/research/business/monetization.md) — Pricing tiers and promo code strategy
## AI Methodology & Architecture (v2.3, May 2026)
- **Composable Architecture**: Heavy client-side views (like `scan/page.tsx`) are completely decoupled into specific custom Hooks (`useScanUpload`, `useScanAnalysis`) to guarantee edge-case safety without UI re-renders.
- **Identify-First**: Focus on identifying ingredients before dish naming to reduce hallucinations.
- **Gemini-Primary Cascade + CF Safety Net** (May 2026, post-bug-hunt): the Gemini cascade in `GEMINI_VISION_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash']` runs first; on full cascade exhaustion, falls back to Cloudflare Llama 3.2 11B Vision as a safety net. The cascade returns on the first 200, skips on 404/429, throws on any other status. The 503 response body carries `primaryProviderError` so the Gemini-primary error isn't lost when the CF fallback also fails. See `docs/gemini.md` for the full rationale and `KNOWN_ISSUES.md → Scan 503 — three stacked Google-fallback failures` for the back-to-back incidents that produced this design.
- **10-Phase Pipeline**: Fault-tolerant API route for resilient scanning featuring Edge cache control, lazy session cleanup, and robust error cataloging (`error_class` logging in DB schema).

## When changing AI-pipeline code

`npm run check:all` (type-check + i18n + Vitest, 100/100) is necessary but not sufficient. Provider-side breakage (retired model alias, `limit: 0` free-tier quota) looks identical to a code bug from the user's seat. Before declaring done:

1. Push, wait for Pages deploy.
2. Probe `/api/analyze` on production with a **real food photo** (canonical fixture: `research/test-image/buymeacoffee-food-6940159_640.jpg`).
3. Confirm `isFood: true` and a populated `dishes` array. A 200 with `isFood: false` only proves the rejection branch works.

Full procedure: `docs/GUIDELINE.md → Before declaring an AI-pipeline fix "shipped"`.

## When changing first-impression UX (homepage, CTAs, nav, login, pricing)

Run the **fresh-user audit lens**. Unit + e2e suites can't see editorial / IA / honesty bugs. Recipe in `docs/GUIDELINE.md → The fresh-user audit lens`. Quick version: incognito window, log out, read every visible string out loud, click everything that looks live, count code-entry inputs per page, audit headline claims for citation, verify the primary CTA is the same string across pages.

Round 7 shipped 9 fixes from this lens (PRs #46–#53); Round 8 shipped 6 more (PRs #56–#61); Round 10 + 11 shipped 7 more (PRs #67–#74). Read the `CHANGELOG.md` tables before doing another round to avoid rediscovering the same bug classes.

## When changing layout, fonts, hero imagery, or page semantics

Run the **Web Vitals + a11y inventory lens** (added Round 11). Recipe in `docs/GUIDELINE.md → The Web-Vitals + a11y inventory lens`. Quick version: capture FCP/LCP/CLS per page via `performance.getEntriesByType`, audit font-payload consumers with `grep -rcE font-display|font-thai|var\(--font-...\)`, count `<main>` + `<h1>` + unlabeled inputs per page, smoke on WebKit/iPhone 13.

Round 11 caught homepage FCP at 2272ms (two never-applied Google Font families) and 5 of 6 public pages missing the `<main>` landmark — defects 251 tests didn't catch because the page renders and nothing throws. Permanent guards now live in `tests/e2e/responsive-perf.spec.ts` and `tests/e2e/a11y.spec.ts`.

## When changing scan, auth, or routing — run the user-journey spec (added Round 12)

`frontend/tests/e2e/user-journey.spec.ts` walks production end-to-end through the rendered UI (landing + locale switch → file upload → Analyze CTA → terminal result, register round-trip, recipes/chat/dashboard) and asserts every flow reaches a **terminal UI state** — never a stuck spinner or error boundary. ~17s warm, 4 independent phases. Run it before any release and after any scan/auth/routing change:

```bash
cd frontend && npx playwright test tests/e2e/user-journey.spec.ts
```

Four traps it already encodes (don't rediscover them): files under 500 bytes are **silently dropped** by `useScanUpload.ts` (generate noise-filled fixtures); the `/login` register tab and submit share the same Thai label (pin `button[type=submit]`); benign console noise must be filtered by documented pattern via `isBenignConsoleError()` (see `KNOWN_ISSUES.md → Known-benign console-error noise`); the scan phase needs its own 180s timeout for cold cascades. Full method: `docs/GUIDELINE.md → The full user-journey lens`. Phase 3 carries a crash sentinel for the intermittent register error-boundary bug (`KNOWN_ISSUES.md § 2a`) — if it fires, that bug is back.

## CI on every PR (added Round 11)

`.github/workflows/ci.yml` runs frontend `check:all` + backend `pytest` on every PR. If a local `npm run check:all` + `pytest -q` pass, CI will too. Before Round 11 the project had no CI; the standalone backend went 6 weeks unverified between Round 8 → Round 9.

## Current Status (May 2026)
- ✅ All pages functional (scan, demo, login, dashboard, pricing, recipes, chat)
- ✅ Member system with promo codes (D1 persistent)
- ✅ i18n in 4 languages
- ✅ Backend API integration (Cloudflare Workers & D1)
- ✅ Real AI food analysis with Primary + Gemini Cascade Fallback (v2.3)
- ✅ AI Coach Shinny (chat) with Groq → Gemini → CF cascade
- 🔜 Payment integration (PromptPay, Rabbit LINE Pay)
- 🐛 Cloudflare AI vision primary frequently failing on real images — cascade absorbs it, but diagnostic PR pending (see `KNOWN_ISSUES.md → §0`)


