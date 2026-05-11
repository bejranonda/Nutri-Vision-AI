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
- **Primary + Gemini Cascade Fallback**: Cloudflare Llama 3.2 11B Vision first (25s timeout); on failure, walks `GEMINI_VISION_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash']` exported from `frontend/src/lib/ai-providers.ts`. Returns on the first 200; skips on 404 (model retired) or 429 (per-model quota gone); throws on any other status. The 503 response body carries `primaryProviderError` so the Cloudflare-primary error isn't lost when the cascade also fails. See `docs/gemini.md` for the full rationale and `KNOWN_ISSUES.md → Scan 503 — three stacked Google-fallback failures` for the three back-to-back incidents that produced this design.
- **10-Phase Pipeline**: Fault-tolerant API route for resilient scanning featuring Edge cache control, lazy session cleanup, and robust error cataloging (`error_class` logging in DB schema).

## When changing AI-pipeline code

`npm run check:all` (type-check + i18n + Vitest, 100/100) is necessary but not sufficient. Provider-side breakage (retired model alias, `limit: 0` free-tier quota) looks identical to a code bug from the user's seat. Before declaring done:

1. Push, wait for Pages deploy.
2. Probe `/api/analyze` on production with a **real food photo** (canonical fixture: `research/test-image/buymeacoffee-food-6940159_640.jpg`).
3. Confirm `isFood: true` and a populated `dishes` array. A 200 with `isFood: false` only proves the rejection branch works.

Full procedure: `docs/GUIDELINE.md → Before declaring an AI-pipeline fix "shipped"`.

## Current Status (May 2026)
- ✅ All pages functional (scan, demo, login, dashboard, pricing, recipes, chat)
- ✅ Member system with promo codes (D1 persistent)
- ✅ i18n in 4 languages
- ✅ Backend API integration (Cloudflare Workers & D1)
- ✅ Real AI food analysis with Primary + Gemini Cascade Fallback (v2.3)
- ✅ AI Coach Shinny (chat) with Groq → Gemini → CF cascade
- 🔜 Payment integration (PromptPay, Rabbit LINE Pay)
- 🐛 Cloudflare AI vision primary frequently failing on real images — cascade absorbs it, but diagnostic PR pending (see `KNOWN_ISSUES.md → §0`)


