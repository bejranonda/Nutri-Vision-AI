# 🍜 Shinny Guide (Nutri-Vision AI)

**อร่อย ตาม ลำดับ — Delicious in Order**

> Live Long to Eat Well · อยู่เพื่อกินบำนาญ

[![Cloudflare Pages](https://img.shields.io/badge/deploy-Cloudflare_Pages-F38020?logo=cloudflare)](https://nutri-vision-ai.pages.dev)
[![Next.js 14](https://img.shields.io/badge/Next.js-14-black?logo=nextdotjs)](https://nextjs.org)

## What is Shinny Guide?

Shinny Guide is an AI-powered food sequencing app that helps you eat Thai food (and any cuisine) in the right order to reduce blood sugar spikes by up to **70%**. Based on real science — eat **Veggies → Protein → Carbs → Sweets**.

Meet **Shinny** (ชินนี่), your AI food coach who guides you through every meal!

## ✨ Key Features

| Feature | Free | Premium (฿199/mo) | Family (฿299/mo) |
|---------|------|--------------------|-------------------|
| AI Scan Modes | Meal only | Meal, Menu, Drink/Snack | Meal, Menu, Drink/Snack |
| Food Scanning | 10 scans/mo (up to 3 photos) | ∞ (up to 10 photos) | ∞ (up to 10 photos) |
| Health Score | 3 dimensions | 8 dimensions | 8 dimensions |
| AI Coach Shinny | 3 Q/day | ∞ | ∞ |
| Custom AI Avatar | — | ✓ (Dynamic Postures) | ✓ |
| Thai Recipes | 100 | 1,000+ | 1,000+ |
| Meal Planning | — | ✓ | ✓ |
| Family Members | — | — | 5 |
| Data Export | — | ✓ | ✓ |

### 📱 App Pages
- **Home** — Landing page with concept explanation & features
- **Scan** — AI food analysis with 3 dynamic modes (Meal, Menu, Drink/Snack), sequence visualization & 8-dimension scoring. Features an advanced Debug UI.
- **Demo** — Interactive walkthrough of food sequencing with blood sugar curves
- **Login** — Authentication with email, Google, LINE, and promo code redemption
- **Dashboard** — Member stats, streak tracking, daily challenges, gamification
- **Pricing** — Tier comparison with monthly/annual toggle and FAQ
- **Recipes** — Thai recipe collection with dietary filters
- **Chat** (`/[locale]/chat`, login-required) — AI Coach Shinny. Conversational nutrition coaching backed by a free-tier provider cascade: Groq Llama 3.3 70B (primary, sub-300ms) → Gemini 1.5 Flash → Cloudflare Workers AI safety net. Tier-quota gated (`aiQuestionsPerDay`: free=3, premium=∞). Locale-aware persona that bakes the brand's three rules: never forbid food, warm older-sister tone, stay in food/nutrition scope. See [Tech Stack](#-tech-stack) for the provider chain.
- **Admin** (`/[locale]/admin`, restricted) — operator console: quick-stat overview, user management (toggle admin, flip subscription tier), promo-code CRUD, and a health-check view. Gated server-side by the `isAdmin` column on `users`; non-admins are silently redirected to `/login`. See [`docs/ADMIN_BOOTSTRAP.md`](docs/ADMIN_BOOTSTRAP.md) for how to create the first admin via `wrangler` (the schema ships with zero admins — no accidental admin via public sign-up).

### 🎟️ Voucher & Promotion System

Two scopes of code, managed from `/admin/promo`:

| Scope | Used at | Purpose |
|-------|---------|---------|
| **Registration vouchers** | sign-up form | Pilot-launch invite codes — required to create an account when `VOUCHER_REQUIRED_FOR_REGISTRATION=true` is set on Cloudflare. Flag is off by default; flip via wrangler when ready. |
| **Upgrade promos** | logged-in user, "Have a promo?" field | Tier-upgrade codes (`SHINNY2024`, `EATWELL`, etc.). Existing flow, unchanged. |

Each code carries:
- **Kind**: Personal (single-use) or Organization (N-seat cohort).
- **Time limit**: optional expiry date; un-set means perpetual.
- **Usage limit**: `usageLimit` cap; `usageCount` shown live as a fill bar in the admin table.
- **Active toggle**: instant deactivation without affecting already-granted redemptions.
- **Notes**: free-text admin label (e.g. "Summer pilot — 50 seats for Chula nutrition dept").

Built-in seeded promos (legacy upgrade scope):
- `SHINNY2024` — 30 days Premium (Shinny Fanclub)
- `EATWELL` — 7-day Premium trial
- `LAUNCH50` — 50% off first month
- `FAMILY2024` — 14-day Family trial

See [`docs/ADMIN_BOOTSTRAP.md`](docs/ADMIN_BOOTSTRAP.md) for how to enable
voucher-only registration during pilot launch.

## 🧠 AI Methodology & Analysis (v2.2.0)

Nutri-Vision AI uses a strict **Identify-First** methodology powered by a highly resilient **Dual-Provider Fallback Strategy**.

### Smart Inference Pipeline:
1.  **Primary**: Cloudflare `@cf/meta/llama-3.2-11b-vision-instruct` (High Quality multimodal model).
2.  **Super Fallback**: Google `@gemma-3-27b-it` (High Reliability).
    *   If the primary Cloudflare 11B model fails or times out (25s), the system automatically retries using the Google AI API with the Gemma 3 27B model to ensure a successful response even under high load.

The analysis pipeline is built for **Edge Reliability**:
1. Client-side canvas compression (reduces 10MB photos to ~150KB), now with skipping double-compression for single photos.
2. **10-Phase Fault-Tolerant Pipeline**: Each stage (DB, Session, AI) is individually isolated in `try/catch` blocks. The AI step features an **Auto-Correction Loop** using a `safeParseJson` strategy and preferred Google provider diversity on retry.
3. Server-side AI timeout (45s total) using `Promise.race`, now with `4096` output tokens for complex multi-dish extraction.
4. Request Tracing & Telemetry: Every scan is unique-indexed. Use the `?debug=1` query parameter on the scan page for real-time phase timings.
5. Strict JSON schema validation and graceful "Non-Food" detection rendering.
6. **Decoupled Architecture**: Logic is fully isolated via custom hooks (`useScanUpload`, `useScanAnalysis`, `useScanDebug`), ensuring a clean Orchestrator Page.
6. **Multi-Photo Collage Engine**: Client-side canvas stitching up to 10 photos, with **Dynamic Canvas Scaling** to prevent memory crashes on older phones (scales based on `navigator.deviceMemory`).
7. Deployment Monitoring: Verify AI bindings and database status securely via the `/api/health` endpoint.

## 🛠 Tech Stack

- **Frontend**: Next.js 14, TypeScript, Tailwind CSS
- **i18n**: next-intl (🇬🇧 EN, 🇹🇭 TH, 🇩🇪 DE, 🇩🇰 DA)
- **State**: Zustand with persist middleware
- **Database**: Drizzle ORM + Cloudflare D1 (SQLite)
- **Deploy**: Cloudflare Pages + Workers
- **AI vision** (food scan): Cloudflare Workers AI (Llama 3.2 11B Vision) → Google AI (Gemini 1.5 Flash) — multimodal fallback chain, locale-aware prompting.
- **AI chat** (Coach Shinny): Groq (Llama 3.3 70B, free 30 req/min) → Google AI (Gemini 1.5 Flash, free 1500 req/day) → Cloudflare Workers AI — three-stage cascade, free-tier-first.
- **Performance**: Client-side image compression (HTML5 Canvas)


## 🚀 Getting Started

```bash
cd frontend
npm install
npm run dev        # → http://localhost:3000
```

### Build for production
```bash
npm run build
npm run deploy     # → Cloudflare Pages
```

## ✅ Quality gate

Before every commit / PR, run the combined check suite. It catches the three
classes of regression we've historically had:

```bash
cd frontend
npm run check:all      # = type-check + check:i18n + test
```

Individually:

| Script | Purpose |
|--------|---------|
| `npm run type-check` | Strict TypeScript (`tsc --noEmit`) across the whole frontend |
| `npm run check:i18n` | Ensures every `t('…')` key used in code exists in **all 4 locale JSONs** (th/en/de/da) |
| `npm test` | Vitest unit tests — crypto (PBKDF2 + constant-time compare), ai-prompt validators, zod schemas |
| `npm run build` | Full Next.js production build, same thing Cloudflare Pages runs |

Backend:

```bash
cd backend
pytest -q              # 129 tests: security, scorer, gemini, config
```

See [`docs/ITERATION_PROCESS.md`](docs/ITERATION_PROCESS.md) for the
continuous-iteration / zero-error navigation process each change
follows before landing on `main`.

### Database migrations

Schema changes live in `frontend/src/db/schema.ts` (Drizzle). Migrations
under `frontend/drizzle/` are hand-reviewable SQL. Apply to Cloudflare D1:

```bash
cd frontend
npx wrangler d1 migrations apply eatinorder-db --remote  # prod
npx wrangler d1 migrations apply eatinorder-db --local   # local dev
```

**Prerequisite — Cloudflare auth in `frontend/.env.local`** (gitignored):

```env
# Token must include scopes: D1:Edit, Workers Scripts:Edit, Pages:Edit,
# User Details:Read, AND User Memberships:Read (the last is non-obvious —
# `wrangler whoami` works without it but `migrations apply` 401s on
# /memberships). Pick the "Edit Cloudflare Workers" template for the
# full set.
CLOUDFLARE_API_TOKEN=...
# Pin which account this repo deploys to. Required when your token has
# access to multiple accounts (e.g. personal + org).
CLOUDFLARE_ACCOUNT_ID=...
```

Wrangler 4.x auto-reads `.env.local` — no shell exports, no `dotenv-cli`,
no `account_id` in `wrangler.toml` (it's ignored for Pages configs).
Full debugging story: [`docs/KNOWN_ISSUES.md`](docs/KNOWN_ISSUES.md) →
*Resolved → Cloudflare auth (/memberships 10000)*. Setup guide:
[`docs/GUIDELINE.md`](docs/GUIDELINE.md) → *Cloudflare / wrangler env*.

## 📁 Project Structure

```
frontend/src/
84: ├── app/[locale]/       # Pages (home, scan, demo, login, dashboard, pricing, recipes)
85: ├── lib/
86: │   ├── auth-store.ts   # Zustand auth state (login, register, promo codes)
87: │   ├── promo-codes.ts  # Promotion code system (TRIAL, DISCOUNT, FANCLUB, REFERRAL)
88: │   ├── tier-config.ts  # Feature gating (Free, Premium, Family)
89: │   └── logger.ts       # Client/Edge unified logger
90: ├── db/schema.ts        # Drizzle ORM schema (users, promo_codes, sessions)
91: └── messages/           # i18n translations (en, th, de, da)
```

## 📊 Member System

### Authentication Flow
1. Register with email/password → free tier
2. Redeem promo code → upgrade to premium/trial
3. Edge-native security: Secure HttpOnly cookies powered by Next.js Edge APIs and Cloudflare D1.

### Subscription Tiers
- **Free**: Basic scanning (10/month), 3 health dimensions, 100 recipes
- **Premium** (฿199/mo): Unlimited scans, 8 dimensions, meal planning, data export
- **Family** (฿299/mo): All Premium + 5 family members, kids nutrition mode

## 📋 Business Development

### Revenue Streams
1. **B2C Subscriptions** — Freemium → Premium/Family
2. **B2B Corporate Wellness** — Enterprise packages for organizations
3. **Partnership Revenue** — Delivery integration, content licensing, affiliate programs
4. **Promotion System** — Fanclub codes (Shinny), launch codes, referral codes

### Year 1 Focus
- Build user base with freemium model
- Engage Shinny fanclub with exclusive promo codes
- Iterate on AI food scanning accuracy
- Scale with minimal operational staff

## 📜 License

MIT © Werapol Bejranonda
