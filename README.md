# 🍜 Shinny Guide (Nutri-Vision AI)

**อร่อย ตาม ลำดับ — Delicious in Order**

> Live Long to Eat Well · อยู่เพื่อกินบำนาญ

[![Cloudflare Pages](https://img.shields.io/badge/deploy-Cloudflare_Pages-F38020?logo=cloudflare)](https://nutri-vision-ai.pages.dev)
[![Next.js 14](https://img.shields.io/badge/Next.js-14-black?logo=nextdotjs)](https://nextjs.org)
[![CI](https://github.com/bejranonda/Nutri-Vision-AI/actions/workflows/ci.yml/badge.svg)](https://github.com/bejranonda/Nutri-Vision-AI/actions/workflows/ci.yml)

## What is Shinny Guide?

Shinny Guide is an AI-powered food sequencing app that helps you eat Thai food (and any cuisine) in the right order to reduce blood sugar spikes by up to **70%**\* . Based on real science — eat **Veggies → Protein → Carbs → Sweets**.

<sub>\*Based on a Weill Cornell Medical Center study (Shukla et al., 2015) in type-2 diabetes patients. Individual results vary. Citation surfaced inline on the homepage so first-time visitors don't have to wonder where the number came from — see UX-audit Round 7 iter 9 (PR #53).</sub>

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

Every page shares the same `<SiteHeader/>` (brand mark + Scan/Recipes/Pricing nav + LanguageSwitcher + auth-aware Login/Dashboard CTA + mobile hamburger drawer). Added in UX-audit Round 7 iter 3 (PR #48) to replace the inconsistent per-page "Back to home" stubs that fresh users hit before — see [`docs/KNOWLEDGE_BASE.md`](docs/KNOWLEDGE_BASE.md) → *Fresh-user audit loop*.

- **Home** — Landing page with concept explanation, features, "free / no signup needed" reassurance, and the canonical primary CTA (*Start your scan*).
- **Scan** — AI food analysis with 3 dynamic modes (Meal, Menu, Drink/Snack), sequence visualization & 8-dimension scoring. Surfaces a small privacy note under the upload zone ("photos analyzed in real time, never stored on a server unless you save them"). Features an advanced Debug UI via `?debug=1`.
- **Demo** — Interactive walkthrough of food sequencing with blood sugar curves.
- **Login** — Email + password authentication, voucher field in the register form, and a register-as-default tab for fresh visitors. Google + LINE social-login buttons are rendered as **disabled with a visible "Soon" badge** (Round 7 iter 6, PR #50) — the buttons signal a future feature without lying about current state. OAuth backend not yet wired (tracked in [`docs/KNOWN_ISSUES.md`](docs/KNOWN_ISSUES.md) item 1a).
- **Dashboard** — Member stats, streak tracking, daily challenges, gamification.
- **Pricing** — Tier comparison with monthly/annual toggle, FAQ, and an **expandable disclosure listing all 8 health-score dimensions** with one-line explanations and badges marking the 3 the Free tier unlocks (Round 7 iter 5, PR #49). Lets fresh visitors evaluate "is the 8-dim score worth upgrading?" without signing up and scanning a meal first.
- **Recipes** — Placeholder while the real recipe catalogue ships. The page used to be a bare "coming soon" stub; Round 7 iter 4 (PR #48) replaced that with a Shinny-voiced empty state and a Scan CTA so users don't dead-end.
- **Chat** (`/[locale]/chat`, login-required) — AI Coach Shinny. Conversational nutrition coaching backed by a free-tier provider cascade: Groq Llama 3.3 70B (primary, sub-300ms) → Gemini 1.5 Flash → Cloudflare Workers AI safety net. Tier-quota gated (`aiQuestionsPerDay`: free=3, premium=∞). Locale-aware persona that bakes the brand's three rules: never forbid food, warm older-sister tone, stay in food/nutrition scope. See [Tech Stack](#-tech-stack) for the provider chain.
- **Admin** (`/[locale]/admin`, restricted) — operator console: quick-stat overview, user management (toggle admin, flip subscription tier), promo-code CRUD, and a health-check view. Gated server-side by the `isAdmin` column on `users`; non-admins are silently redirected to `/login`. See [`docs/ADMIN_BOOTSTRAP.md`](docs/ADMIN_BOOTSTRAP.md) for how to create the first admin via `wrangler` (the schema ships with zero admins — no accidental admin via public sign-up).

> **First-impression UX + audit posture:** Rounds 7 → 11 (May–June 2026) iterated on the product through four lenses — fresh-user reading, live Playwright against the deploy, authed-surface walkthrough with a session cookie, and a Web-Vitals + accessibility inventory. The biggest deltas:
> - **Round 7** canonicalized CTAs, added a citation footnote to the homepage "70%" claim, shipped a persistent `<SiteHeader/>` on every page.
> - **Round 8** caught `/chat` being unreachable on hard-load for logged-in users (auth-store probe race) + a console-401 on every anonymous page load.
> - **Rounds 9–10** swept 245 lines of unwired frontend code + 25 orphan i18n keys (× 4 locales) + two dead SQLAlchemy models, and fixed an iPhone-SE 375px overflow on `/pricing`.
> - **Round 11** dropped homepage **FCP from 2272ms to 620ms (−73%)** by removing two never-applied Google Font families, added `<main>` landmarks across all public pages (WCAG 2.1 AA), and stood up the first CI workflow on the repo.
> - **Round 12** added the automated **full user-journey spec** (`tests/e2e/user-journey.spec.ts`) — landing + locale switch, photo upload → AI analyze → terminal result, registration round-trip, recipes/chat/dashboard browse — all driven through the rendered UI against production. Building it surfaced an intermittent client-side error-boundary crash after the register response (now pinned by a sentinel assertion) and the silent sub-500-byte file rejection in the upload hook.
> Full play-by-play in `CHANGELOG.md` and `docs/KNOWLEDGE_BASE.md → Fresh-user audit loop / Live-deploy + authed-surface audit / Backend role clarified / Full user-journey e2e`.

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
1.  **Primary**: Google Gemini Flash cascade — `gemini-2.5-flash` → `gemini-2.0-flash` → `gemini-1.5-flash` (multimodal, free tier ~1500 req/day per model per project).
    *   `attemptGoogleInference` walks `GEMINI_VISION_MODELS` in `lib/ai-providers.ts`, returning the first model that responds 200. Skips on 404 (model retired) or 429 (per-model quota exhausted) and falls through to the next id. Same Google key covers scan + chat; chat uses `GEMINI_VISION_MODELS[0]` for single-source-of-truth alignment.
    *   We pin to explicit model ids (no `-latest` aliases) — Google retired `gemini-1.5-flash-latest` from `v1beta` in May 2026 without notice. We also cascade rather than hardcode a single id — Google later silently dropped this project's `gemini-2.0-flash` free quota to `limit: 0` while `gemini-2.5-flash` on the same key still had quota.
2.  **Safety-net fallback**: Cloudflare `@cf/meta/llama-3.2-11b-vision-instruct` (multimodal, free with the Pages plan).
    *   Runs only when the Gemini cascade exhausts (all three models 429/404'd) or returns garbage. Bug-hunt May 2026 surfaced that CF Llama 3.2 11B vision is much weaker than Gemini on this task — it misidentifies common dishes ("Pineapple" for Shrimp Fried Rice with 100% confidence) and its JSON output is non-deterministic. Keeping it as the last-resort fallback gives users *some* result when Gemini is fully exhausted rather than a 503; for the routine happy path, Gemini's accuracy wins.
    *   The route auto-accepts the Meta Llama Community License on first 5016 (via `prompt: 'agree'`) so the fallback path doesn't require manual operator action in the CF dashboard.

The analysis pipeline is built for **Edge Reliability**:
1. Client-side canvas compression (reduces 10MB photos to ~150KB), now with skipping double-compression for single photos.
2. **10-Phase Fault-Tolerant Pipeline**: Each stage (DB, Session, AI) is individually isolated in `try/catch` blocks. The AI step features an **Auto-Correction Loop** using a `safeParseJson` strategy and preferred Google provider diversity on retry.
3. Server-side AI timeout (45s total) using `Promise.race`, now with `4096` output tokens for complex multi-dish extraction.
4. Request Tracing & Telemetry: Every scan is unique-indexed. Use the `?debug=1` query parameter on the scan page for real-time phase timings.
5. Strict JSON schema validation and graceful "Non-Food" detection rendering.
6. **Decoupled Architecture**: Logic is fully isolated via custom hooks (`useScanUpload`, `useScanAnalysis`, `useScanDebug`), ensuring a clean Orchestrator Page.
6. **Multi-Photo Collage Engine**: Client-side canvas stitching up to 10 photos, with **Dynamic Canvas Scaling** to prevent memory crashes on older phones (scales based on `navigator.deviceMemory`).
7. Deployment Monitoring: Verify AI bindings, database status, and **deployment freshness** (commit SHA + branch from CF Pages build env) securely via the `/api/health` endpoint. The `deployment.shaShort` field lets you eyeball "is this the commit I think it is?" in one curl:
   ```bash
   curl -s https://shinnyguide.autobahn.bot/api/health | jq .deployment
   ```
8. **Per-IP Rate Limiting** (`lib/rate-limit.ts`): sliding-window throttle on every public POST surface — `/api/auth/login` (10/15min), `/api/auth/register` (3/15min), `/api/voucher/check` (30/min), `/api/chat` (20/min), `/api/analyze`. Primary store is a module-scoped `Map` (per-worker-instance, V8-heap-resident), chosen over `caches.default` after bug-hunt May 2026 found the Workers Cache API doesn't give same-millisecond read-after-write consistency in the OpenNext-on-Pages runtime — 40 parallel voucher probes against a 30/min limit had all returned 200. Tested with 5 enforcement cases that prove the limit actually engages, not just that the helper doesn't throw.
9. **Uniform `Cache-Control: no-store` on every `/api/*` response** via `lib/api-response.ts → jsonResponse()`. UX-audit round 2 (May 2026) caught that 12 of 13 API routes were shipping responses with no `Cache-Control` header at all. Each route migrated; an invariant test walks `src/app/api/**/route.ts` at CI time and forbids `NextResponse.json(...)` in live code so the class of bug can't reappear.
10. **Security headers on every HTML page** via `next.config.js → headers()`: `X-Frame-Options: DENY` (no iframe-embed use case), `Referrer-Policy: strict-origin-when-cross-origin` (stops leaking debug URLs to third-party CDNs), `Permissions-Policy` locking everything except `camera=(self)` for the scan flow. HSTS + `X-Content-Type-Options: nosniff` already set at the Cloudflare edge.
11. **PWA install support** via `src/app/manifest.ts` — served at `/manifest.webmanifest`. Brand-coloured (theme `#ec7064`, background `#fff5f5`), standalone-portrait display for the mobile-first scan flow.
12. **Multi-locale sitemap** at `/sitemap.xml` via `src/app/sitemap.ts` — covers `/`, `/scan`, `/demo`, `/pricing`, `/recipes`, `/login` across all 4 locales with `hreflang` alternates so search engines understand `/th/scan` and `/en/scan` are translations of the same page, not duplicate content. Auth-gated routes (`/dashboard`, `/chat`, `/admin/*`) deliberately excluded — indexing them would point search users at a redirect-to-login.
13. **Share-preview metadata + locale-aware 404 page**: `og:image` + `twitter:image` ensure social shares render a preview card (Shinny avatar via `metadataBase`-resolved absolute URLs). `src/app/[locale]/not-found.tsx` localizes the 404 experience across all 4 locales with a `not_found` message namespace, plus two CTAs (Home + Scan) so users don't dead-end.
14. **Playwright e2e suite** at `frontend/tests/e2e/` — **97 cases** across 6 spec files (`smoke`, `ui-ux`, `deep-probes`, `a11y`, `responsive-perf`, `user-journey`) running against the live production URL. Pins everything Vitest unit tests can't reach: `<link rel="alternate" hreflang>`, `og:image`/`twitter:image`, locale-aware 404 body, sitemap XML, `Cache-Control` on every API response, deployment SHA exposure, schema-failure shapes, icon-only-button accessible names, `htmlFor`/`id` label associations, color-scheme declaration, viewport breakpoints (incl. iPhone-SE 375px overflow), payload caps, `<main>` landmark on every public page (Round 11), no-wasted-preload guards, anonymous `/api/auth/me` 200-probe contract, third-party-script whitelist. Round 12 added `user-journey.spec.ts` — a 4-phase **full real-user journey** (landing + locale switch → photo upload → AI analyze → terminal result, registration round-trip, recipes/chat/dashboard browse) driven through the rendered UI, not API probes. Opt-in via `npm run test:e2e` (needs `@playwright/test` + Chromium browser).
15. **Five-lens testing posture** (Rounds 7 → 12): the project treats correctness as having five orthogonal lenses, each catching a class of bug the others miss.
    - **Unit** (`vitest`, code invariants) — 171 cases.
    - **e2e** (`playwright`, rendered DOM behaviour against the live deploy) — 97 cases.
    - **Fresh-user audit** (human/AI walking through with zero context, catching editorial / honesty / IA bugs) — 9 fixes in Round 7, 9 in Round 8, 5 in Round 10–11.
    - **Web Vitals + accessibility inventory** (Round 11) — driving real browsers + axe-style DOM checks to catch perf regressions (FCP/LCP/CLS) and WCAG 2.1 AA gaps (`<main>`, h1 hierarchy, label associations) that don't show up as functional failures.
    - **Full user-journey** (Round 12) — one automated spec that walks the whole product end-to-end the way a real user would (upload a real file through the file input, click the rendered Analyze CTA, submit the real register form), asserting every flow reaches a *terminal UI state* rather than a spinner or crash. Catches integration-seam bugs (client timeout vs server budget, error-boundary engagement, silent file-rejection) that per-surface e2e probes miss.
    Recipes for all five live in [`docs/GUIDELINE.md`](docs/GUIDELINE.md) → *The fresh-user audit lens*, *The Web-Vitals + a11y inventory lens*, and *The full user-journey lens*.
16. **GitHub Actions CI** at `.github/workflows/ci.yml` (added Round 11) — frontend `check:all` + backend `pytest` on every PR. Before this there was no CI at all; the standalone backend went 6 weeks unverified between Round 8 and Round 9, long enough that Round 9 found 3 latent bcrypt failures + a phantom `python-cors==1.0.0` dep that broke `pip install` outright. CI now catches that rot at PR time. The Playwright e2e suite stays opt-in (manual post-deploy step) so it doesn't false-positive against in-flight deploys.

## 🛠 Tech Stack

- **Frontend**: Next.js 14, TypeScript, Tailwind CSS
- **i18n**: next-intl (🇬🇧 EN, 🇹🇭 TH, 🇩🇪 DE, 🇩🇰 DA)
- **State**: Zustand with persist middleware
- **Database**: Drizzle ORM + Cloudflare D1 (SQLite)
- **Deploy**: Cloudflare Pages + Workers
- **AI vision** (food scan): Google AI Gemini Flash cascade (`gemini-2.5-flash` → `gemini-2.0-flash` → `gemini-1.5-flash`, fall-through on 404/429) → Cloudflare Workers AI (Llama 3.2 11B Vision) — accuracy-first cascade with multimodal fallback, locale-aware prompting.
- **AI chat** (Coach Shinny): Groq (Llama 3.3 70B, free 30 req/min) → Google AI Gemini (`GEMINI_VISION_MODELS[0]`, ~1500 req/day) → Cloudflare Workers AI — three-stage cascade, free-tier-first.
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

Before every commit / PR, run the combined check suite. It catches the classes
of regression we've historically had, and CI re-runs the same on every PR
([`.github/workflows/ci.yml`](.github/workflows/ci.yml)):

```bash
cd frontend
npm run check:all      # = type-check + check:i18n + test (171/171)
```

Individually:

| Script | Purpose |
|--------|---------|
| `npm run type-check` | Strict TypeScript (`tsc --noEmit`) across the whole frontend |
| `npm run check:i18n` | Ensures every `t('…')` key used in code exists in **all 4 locale JSONs** (th/en/de/da) — 216 keys each |
| `npm test` | Vitest unit tests — crypto (PBKDF2 + constant-time compare), ai-prompt validators, zod schemas, auth-store `authChecked` lifecycle |
| `npm run test:e2e` | Playwright e2e against the live deploy — **97 cases** across `smoke`, `ui-ux`, `deep-probes`, `a11y`, `responsive-perf`, `user-journey` (opt-in, needs Chromium + network) |
| `npm run build` | Full Next.js production build, same thing Cloudflare Pages runs |

Backend (reference impl, runs via CI; see [`docs/KNOWLEDGE_BASE.md`](docs/KNOWLEDGE_BASE.md) → *Backend (FastAPI) — strategic role clarified*):

```bash
cd backend
pip install -r requirements.txt
PYTHONPATH=. pytest -q   # 129 tests: security, scorer, gemini, config
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
