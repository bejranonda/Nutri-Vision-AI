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
2. **Vitest test suite** — **164 unit + 79 e2e = 243 tests** under `frontend/tests/` lock the PRs #6–#34 security, prompt, AI-fallback, rate-limit, health-shape, API-response, and SEO/PWA contracts: PBKDF2 + constant-time compare, legacy-hash fallback, `validateMultiDishResponse` normalisation, `buildCollageInstruction` preamble + final reminder, Thai anti-romanization rule, all four zod schemas, the `GEMINI_VISION_MODELS` cascade invariants (every entry `^gemini-`, no `gemma`, no `-latest$`, route iterates the constant, response surfaces `primaryProviderError`, Gemini-before-CF source order, CF image format `Array.from(decodeBase64ToBytes(...))`, Llama 5016 auto-accept), and the rate-limit **enforcement contract** (same-IP exhaustion blocks, distinct-IP isolation, distinct-route isolation, sustained-flood non-DoS).
3. **i18n drift check** — `scripts/check-i18n-keys.mjs` extracts every `useTranslations('ns') + <var>('key')` call in the codebase (handling the `tNav` / `tBrand` / `tGamify` multi-namespace pattern) and verifies each key exists in every locale JSON. Prevented class: the `scan.dishes_found` literal-string regression.

Failing any of these blocks the push. See `ITERATION_PROCESS.md` for the full gate order.

### End-to-end-with-real-food validation gate (added 2026-05, Gemini cascade pass)

`npm run check:all` is necessary but **not sufficient** before declaring an AI-pipeline fix "shipped". The static suite cannot detect provider-side issues like a retired model alias, a `limit: 0` free-tier quota, or a primary that fails on real images but works on test fixtures. The process gate in `ITERATION_PROCESS.md §3 / §5` requires a **post-deploy probe with a real food photo** that returns a populated `dishes` array — a 200 with `isFood:false` (i.e. a non-food image like a screenshot of the error UI) is not evidence the cascade works.

