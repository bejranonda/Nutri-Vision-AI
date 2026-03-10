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
## AI Methodology (v2.1.7)
- **Identify-First**: Focus on identifying ingredients before dish naming to reduce hallucinations.
- **Dual-Provider Fallback**: Attempts Cloudflare Llama 3.2 11B Vision first; falls back to Google Gemma 3 27B if primary fails or times out.
- **10-Phase Pipeline**: Fault-tolerant API route for resilient scanning.

## Current Status (Mar 2026)
- ✅ All pages functional (scan, demo, login, dashboard, pricing, recipes)
- ✅ Member system with promo codes (D1 persistent)
- ✅ i18n in 4 languages
- ✅ Backend API integration (Cloudflare Workers & D1)
- ✅ Real AI food analysis with Dual-Provider Fallback (v2.1.7)
- 🔜 Payment integration (PromptPay, Rabbit LINE Pay)


