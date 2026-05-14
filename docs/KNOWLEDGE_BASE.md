# 🧠 Knowledge Base - Nutri-Vision AI (EatInOrder)

This document serves as a central repository for the architectural decisions, domain logic, and technical foundations of the EatInOrder project.

## 🥗 Core Philosophy: "อร่อย ตาม ลำดับ" (Delicious in Order)

The project is built on the scientific principle of **Food Sequencing**. By consuming food in a specific order, we can significantly flatten glucose spikes after meals.

### The Ideal Sequence
1.  **Fiber (Vegetables/Salads)**: Creates a physical mesh in the small intestine, slowing down the absorption of sugars.
2.  **Protein & Fats (Meat/Eggs/Legumes/Healthy Oils)**: Stimulates GLP-1 (Glucagon-like peptide-1), which slows down gastric emptying.
3.  **Carbohydrates (Rice/Bread/Pasta/Fruit)**: Starch is converted to glucose and absorbed more slowly due to the "protective shield" created by steps 1 and 2.
4.  **Sugar (Desserts/Sweet Drinks)**: Consumed last to minimize the insulin spike.

## 📊 8-Dimension Nutrition Scoring

Our proprietary scoring algorithm (found in `backend/app/services/nutrition_scorer.py`) evaluates food across 8 key health metrics:

1.  **Blood Sugar Impact**: GI calculation, fiber-to-carb ratio, and fructose penalties.
2.  **Gut Health**: Fiber content, prebiotic/probiotic indicators, and fermented food bonuses.
3.  **Inflammation**: Omega-3:6 ratio, ORAC values (antioxidants), and pro-inflammatory marker detection.
4.  **Nutrient Density**: Nutrients per calorie (ANDI-style scoring).
5.  **Processing Level**: NOVA classification, Ultra-Processed Food (UPF) ingredient detection.
6.  **Protein Quality**: Quantity and source quality (PDCAAS-based).
7.  **Micronutrient Coverage**: % RDI coverage for 12 essential vitamins/minerals.
8.  **Overall Health Score**: A weighted average (Blood Sugar 20%, others 10-15%).

## 🤖 AI Service (Workers AI & Google AI)