Three "fixed" PRs (#21, #22, #23) went out for the same underlying class of bug before this gate was added. Each round, the static suite passed and a non-food image returned 200 — so the cycle felt complete — but the user got 503 on their actual food photo because the validation hadn't actually exercised the success branch.

### HTML security headers (`next.config.js → headers()`)

UX-audit round 3 (May 2026) probed HTML responses for the standard defence-in-depth headers and found only HSTS and `X-Content-Type-Options: nosniff` (both set by the Cloudflare edge, not Next.js itself). The route shipped the following three via `next.config.js`:

| Header | Value | Why |
|---|---|---|
| `X-Frame-Options` | `DENY` | No iframe-embed use case anywhere; deny is the safest default and blocks clickjacking. |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Stops leaking locale-tagged URLs (which can carry `?debug=1` or scan request IDs) to third-party CDNs and trackers. Same-origin gets full URL, cross-origin gets just origin. |
| `Permissions-Policy` | `camera=(self), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()` | Scan flow needs camera. Everything else is unused, so a compromised dependency can't quietly call them. |

Headers apply to every non-`/api/*` route. API routes don't render HTML, and they already set `Cache-Control: no-store` via `lib/api-response.ts`.

**Not yet shipped**: `Content-Security-Policy`. Needs a full audit of inline styles/scripts Next.js emits. Tracked in `KNOWN_ISSUES.md → Content-Security-Policy not yet set`.

### Share-preview metadata + locale-aware 404 (UX round 4)

- `src/app/[locale]/layout.tsx → metadata.openGraph.images` + `metadata.twitter.images` ensure every share renders a preview card (the Shinny avatar, 640×640, accepted by both Facebook and Twitter at the `summary_large_image` ratio). `metadataBase: new URL('https://shinnyguide.autobahn.bot')` resolves the relative path against the prod origin — without it, crawlers see `http://localhost/...` and fail to load the image.
- `src/app/[locale]/not-found.tsx` is the Next.js convention for a segment-scoped 404 — placed under `[locale]/`, it renders in whichever locale the user landed on. Reads the new `not_found` namespace in the locale JSONs (5 keys × 4 locales). Two CTAs (Home + Scan) so the page isn't a dead-end.

### PWA manifest + multi-locale sitemap

- `src/app/manifest.ts` is served at `/manifest.webmanifest` (Next.js App Router convention). Standalone-portrait display, brand-colour tokens. Mobile users get an Add-to-Home-Screen path. UX-audit round 3 caught that this file had been 404'ing.
- `src/app/sitemap.ts` is served at `/sitemap.xml`. Auto-generated entries for `/`, `/scan`, `/demo`, `/pricing`, `/recipes`, `/login` × 4 locales with `hreflang` alternates pointing across all 4. Tells search engines that `/th/scan` and `/en/scan` are translations of the same page, not duplicate-content competitors.

Auth-gated routes (`/dashboard`, `/chat`, `/admin/*`) are deliberately excluded from the sitemap — indexing them would point search users at a redirect-to-login experience.

### Playwright e2e suite (`frontend/tests/e2e/`)

UX-audit round 6 introduced a real-browser test layer on top of the Vitest unit suite. Six spec files, 97 cases (as of Round 12), run via `npm run test:e2e` (opt-in — needs network + Chromium browser, ~1.1 min full suite).

| File | Pin |
|---|---|
| `smoke.spec.ts` | Every architectural fix this session has shipped: homepage renders × 4 locales, favicon + apple-touch-icon resolve, og:image absolute URL, locale-aware 404 with native headlines, sitemap.xml well-formed, security headers (X-Frame, Referrer-Policy), `Cache-Control: no-store` on every API route, `/api/health.deployment.shaShort` shape, zod 400 on `/api/auth/login`, scan page hydrates |
| `ui-ux.spec.ts` | DOM-only surfaces: locale-switcher round-trip, nav links resolve, `<img>` alt-text after hydration, zero broken images, manifest icons all serve 200, empty login submit doesn't navigate to `/dashboard`, robots.txt reachable, canonical/hreflang present |
| `deep-probes.spec.ts` | Per-locale 404 security headers, full hreflang graph (`th/en/de/da/x-default`), titles + meta description sizes, viewport meta, autocomplete on form inputs, exactly one `<h1>` per page, lang on sub-pages, static asset payloads (`favicon.svg < 4KB`, `manifest < 1KB`), sequential voucher probes engage rate-limit |
| `a11y.spec.ts` | Tab focus reaches interactive elements, icon-only buttons have accessible names, focus indicators visible, every input has a label or aria-label, lang on sub-pages, color-scheme declared |
| `responsive-perf.spec.ts` | Homepage renders without horizontal overflow at 414/768/1280, scan page upload affordance visible at every viewport, `/th` HTML response under 100 KB, manifest under 1 KB, favicon under 4 KB, LCP candidate (Shinny avatar) preloaded as image, no non-whitelisted external scripts |
| `user-journey.spec.ts` | Round 12 — the full real-user walkthrough: landing + locale switch (`/th` → `/en`, hreflang graph), scan flow (file set on the real `<input type=file>` → rendered Analyze CTA → terminal UI state, 180s cold-cascade budget), registration round-trip (live `voucher_required` contract + a sentinel that fails if the Next.js client error boundary engages), recipes/chat/dashboard hard-loads (own UI or clean auth-redirect, no fatal console errors) |

Config (`playwright.config.ts`): `baseURL` defaults to production. Mobile viewport (414×896, iPhone 11 Pro). Thai locale via `Accept-Language`. `ignoreHTTPSErrors: true` for sandbox containers that lack the public CA bundle.

The e2e suite caught **10 real bugs** unit tests never could over 10 iterations of the audit loop (PRs #41–#44): per-page hreflang, autocomplete on login inputs, Cache-Control on 429s, icon-only-button accessible names, 6 label/input associations, color-scheme, CF Insights script source.

### Fresh-user audit loop (Round 7, May 2026, PRs #46–#53)

A third testing lens, complementary to unit and e2e: a human/AI walks through the product with zero context and surfaces editorial / IA / honesty issues no automated probe catches. Round 7 ran 9 iterations and shipped 9 distinct fixes in 8 PRs (one PR bundled two iterations).

Bugs caught and shipped:

| Iter | Fix | PR |
|------|-----|----|
| 1 | Register default + free-tier reassurance + scan privacy note | #46 |
| 2 | Canonical primary CTA across all pages ("Start your scan") | #47 |
| 3 | Persistent `<SiteHeader/>` on every page (replaces 5 "Back to home" stubs) | #48 |
| 4 | Shinny-voiced empty state on `/recipes` (was bare "coming soon") | #48 |
| 5 | Expandable "8-dimension health score" disclosure on `/pricing` | #49 |
| 6 | Disabled + badged "Soon" treatment for Google/LINE social buttons | #50 |
| 7 | Removed duplicate promo input from login page | #51 |
| 8 | Preload `shinny_avatar.png` to fix late-pop on hero pill | #52 |
| 9 | Cited the source of the "Up to 70%" spike-reduction claim | #53 |

Round 7 pattern → unit + e2e + fresh-user audit form the three-leg stool. See `docs/GUIDELINE.md` → "The fresh-user audit lens" for the practical recipe.

### Live-deploy + authed-surface audit (Round 8, May 2026, PRs #56–#61)

Round 7 was a static reading; Round 8 ran the app for real — Playwright vs the live deploy, a real-photo scan end-to-end, and the authenticated surfaces driven with a session cookie. Two important patterns:

1. **Auth-gate redirect race.** The client auth store has no Zustand persist (auth lives in HttpOnly cookies), so `isAuthenticated` starts `false` on every fresh load. Any page that redirects on `!isAuthenticated` *before* `initAuth()` resolves will bounce logged-in users. `/dashboard` masked it (the `/login` bounce landed back on dashboard); `/chat` was rendered **unreachable** on hard-load (`/chat → /login → /dashboard`). Fix: the store now exposes **`authChecked`** (false until the probe resolves); gated pages redirect only on `authChecked && !isAuthenticated`, and self-probe with `initAuth()` on mount rather than relying on a `/login` detour. Locked by `tests/auth-store.test.ts`.

2. **`/api/auth/me` is a probe, not a gate.** It returns `200 { authenticated:false, user:null }` for anonymous callers (was 401). `SiteHeader` calls it on every page mount, so a 401 logged a console error on every anonymous load. `initAuth()` keys off `data.user`, not the status code.

Also: the homepage footer + `/api/health` version now derive from `package.json` via `NEXT_PUBLIC_APP_VERSION` (next.config.js) — no more hand-edited version literals that drift.

### Unwired-element sweep (Round 9, June 2026, PRs #63–#65)

Static audit (`export → import callers`, `t-key → source references`, `tier-flag → consumer queries`, `model → endpoint usage`) found a cluster of dead code shipped across earlier rounds:
- **Frontend**: `GradientButton`, `GlassCard` (whole `ui/` dir, referenced a stale brand palette); `cn()` helper + `clsx` + `tailwind-merge` deps; `isFeatureAvailable` (×2), `canScan`, `canAskAI` (server enforces quotas, not these); 25 orphan i18n keys × 4 locales.
- **Backend**: `FavoriteRecipe`, `DailyTip` SQLAlchemy models (no endpoint queries them); `requirements.txt` pinned `python-cors==1.0.0` (package doesn't exist on PyPI → `pip install` failed); passlib 1.7.4 vs bcrypt 4.x incompat broke 3/129 tests on fresh install.

Aspirational placeholders deliberately KEPT (~1KB across 4 locales): `mascot.{encourage,celebrate,walking,upf_alert}`, `profile.*`, `gamification.achievements.*`, `recipes.dietary.*`, `learn.quiz` — all map to documented roadmap features; removing now means re-translating later.

### Mobile + perf hygiene (Round 10, June 2026, PRs #67–#68)

Drove the real UI (not just `/api/analyze` probes) across 3 mobile widths × 5 pages.
- Global avatar preload removed: was firing on every page but only homepage uses the base `shinny_avatar.png` (other pages use `_explaining/_celebrating/_confused/_analyzing` variants). Browser logged "preloaded but not used" on 4 of 5 pages.
- `/pricing` "Apply Code" button overflowed iPhone-SE viewport by ~24px — classic flex `min-width:auto` trap with a `whitespace-nowrap` button. Fix: `min-w-0` on the input. New permanent 375px overflow guard in `responsive-perf.spec.ts`.

### Comprehensive depth (Round 11, June 2026, PRs #70–#74)

Hit 7 audit angles; 5 PRs shipped:
- **CI workflow** (`.github/workflows/ci.yml`) — first GitHub Actions on the repo (frontend `check:all` + backend `pytest`). See `Backend (FastAPI) — strategic role clarified` below.
- **Web Vitals**: home FCP **2272ms → 620ms (−73%)**, scan FCP **2100ms → 372ms (−82%)** by removing `Prompt` + `Plus Jakarta Sans` Google fonts (loaded but never applied — no `font-display` / `font-thai` Tailwind class anywhere).
- **a11y `<main>` landmark** on all 6 public pages (was 1 of 6) + aria-labels for previously-unlabeled inputs on `/scan` and `/pricing`. 6 new permanent guards in `a11y.spec.ts`.
- **Schema audit**: `users.language` was hardcoded `'th'` on register regardless of locale (latent — currently unread, but wrong). Now persists actual locale; back-compat fallback to `'th'`. Two truly dead columns (`healthInfo`, `usageTracking`) flagged in KNOWN_ISSUES for a future D1 migration.
- 2 angles found NOTHING actionable (good news): WebKit/Safari iPhone 13 smoke (6/6 clean), interaction-time console (0 notable messages across 7 user-action stages).

### Full user-journey e2e (Round 12, June 2026, PRs #76–#78)

A fifth testing lens: one Playwright spec (`tests/e2e/user-journey.spec.ts`) that walks production end-to-end the way a real user would — through the rendered UI, not API probes. Four independent phases (landing + locale switch, scan upload → analyze → terminal state, registration round-trip, recipes/chat/dashboard browse); a flake in one never masks the others.

**Design decisions worth knowing before extending it:**

1. **Terminal-state assertion, not happy-path assertion.** The scan phase accepts THREE valid endings: a rendered meal result, the not-food rejection card, or the handled-error card with a retry CTA. What it forbids is a stuck spinner or a crash. This makes the test robust to model nondeterminism (a noise PNG may classify as not-food or time out on a cold cascade) while still catching the bug class that matters — flows that dead-end the user. One run exercised the cold analyze-timeout path for real and confirmed the friendly Thai error card renders.
2. **Generated fixture, no binary in the repo.** The upload image is a 256×256 PNG built in-memory (IHDR/IDAT/IEND + table-driven CRC-32). It's filled with LCG noise deliberately: a solid-colour tile deflates to ~250 bytes and gets **silently dropped** by `useScanUpload.ts → MIN_FILE_SIZE` (500 bytes) — no error card, no CTA, nothing for a test to find. Incompressible noise clears the floor.
3. **Drive the hidden input, not the styled button.** The visible Upload button programmatically clicks `<input type="file" multiple>`. The spec calls `setInputFiles` on the input directly — same wire-level result, fewer DOM-shape assumptions.
4. **Duplicate-text button trap.** On `/login` the register *tab* and the register *submit* carry the same label ("สมัครสมาชิก"), so `getByRole('button', { name }) + .first()` re-clicks the already-active tab and the form never submits. Pin to `button[type="submit"]`.
5. **Shared benign-console filter** (`isBenignConsoleError()`): the anonymous `/api/auth/me` probe noise (fixed PR #56, kept as safety net) and the Next.js RSC-prefetch fallback ("Failed to fetch RSC payload … Falling back to browser navigation" — the router recovers; surfaced only under full-suite parallel load, #78). The scan phase additionally filters the logger's own `console.error` instrumentation for *handled* cascade timeouts — that line is telemetry about an error the UI absorbed, not a user-facing failure.
6. **Crash sentinel in phase 3.** During spec development the register submit twice produced the Next.js error boundary ("Application error: a client-side exception has occurred") — server contract correct (400 `voucher_required`), client handling crashed. It stopped reproducing, but the phase races the crash heading against the inline-error/success terminals and **fails with a regression-friendly message** if the boundary ever engages again. See `KNOWN_ISSUES.md → Intermittent client error boundary on register response`.
7. **Side-effect budget** (stated in the spec header): 1 vision call per run (noise PNG → `not_food` branch, input-token cost only) + 1 registration attempt that voucher gating rejects (no DB row, nothing to clean up).

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

### Deployment-freshness verification via `/api/health`

`/api/health` reads `CF_PAGES_COMMIT_SHA`, `CF_PAGES_BRANCH`, and `CF_PAGES_URL` from the Cloudflare Pages build environment and exposes them as a `deployment` block in the JSON response:

```json
{
  "status": "healthy",
  "deployment": {
    "sha": "9e74084adfa7516f4502401cdfbe8775165f215f",
    "shaShort": "9e74084",
    "branch": "main",
    "pagesUrl": "https://nutri-vision-ai.pages.dev"
  },
  ...
}
```

This closes the bug-hunt May 2026 gap where the only way to verify "is the current deploy actually the commit I just merged?" was through behavioural inference (does `modelUsed` reflect the post-PR shape? does the rate-limit suddenly engage?). Behavioural inference is slow and error-prone — it's how PRs #21, #22, and #23 each shipped feeling complete while leaving an unfixed user-facing bug, because the validation matrix passed against a stale deploy that hadn't rolled over yet.

The `ITERATION_PROCESS.md §5` post-merge verification now starts with this single curl: if `deployment.shaShort` doesn't match the merge commit within ~5 min, the §3 checks would be validating old code and the conclusion ("fix didn't work") would be wrong. Compare against `git rev-parse --short main` before doing anything else.

In local dev (no `CF_PAGES_*` env vars), all four `deployment` fields are `null` — that's the correct sentinel for "not running on Pages", not an error.

### Backend (FastAPI) — strategic role clarified (Round 11)

**The backend is the canonical reference implementation, not legacy dead code.** It deliberately runs alongside the production Cloudflare Edge stack and serves a specific purpose:

- **`backend/app/services/nutrition_scorer.py`** is the 536-line deterministic scoring algorithm — the "proprietary scoring algorithm" referenced earlier in this doc. The production `/api/analyze` route currently delegates scoring to Gemini's JSON output (faster, but non-deterministic and harder to audit). The Python implementation is the *spec* against which any future port to TypeScript should be validated.
- **`backend/app/services/gemini_service.py`** is the Gemini integration with the same prompt + parsing the edge uses. Useful for offline prompt-engineering experiments without touching prod.
- 8 SQLAlchemy models (User, Recipe, Ingredient, FoodScan, MealPlan, ChatMessage, SubscriptionTier, ActivityLevel + enums) — schema reference for the entities. The Cloudflare D1 schema in `frontend/src/db/schema.ts` is the production source of truth; these mirror it in SQLAlchemy form for the parallel dev environment.

**Round 11 changes:**
- `.github/workflows/ci.yml` runs `pytest -q` on every PR. Before this, the backend went 6 weeks (Round 8 → Round 9) without verification — long enough that Round 9 found 3 latent bcrypt failures + a phantom `python-cors==1.0.0` in `requirements.txt` that broke `pip install` outright. CI now catches that class of rot at PR time.
- Round 9 (PR #64) removed 2 truly unwired models (`FavoriteRecipe`, `DailyTip`) for features that don't exist. What's left is the reference impl, not aspirational scaffolding.

**Architectural follow-up worth considering** (NOT done in Round 11):
- Port `NutritionScorer.calculate_all_scores` to TypeScript and call it from the edge route after Gemini's identify-only response. Would replace Gemini-generated scores with the deterministic algorithm — same input always produces same scores, easier to A/B against, no AI cost per dimension. Bigger PR than this round's scope.

### Backend (FastAPI) — original notes

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
