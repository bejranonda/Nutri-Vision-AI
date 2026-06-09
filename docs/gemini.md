# Gemini AI — Project Guide for EatInOrder

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
- [Market Research](file:///d:/Git/Werapol/Nutri-Vision-AI/research/Roadmap/) — Full roadmap and market analysis

## AI Methodology & Architecture (v2.3, May 2026)
- **Composable Architecture**: Heavy client-side views (like `scan/page.tsx`) are completely decoupled into specific custom Hooks (`useScanUpload`, `useScanAnalysis`) to guarantee edge-case safety without UI re-renders.
- **Identify-First**: Focus on identifying ingredients before dish naming to reduce hallucinations.
- **Gemini-Primary Cascade + CF Safety Net** (May 2026, post-bug-hunt): `/api/analyze` attempts the Gemini cascade *first* — `GEMINI_VISION_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash']`, exported from `frontend/src/lib/ai-providers.ts`. The route returns on the first 200; skips on 404 (model retired) or 429 (per-model quota exhausted); throws on any other status. If the whole cascade exhausts, Cloudflare Llama 3.2 11B Vision runs as the safety-net fallback (20s timeout). Per-model timeout is divided across the Gemini cascade so the budget fits the caller's deadline. The 503 response body carries `primaryProviderError` so operators can see *both* the primary and fallback errors.
- **Why a cascade, not a single id**: Google's free tier is *per-project AND per-model*. May 2026 (Request IDs `tqunrejp` / `fz64f4uh`) caught us with `gemini-2.0-flash` at `limit: 0` while `gemini-2.5-flash` on the same key still had 1500 req/day. **Never** pin to a `-latest` alias — Google retired `gemini-1.5-flash-latest` from `v1beta` in May 2026 without notice. Use explicit, dated model ids only.
- **Chat uses `GEMINI_VISION_MODELS[0]`** in `lib/ai-providers.ts → callGemini`, so the scan and chat paths can never silently drift apart on the Gemini step.
- **Regression test**: `frontend/tests/analyze-fallback.test.ts` locks the cascade invariants (non-empty, every entry `^gemini-`, no `gemma`, no `-latest$`, route iterates the constant, response surfaces `primaryProviderError`).
- **10-Phase Pipeline**: Fault-tolerant API route for resilient scanning featuring Edge cache control, lazy session cleanup, and robust error cataloging (`error_class` logging in DB schema).

## Required Gemini API setup

- Generate a key from <https://aistudio.google.com/apikey>.
- Store as `GOOGLE_AI_API_KEY` in `frontend/.env.local` (dev) or `wrangler pages secret put GOOGLE_AI_API_KEY` (prod). `GEMINI_API_KEY` is also accepted as an alias by `lib/ai-providers.ts`.
- The cascade currently exercises `gemini-2.5-flash` → `gemini-2.0-flash` → `gemini-1.5-flash`. Per-project per-model quota can drop to `limit: 0` silently; the cascade survives one or two of them being throttled but **not** the case where the entire key is rate-limited. If you see persistent 503s after the deploy, probe `/api/analyze` directly and inspect the response `details` (Gemini error message) and `primaryProviderError` fields — the latter carries the **Cloudflare safety-net error** when CF was also tried and failed after the Gemini cascade exhausted (post-PR #27).

## Validation before declaring "shipped"

Static checks cannot verify provider-side breakage. After deploy, run a real-food probe (see `GUIDELINE.md → Before declaring an AI-pipeline fix "shipped"`) and confirm the response has `isFood: true` and a populated `dishes` array. A 200 with `isFood: false` only proves the rejection branch works.

## When changing first-impression UX (homepage, CTAs, nav, login, pricing)

Run the **fresh-user audit lens**. Unit + e2e suites can't see editorial / IA / honesty bugs. Recipe in `docs/GUIDELINE.md → The fresh-user audit lens`.

Round 7 shipped 9 fixes (PRs #46–#53); Round 8 shipped 6 (PRs #56–#61); Rounds 10–11 shipped 7 more (PRs #67–#74). Read the `CHANGELOG.md` tables before doing another round.

## When changing layout, fonts, or page semantics

Run the **Web Vitals + a11y inventory lens** (added Round 11). Quick version: capture FCP/LCP/CLS per page, audit font-payload consumers, count `<main>` + `<h1>` + unlabeled inputs per page, smoke on WebKit/iPhone 13. Recipe in `docs/GUIDELINE.md → The Web-Vitals + a11y inventory lens`.

## CI on every PR (added Round 11)

`.github/workflows/ci.yml` runs frontend `check:all` + backend `pytest` on every PR. Before Round 11 the project had no CI; the standalone backend went 6 weeks unverified between Round 8 → Round 9.

## Current Status (May 2026)
- ✅ All pages functional (scan, demo, login, dashboard, pricing, recipes, chat)
- ✅ Member system with promo codes (D1 persistent)
- ✅ i18n in 4 languages
- ✅ Backend API integration (Cloudflare Workers & D1)
- ✅ Real AI food analysis with Primary + Gemini Cascade Fallback (v2.3)
- ✅ AI Coach Shinny (chat) with Groq → Gemini → CF cascade
- 🔜 Payment integration (PromptPay, Rabbit LINE Pay)
- 🐛 Cloudflare AI vision primary frequently failing on real images — cascade absorbs it, but diagnostic PR pending (see `KNOWN_ISSUES.md → §0`)