We use a **Gemini-Primary Cascade + Cloudflare Safety-Net Strategy** for accuracy with last-resort fallback:
-   **Primary Cascade**: `GEMINI_VISION_MODELS` in `frontend/src/lib/ai-providers.ts` — currently `['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash']`. `attemptGoogleInference` in `/api/analyze` walks the list, returning the **first model that responds 200**, skipping on **404 (model retired)** or **429 (per-model quota exhausted)**, throwing on any other status (5xx / network — retrying a sibling model can't help with upstream-wide problems).
-   **Safety-Net Fallback**: Cloudflare `@cf/meta/llama-3.2-11b-vision-instruct`. Bug-hunt May 2026 surfaced that this model is much weaker on the food-analysis task — misidentifies common dishes ("Pineapple" for Shrimp Fried Rice with 100% confidence) and produces non-deterministic JSON. We keep it as a **last resort** rather than primary so users get *some* response when Gemini is fully exhausted, while the routine happy-path returns Gemini's accurate analyses. The route auto-accepts the Meta Llama Community License on first 5016 (PR #25) so the fallback works without operator action.
-   **Why Gemini-primary, not CF-primary**: when CF was primary, its unreliable JSON output triggered fallthrough to Gemini on most scans anyway — CF-first effectively cost the same Gemini quota while serving inaccurate results on the subset where CF *did* return parseable garbage. Reversing trades CF-primary's "fast, free, sometimes-wrong" UX for "accurate when Gemini has quota, falls back to CF when it doesn't." Net Gemini quota usage is roughly unchanged.
-   **Why a cascade, not a single id**: Google's free tier is *per-project AND per-model*. May 2026 (Request IDs `tqunrejp` / `fz64f4uh`) caught us with `gemini-2.0-flash` at `limit: 0` while `gemini-2.5-flash` on the same key still had 1500 req/day. A single hardcoded model id is one policy change away from outage; the cascade survives it. **Never use a `-latest` alias** — Google retired `gemini-1.5-flash-latest` from `v1beta` in May 2026 without notice (PR #21 → #22).
-   **Single source of truth across surfaces**: `lib/ai-providers.ts → callGemini` (the chat path's Gemini step) references `GEMINI_VISION_MODELS[0]` instead of a literal id. Scan + chat can never silently drift apart.
-   **Diagnostic surface**: on 503, the route response body includes `primaryProviderError` (the Cloudflare-primary error message that kicked the request into the Gemini cascade). Without this, operators only see the LAST error in the chain (Google's) and are blind to which provider actually broke. Shipped PR #23.
-   **Robustness**:
    -   25s timeout for the 11B model.
    -   Per-Gemini-model timeout = `floor(totalTimeout / GEMINI_VISION_MODELS.length)` so the cascade as a whole still fits the caller's budget.
    -   **Auto-Correction Loop**: Validations trap malformed JSON (`safeParseJson` tries direct, then regex extraction). On failure, it triggers a secondary inference pass preferring Google for provider diversity instead of looping the same model.
    -   Combined 45s total budget for a successful scan.
    -   Granular phase tracking and specific error details.
-   **Multi-Mode Intelligence**: The prompt dynamically adapts to three modes:
    -   **Meal Scan**: Multi-dish detection and cross-dish sequence planning. Native support for multi-photo collages (up to 10 photos stitched client-side with strictly sequential, yielded compression loops to prevent UI freezes on low-memory phones).
    -   **Menu Scan**: Multilingual menu reading, health ratings (0-100), and scenario-based recommendations.
    -   **Drink & Snack**: Sugar-focused analysis with visual sugar cube conversions and healthier alternatives.
-   **Graceful Rejection**: The AI is strictly instructed to return `isFood: false` and a `nonFoodReason` message if images are unrelated, triggering a dedicated safety UI instead of crashing.
-   **Chatbot (Shinny)**: Providing empathetic, evidence-based nutrition coaching using the "Live long to eat well" persona.

## 🏗️ Technical Architecture

### Frontend (Next.js)
-   **App Router**: Modern React patterns for server and client components.
-   **i18n**: Multi-language support using `next-intl`.
-   **Edge Compatible**: Optimized to run on Cloudflare Pages/Workers.
-   **Composable Architecture**: The massive `scan/page.tsx` is decoupled into focused hooks (`useScanUpload`, `useScanAnalysis`, `useScanDebug`) and modular components (`ScanUploadArea`, `ScanLoadingOverlay`, `ScanDebugPanel`) to guarantee long-term maintainability.

### API Architecture (Cloudflare Edge)
The core `/api/analyze` route follows a strict **10-Phase Fault-Tolerant Pipeline** to guarantee it never crashes the user experience:
1. Every phase (DB init, session retrieval, AI, etc.) is wrapped in an isolated `try/catch`. 
2. If non-critical services (like D1 Database or Sessions) fail, the pipeline logs the failure but continues, allowing anonymous scans to succeed.
3. **Edge-Safe Binaries**: Node.js `Buffer.from` is avoided for base64 decoding because it lacks standard support in Edge runtimes. We use `atob()` and `Uint8Array` natively.
4. **Server-Side AI Timeouts & Fallbacks**: The system uses a recursive `attemptAiInference()` pattern. The `env.AI.run()` binding is wrapped in a `Promise.race([aiPromise, timeoutPromise])` to abort gracefully. If the primary attempt fails, it triggers the secondary fallback model immediately.
5. **Binding Access**: All Cloudflare bindings (AI, DB, KV, R2) **must** be accessed via the shared helpers in `src/lib/cloudflare.ts` (`getEnv()` or `getEnvSafe()`), returning a fully-typed `CloudflareEnv` interface to prevent silent `undefined` errors.
6. **No-Store Caching**: Given the dynamic, personalized nature of our AI payloads and localized DB states, all API outputs carry `Cache-Control: no-store` headers to prevent CDN lock-in.
7. **Lazy Session Cleanup**: Login generation invokes an opportunistic background pruning task to auto-clean expired sessions and reduce row limits.

### Model Evaluation & Testing
To ensure the high accuracy of the Dual-Provider architecture, we maintain a standalone testing suite in `scripts/test-models.mjs`. This script evaluates our fallback configurations directly against a control set of images located in `research/test-image/`. This ensures both the Cloudflare and Google AI nodes produce consistent, high-quality JSON schemas before production deployments.

### Automated regression gates (added 2026-04, project-hardening pass)

The static safety net runs on every commit via `npm run check:all`:

1. **Zod request validation** — every `/api/*` route parses its JSON body through a schema in `frontend/src/lib/schemas.ts` before touching the DB or AI. Wrong types, oversize strings, non-data-URI images all die at the edge with a uniform `{ error, fields: { name: issueCode } }` shape. See `GUIDELINE.md → Request-body validation` for the contract.
2. **Vitest test suite** — **108 tests** under `frontend/tests/` lock the PRs #6–#28 security, prompt, AI-fallback, and rate-limit logic: PBKDF2 + constant-time compare, legacy-hash fallback, `validateMultiDishResponse` normalisation, `buildCollageInstruction` preamble + final reminder, Thai anti-romanization rule, all four zod schemas, the `GEMINI_VISION_MODELS` cascade invariants (every entry `^gemini-`, no `gemma`, no `-latest$`, route iterates the constant, response surfaces `primaryProviderError`, Gemini-before-CF source order, CF image format `Array.from(decodeBase64ToBytes(...))`, Llama 5016 auto-accept), and the rate-limit **enforcement contract** (same-IP exhaustion blocks, distinct-IP isolation, distinct-route isolation, sustained-flood non-DoS).
3. **i18n drift check** — `scripts/check-i18n-keys.mjs` extracts every `useTranslations('ns') + <var>('key')` call in the codebase (handling the `tNav` / `tBrand` / `tGamify` multi-namespace pattern) and verifies each key exists in every locale JSON. Prevented class: the `scan.dishes_found` literal-string regression.

Failing any of these blocks the push. See `ITERATION_PROCESS.md` for the full gate order.

### End-to-end-with-real-food validation gate (added 2026-05, Gemini cascade pass)

`npm run check:all` is necessary but **not sufficient** before declaring an AI-pipeline fix "shipped". The static suite cannot detect provider-side issues like a retired model alias, a `limit: 0` free-tier quota, or a primary that fails on real images but works on test fixtures. The process gate in `ITERATION_PROCESS.md §3 / §5` requires a **post-deploy probe with a real food photo** that returns a populated `dishes` array — a 200 with `isFood:false` (i.e. a non-food image like a screenshot of the error UI) is not evidence the cascade works.

Three "fixed" PRs (#21, #22, #23) went out for the same underlying class of bug before this gate was added. Each round, the static suite passed and a non-food image returned 200 — so the cycle felt complete — but the user got 503 on their actual food photo because the validation hadn't actually exercised the success branch.

### Per-IP rate limiting (`lib/rate-limit.ts`)

Sliding-window limiter applied to every public POST surface that does expensive or sensitive work:

| Route | Limit | Window | Threat |
|-------|-------|--------|--------|
| `/api/auth/login` | 10 | 15 min | Brute-force password guessing |
| `/api/auth/register` | 3 | 15 min | Sign-up spam |
| `/api/voucher/check` | 30 | 1 min | Voucher-code enumeration |
| `/api/chat` | 20 | 1 min | Free-tier AI abuse |
| `/api/analyze` | (per-tier scan quota; D1-backed counter — separate from per-IP) | — | Tier-quota evasion |

**Storage**: module-scoped `Map<string, Bucket>` in the worker's V8 heap. Persists across requests within a worker instance until the instance is recycled (~30 min idle on Cloudflare). Memory bounded by a periodic prune.

**Why not `caches.default`** (the v1 design): In raw Workers, `caches.default` gives same-millisecond read-after-write consistency. In the **OpenNext-on-Pages runtime**, it does not — the `cache.put()` doesn't propagate before the next request reads, so every request sees an empty bucket. Bug-hunt May 2026 caught this: 40 parallel `/api/voucher/check` probes against a 30/min limit all returned 200; sequential 35 returned 26×200 then 9×429. The fix swapped the primary store to the module Map; the call-site API is unchanged so future swaps for Upstash Redis or Durable Object stay transparent.

**Threat-model fit**: per-instance scope catches sequential brute-force from one IP (the *actual* threat — a credential-stuffer hitting `/api/auth/login` from a single source). A distributed attacker hitting 20+ CF PoPs simultaneously can still evade; that's documented as a future swap-to-cross-instance-store path. **Public probes use parallel curl bursts, which scatter across instances and look like 200-only — sequential probes are the correct manual smoke test.**

**Failure mode contract**: `rateLimit()` MUST NOT throw. Auth/scan/voucher routes call it BEFORE entering their try/catch; an uncaught throw would surface as the framework's default 500. Every code path falls open on unexpected conditions — better to let a request through than 429 everyone because the limiter is broken.

### Backend (FastAPI)
-   **Async First**: All IO operations (DB, AI calls) are asynchronous.
-   **Pydantic Settings**: Environment-based configuration with strict validation.
-   **Structured Logging**: Every request, response, and internal service step is logged for transparency.

## 🔐 Cloudflare wrangler auth (project-scoped)

Wrangler — for `d1 migrations apply`, Pages deploys, KV/R2 ops, etc. — needs **two pieces** of identity, both project-scoped to the repo via `frontend/.env.local` (gitignored):

| Variable | What it does | Source |
|----------|--------------|--------|
| `CLOUDFLARE_API_TOKEN` | Authenticates the request. Must have the scopes listed below. | https://dash.cloudflare.com/profile/api-tokens |
| `CLOUDFLARE_ACCOUNT_ID` | Pins the repo to one account when the token has access to multiple (very common — personal + org). | `wrangler whoami` output, or the dashboard URL bar. |

### Required token scopes (least-privilege)

```
Account → D1:Edit
Account → Workers Scripts:Edit
Account → Cloudflare Pages:Edit
User    → User Details:Read
User    → Memberships:Read       ← easy to miss
```

The `Memberships:Read` scope is non-obvious. `wrangler whoami` works without it, so a partially-scoped token *looks* fine — but every remote-resource command (including `d1 migrations apply`) first probes `/memberships` as a token-validation step. Without the scope you get `Authentication error [code: 10000]` and never reach the actual operation. Fully documented under `KNOWN_ISSUES.md → Resolved → Cloudflare auth (/memberships 10000)`.

### Why `.env.local` and not `wrangler.toml` / shell env?

- **Project scope**: a developer with multiple Cloudflare accounts (personal + org) doesn't want one global `CLOUDFLARE_ACCOUNT_ID` polluting every project they touch. `.env.local` is per-repo.
- **Wrangler auto-loads `.env.local`**: confirmed empirically — both vars resolve in a fresh shell with no inline exports. No wrapper script or `dotenv-cli` needed.
- **`wrangler.toml` doesn't work for this**: top-level `account_id` is *ignored* by `wrangler d1 …` when the config is a Pages-style config (i.e. has `pages_build_output_dir`). We tried it; it silently doesn't take effect.
- **CI**: pipelines inject the same two variables as repo / org secrets — same code path, no special handling.

`.gitignore` already excludes `.env`, `.env.local`, `.env.*.local`. **Never** check the token into git.

## 🛠️ Logging & Monitoring

We use a unified logging system (`src/lib/logger.ts`) across the stack that bridges Client and Server (Edge) logs:
-   **Scan Flow Diagnostics**: 7 dedicated methods (`scanStart`, `scanApiCall`, `scanError`, `scanApiStage`, etc.) track every step of the food scan journey from upload to DB insert.
-   **Cloudflare Dash**: Real-time log streaming through the Cloudflare Dashboard catches both frontend hydration errors and API timeouts.
-   **Structured Context**: All logs include JSON payloads with file sizes, timings (`durationMs`), and exact failure phases to make debugging trivial.

## 🕒 Client-Side State & Storage

While most data is secured on the backend, we use certain local mechanisms for enhanced UX:
-   **Zustand Auth Store**: Manages the local hydration of user session states.
-   **Scan History (`scan-history.ts`)**: Independently from auth, the last 10 successful scans are stored in `localStorage` alongside 80x80px downscaled thumbnails. This provides users an offline-capable meal log and gives developers an easy history of AI inference checks.
