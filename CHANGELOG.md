# Changelog

All notable changes to the NutriVision AI project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Round 17 (simplify the core loop) — capture → suggest → ask on chat

Product direction: *"the app should be not complex — just capture photos and then suggest users; if any question, just ask on chat further."* This round removes the upfront friction on the scan flow and adds the chat hand-off that was missing.

| Change | Detail |
|---|---|
| **Lead with the photo, not a mode choice** | The scan page no longer opens with the 3-button Meal/Menu/Drink picker above the upload area. Meal is pre-selected and the upload area leads, so a first-time user can just snap a photo. Menu/Drink move behind an optional **"Scanning a menu or a drink instead?"** toggle (`scan.more_options`). No capability removed — only the *required choice* before capture. |
| **"Ask Shinny about this" on every result** | Each suggestion now carries a primary `💬 Ask Shinny about this` CTA (beside the existing "Scan Another", which becomes secondary) on both the desktop meal sidebar and the mobile result block (covers meal/menu/drink). |
| **Scan → chat context hand-off** | New `lib/chat-seed.ts` stashes a pre-written question (`scan.ask_seed` with the identified dish name, or `scan.ask_seed_generic`) in `localStorage`; the chat page reads it **read-once** on mount and pre-fills the composer (never auto-sends, never clobbers an in-progress draft). localStorage (not a query param) so the seed survives the login-gate redirect for logged-out users. |

**Decisions taken** (the in-product picker for these didn't resolve, so safe/reversible defaults were chosen and are easy to revisit): kept the existing tested meal pipeline rather than building AI mode auto-detection; kept the chat **login gate** (opening chat to anonymous users has real AI-cost/abuse exposure — a deliberate, separate decision). The "Ask Shinny" CTA only renders on an actual suggestion (`hasResult`), not on the not-food/error cards — you ask about a result, not a rejection.

4 new i18n keys × 4 locales (`ask_shinny`, `ask_seed`, `ask_seed_generic`, `more_options`); locale key count 216 → **233**. Type-check + i18n + **193/193** unit green; `next build` clean. The live scan→chat round-trip against the real AI is covered by the post-deploy `user-journey` e2e gate (the noise-PNG fixture routes to the not-food branch, so the CTA itself is a manual/post-deploy check with a real food photo).

**Follow-up hardening** (same round, adversarial self-review of the above): the first cut of the chat hand-off had three interacting bugs on the *logged-out* path that would have silently dropped the follow-up question — all fixed:
- **Seed consumed on the throwaway mount.** `takeChatSeed()` ran on chat mount before the auth redirect fired, so a logged-out visit cleared the seed during the brief pre-redirect render and it was gone by the time the user came back. Now gated on `authChecked && isAuthenticated`, so it's consumed exactly once — on the mount that actually renders the composer.
- **No return path through login.** Chat's unauth redirect went to `/login?mode=login` with no way back; login always bounced to `/dashboard`. Chat now passes `next=/{locale}/chat`, and login honours a `?next=` return path (validated same-origin absolute path only — rejects `//host`, `/\host`, and scheme URLs, so no open redirect). A logged-out "Ask Shinny" now round-trips: scan → chat → login → back to chat with the question pre-filled.
- **Desktop Menu/Drink dead-end.** The result-action block (Ask Shinny + Scan Another) lived only in the meal branch's desktop sidebar; the shared bottom block was `lg:hidden`. On a large screen a Menu or Drink scan had *no* action buttons at all. The bottom block is now `lg:hidden` only for meal results (which have the sidebar), and visible on all viewports for menu/drink.

Also: the generic seed subject is neutral ("this") instead of "my meal", since it fires for menu/drink scans where "meal" was wrong.

**Scan page decluttered further:** the "scans remaining" quota counter no longer shows on every visit. It appears only as a gentle nudge when a free-tier user is genuinely low (≤3 left); premium/family never see it (a permanent "∞" was just noise). Keeps the default page focused on "just take a photo".

### Round 16 (discoverability) — SEO + social + package metadata rework (v2.1.14)

The product was indexed under brand-led copy ("Smart Food Sequencing") while real users search by **problem and tool** ("AI food scanner", "blood sugar", "what to eat first"). This round rewrote the discovery surface — search metadata, social cards, repo/package topic tags, and the README hero — to match search intent. Pure metadata/docs; no runtime behaviour, no test-posture change.

| Surface | Before | After |
|---|---|---|
| `layout.tsx` `<title>` | "Shinny Guide — Smart Food Sequencing for Better Health" | "Shinny Guide: AI Food Scanner & Sequencing App for Blood Sugar Management" — keyword-front-loaded |
| `layout.tsx` description | brand/concept-led | intent-led: "AI food scanner that tells you what to eat first… 8-dimension health scoring and personalized meal plans" |
| `layout.tsx` keywords | 7 loose phrases | 12 hyphenated topic tags (`ai-food-recognition`, `blood-sugar`, `food-sequencing`, `nutrition-scoring`, …) |
| `layout.tsx` openGraph | generic | action-led social copy ("Snap a photo of your meal and let AI tell you the perfect eating sequence…") |
| `package.json` description + keywords | npm-generic | search-rich description + 20 topic/stack tags (incl. `cloudflare-workers`, `drizzle-orm`, `nextjs`, `typescript`, `zustand`, `llama`, `progressive-web-app`, `i18n`) for repo + npm discovery |
| `package.json` homepage | `…/Nutri-Vision-AI#readme` (GitHub anchor) | `https://nutri-vision-ai.pages.dev` (the live product) |
| `README.md` / `README-TH.md` | brand H1, no hero image | keyword-rich H1, hero screenshot, AI-food-scanner / blood-sugar-management positioning, AI nutrition coach + 1000+ recipes |

**Method recorded** in `docs/GUIDELINE.md → The discoverability / SEO-metadata lens`: audit title/description/keywords against *search intent* (what a stranger types), not brand vocabulary; front-load the primary keyword in `<title>`; keep `metadataBase`-absolute `og:image` (already shipped round 4) so social cards render; point `homepage` at the live deploy, not a repo anchor. The existing e2e SEO/PWA + share-metadata pins (`smoke`, `deep-probes`) continue to guard the structural invariants (hreflang graph, og:image absolute URL, unique per-locale `<title>`, meta-description length bounds).

Bumped to **v2.1.14**.

### Round 15 (observability) — /admin/scans feed + handled-timeout console hygiene (PR #82)

Closed two tracked KNOWN_ISSUES items: the `/admin/scans` next-phase admin surface (item 0b) and the handled-timeout "console error" half of the benign-noise item (item 5, pattern 2).

| # | Item | What shipped |
|---|---|---|
| 1 | `/admin/scans` observability (KNOWN_ISSUES 0b) | New `frontend/src/app/[locale]/admin/scans/page.tsx` — a **metadata-only** scan feed. Design decision: photos were never stored (`/api/analyze` writes `imageUrl: null`), so the page shows truncated userIds + item counts + `errorClass`, **no emails, no food-name lists, no images** — observability without a PII-exposure design fight. Filterable by `errorClass`. |
| 2 | `errorClass` gets writers | `/api/analyze` now persists a failure row at the 503 funnel tagged `timeout` / `parse_error` / `provider_error` / `binding_missing`. The previously-dead `errorClass` column finally has writers, so AI-pipeline regressions are visible in `/admin/scans` **without** needing Cloudflare log-stream access. |
| 3 | Handled-timeout console hygiene (KNOWN_ISSUES 5, pattern 2) | `lib/logger.ts`: handled scan timeouts now emit via `console.warn`, not `console.error`. The scan UI already absorbs them (renders the retry card) — `warn` keeps the telemetry without tripping "red console error" guards or crying wolf. The e2e benign-noise filter entry stays for old cached bundles but should no longer fire on fresh deploys. |

**Test posture:** unchanged from Round 14 — frontend unit **193/193**, e2e **99 cases**, backend **129/129**. `/admin/scans` is gated by the existing `isAdmin` server check (non-admins redirect to `/login`), so it inherits the admin-auth test coverage.

### UX-audit Round 14 (backlog burn-down) — security, resilience, schema, a11y (PR #81)

Worked the tracked follow-ups from KNOWN_ISSUES that were achievable without external credentials or product decisions:

| # | Item | What shipped |
|---|---|---|
| 1 | Admin throttling (KNOWN_ISSUES 0b) | All four `/api/admin/*` mutation routes rate-limit at 30/min per IP; route-wiring suite pins all **ten** throttled routes |
| 2 | Chat Gemini cascade | `callGemini` only ever called `GEMINI_VISION_MODELS[0]` despite the documented walk — the exact single-hardcoded-id outage mode the cascade exists to prevent. Now walks the list (skip on 404/429, fail-fast on 5xx, per-model timeout split) and reports the answering model in `modelUsed`. The old test pin asserted the `[0]` shortcut; replaced with cascade-walk pins + 4 behavioural tests |
| 3 | CSP (long-deferred round-3 follow-up) | `Content-Security-Policy-Report-Only` on every HTML response: origin allowlist (self + Cloudflare Insights), `data:`/`blob:` images, `frame-ancestors 'none'`. `'unsafe-inline'` remains for script/style pending nonce work. Preview e2e run doubled as the violation scan — zero violations across all 99 cases |
| 4 | Duplicate middleware | Removed the root `middleware.ts` that duplicated `src/middleware.ts` with a hardcoded locale list (drift trap). Build + full locale-routing e2e verified |
| 5 | FK indexes (KNOWN_ISSUES follow-up #4) | Migration `0004_fk_user_id_indexes.sql`: secondary indexes on `sessions/code_redemptions/food_scans/chat_messages.user_id` + matching Drizzle `index()` definitions. **Remote D1 apply still pending** — this environment has no CF credentials; merger runs `npx wrangler d1 migrations apply eatinorder-db --remote` |
| 6 | Demo a11y | Emoji-only step-navigator buttons get localized `aria-label` + `aria-pressed` |

**Test posture:** frontend unit **193/193** (+8), e2e 99 cases (98 green against the branch preview — the one "failure" is the spec correctly asserting `deployment.branch === 'main'`, which a branch preview can't satisfy), backend 129/129, ESLint 0 errors.


### UX-audit Round 13 (login intent, error localization, CI resurrection) — review + fix pass (PR #80)

Continuation round on the user's standing brief ("review deeply, anything to improve? … repeat iterations till no error and good feedback"). Baseline before changes: 97/97 e2e green against production, 171/171 unit, type-check + i18n clean. The round hunted what green suites can't see — and found that one of the suites itself was fiction.

**Headline finding — CI had never passed.** Every run of `ci.yml`, including on `main`, failed since the workflow shipped in Round 11. With no branch protection enforcing the check, the red lights ran unnoticed for a month while `ITERATION_PROCESS.md §2` listed CI as a must-pass gate. Two independent infra bugs:

1. Frontend job pointed `cache-dependency-path` (and `npm ci`) at `frontend/package-lock.json` — a file that doesn't exist; npm workspaces hoists the only lockfile to the repo root. setup-node failed in ~10 s on every run.
2. Backend `requirements.txt` pinned `pydantic==2.5.0` next to `pydantic-settings>=2.3.0` — every release in that range needs pydantic≥2.7.0, so pip's resolver correctly refused (`ResolutionImpossible`).

Fixed both (install at repo root; `pydantic>=2.7.0,<3`, validated in a clean venv — 129/129 backend tests pass). PR #80 carries the **first fully green CI run in the repo's history**. Process lesson recorded in `ITERATION_PROCESS.md`: a gate that nobody watches is not a gate — "CI added" is only true once a run has been seen green.

**User-facing fixes:**

| # | Finding | Fix |
|---|---|---|
| 1 | Header CTA labelled "Log in" (and auth-gate redirects from /dashboard, /chat) landed on the **Register** tab — "Create your account" for users who clicked "Log in" | `/login?mode=login` honoured from intent-bearing entry points; register default unchanged for fresh-visitor CTAs. Pinned both ways by 2 new e2e cases |
| 2 | `/api/analyze` (the most expensive route) and `/api/promo/redeem` had **no per-IP rate limit** — and the KNOWN_ISSUES entry tracking this was stale in the opposite direction | Wired per the documented plan (analyze 20/min, promo/redeem 5/min); new `rateLimit route wiring` test suite walks all six route sources so the throttled list is a CI-pinned invariant, not a doc claim |
| 3 | Server auth errors rendered raw English in all locales — a Thai pilot user registering without a voucher saw "A voucher code is required to register during the pilot." verbatim | auth-store derives a stable `errorCode` (server `reason` preferred — login 401/register 409 now carry one — status-class fallback); login page maps codes to new `auth.server_errors.*` strings (th/en/de/da, Shinny voice). `res.json()` hardened on error paths — the suspected crash class behind KNOWN_ISSUES 2a |
| 4 | Scan-flow rejections hardcoded English: upload errors ("Unsupported format: …"), quota/overload/throttle failures (403/503/429), history labels ("Menu Scan", "+ N more") | All localized in 4 locales (`scan.upload_*`, `scan.error_quota/overloaded/rate_limited`, `scan.history_*`); history labels resolved at write time |
| 5 | Dashboard "Recent Scans" rendered **fabricated mock entries** (Pad Thai / Som Tam / Green Curry, fake scores, "Today") whenever the server counter was > 0 — while real device-local history sat unused | Renders up to 3 real `lib/scan-history` entries (thumbnail, name, localized score label, locale-formatted date); honest empty state otherwise. Upgrade-CTA subtitle de-hardcoded (price now read from `TIER_PRICING`); logout button localized |
| 6 | Auth card's brand icon rendered half-clipped behind the floating header on every mobile load | Top padding clears the absolutely-positioned header before vertical centering |
| 7 | Collage stitcher single-survivor path returned `validImages[0]` — the broken image, whenever the first photo was the one that failed to load | Returns the survivor's source by index |
| 8 | Minor: `pricing.score_breakdown.free_badge` untranslated in th/de/da; chat UI could surface raw English server diagnostics; dead identical-branch ternary in pricing | All fixed |

**Final test posture this round:**
- Frontend unit: **185/185** ✓ (+14: deriveErrorCode rules, errorCode store lifecycle, rate-limit route wiring)
- Frontend e2e: **99 cases** (+2: `?mode=login` honoured / register default preserved) — full suite run against production post-merge
- Backend unit: 129/129 ✓ — now actually verified in CI on every PR, for the first time


### UX-audit Round 12 (full user-journey e2e) — automated real-user walkthrough against production

User asked: "can we test as a real user for the whole user journey." This round added a fifth testing lens: a single Playwright spec (`frontend/tests/e2e/user-journey.spec.ts`, PRs #76–#78) that drives the production app the way a real user would — through the rendered UI, not API probes — in four independent phases:

| Phase | What it drives | Terminal assertion |
|---|---|---|
| 1. Landing + locale switch | `/th` → `/en` navigation, hreflang graph (4 locales + x-default) | `<html lang>` flips, zero fatal console errors |
| 2. Scan flow | Sets a generated 256×256 PNG on the real `<input type=file>`, clicks the rendered "Analyze Now" CTA, waits for the Workers AI → Gemini cascade | Meal result, not-food card, **or** handled-error card visible — never a stuck spinner (own 180s budget for cold-start cascades) |
| 3. Auth round-trip | Fills + submits the real register form with a fresh unique email, no voucher | Live `voucher_required` 400 contract pinned; **fails if the Next.js client error boundary engages** (crash observed twice during development) |
| 4. Recipes / chat / dashboard | Hard-loads each route | Own UI or clean auth-redirect, zero fatal console errors |

**What building the spec itself surfaced** (the journey lens earns its seat):
- **Intermittent client-side crash after `/api/auth/register` response** — Next.js error boundary ("Application error: a client-side exception has occurred") engaged twice during spec development, then stopped reproducing. The server contract was correct each time (400 `voucher_required`); the client crashed handling it. Pinned by a sentinel assertion in phase 3; tracked in `KNOWN_ISSUES.md`.
- **Silent sub-500-byte file rejection** — `useScanUpload.ts` drops files under `MIN_FILE_SIZE` with only an `uploadError` state, no analyze CTA ever appears. Correct behaviour, but invisible to a naive test (and to a user with a tiny image). The fixture is generated with LCG noise specifically to defeat deflate and clear the floor.
- **Duplicate-text button trap on `/login`** — the register *tab* and register *submit* share the same Thai label ("สมัครสมาชิก"), so `getByRole('button', { name })` + `.first()` re-clicks the tab. The spec pins to `button[type=submit]`.
- **Benign console-noise classes documented**: Next.js RSC-prefetch fallback under parallel load ("Failed to fetch RSC payload … Falling back to browser navigation" — router recovers), the scan logger's own `console.error` instrumentation for handled cascade timeouts, and cold-start 404 resource retries. Shared `isBenignConsoleError()` filter with rationale per pattern (#78 de-flaked phases 1–2 under full-suite parallel load after standalone runs were green).
- **Cold-path validation**: one run exercised the full analyze-timeout path — the UI correctly rendered the friendly Thai handled-error card ("การวิเคราะห์ใช้เวลานานเกินไป") with a retry CTA rather than crashing.

**Side-effect budget per run** (documented in the spec header): 1 vision-model call (the noise PNG routes to the `not_food` branch — input-token cost only) + 1 registration attempt rejected by voucher gating (no DB row, no cleanup).

**Final test posture this round:**
- Frontend unit: 171/171 ✓
- Frontend e2e: **97/97** ✓ (+4 journey phases; full suite verified twice, ~1.1 min per run)
- Backend unit: 129/129 ✓

### UX-audit Round 11 (comprehensive depth) — CI + Web Vitals + a11y + schema audit

User asked to "try as much as iterations to validate and improve comprehensively." Hit 7 audit angles this round, shipped 5 PRs that turned up real wins.

| # | Audit angle | Finding | PR |
|---|---|---|---|
| 1 | **CI workflow** | No GitHub Actions on the repo; backend went 6 weeks unverified (Round 9 found 3 latent failures). Resolved the "what is the backend for?" ambiguity I'd punted for two rounds: it's the canonical reference impl (`nutrition_scorer.py` is the 536-line algorithmic spec) — keep + add CI. | #70 |
| 2 | **Web Vitals** | Homepage FCP at **2272ms** ⚠ and `/scan` at 2100ms ⚠ (threshold 1800ms). Root cause: `Prompt` (5 weights) + `Plus Jakarta Sans` Google fonts loaded on every page with **zero consumers** — no `font-display` / `font-thai` Tailwind class anywhere, no CSS-variable usage. Removed both. After: home FCP **620ms** (−73%), scan FCP **372ms** (−82%); total page bytes down ~110kB. | #71 |
| 3 | **Deep a11y** | 5 of 6 public pages had no `<main>` landmark; scan/pricing had unlabeled inputs. WCAG 2.1 AA failure — screen-reader users had no "skip past nav to content" target on every page. Wrapped page content in `<main>`, added aria-label to hidden file inputs + the pricing promo input. New permanent suite guards (15/15 a11y tests pass). | #72 |
| 4 | **WebKit/Safari** | All 6 pages render cleanly on WebKit/iPhone 13 — title, h1, zero console errors. **No findings.** | — |
| 5 | **Interaction-time console** | Zero notable messages across 7 user-action stages (locale switch, nav, type credentials, switch tab, expand disclosure). **No findings.** | — |
| 6 | **i18n quality** | 35 heuristic flags reviewed; all defensible (brand terms, marketing tier names, borrowed English in DE/DA). **No findings.** | — |
| 7 | **Schema audit** | `users.language` was being hardcoded to `'th'` on register regardless of registration locale — latent (currently unread) but wrong data. Also flagged `users.healthInfo` + `users.usageTracking` as truly dead columns (no readers, no writers); documented in KNOWN_ISSUES for a future migration. | #73 |

**Final test posture this round:**
- Frontend unit: 171/171 ✓ (+2)
- Frontend e2e: 93/93 ✓ (+6 — the new a11y main-landmark guards)
- Backend unit: 129/129 ✓
- CI runs on every PR going forward
- Web Vitals: all 6 public pages now under "good" threshold for FCP

Released as **v2.1.13**.

### UX-audit Round 10 (mobile + perf hygiene) — driving the rendered UI

After Round 9's static dead-code sweep, this round drove the actual rendered UI: a real-photo scan walkthrough through the upload affordance (not just probing `/api/analyze`), authed surfaces with a session cookie, and a 3×5 mobile-viewport matrix.

| Finding | Where | PR |
|---|---|---|
| Global avatar preload fired on every page in the locale layout, but only the homepage uses the base `shinny_avatar.png` (other pages use `_explaining/_celebrating/_confused/_analyzing` variants) → browser logged "preloaded but not used" on 4 of 5 pages + wasted ~40KB per page | `app/[locale]/layout.tsx` | #67 |
| `/pricing` "Apply Code" button overflowed iPhone-SE viewport by ~24px — the classic flex `min-width: auto` trap when an `<input>` sits next to a `whitespace-nowrap` button | `pricing/page.tsx` | #68 |
| Stale e2e assertion that *required* the avatar preload (from before #67); needed inverting + correcting | `responsive-perf.spec.ts` | #68 + this PR |

**Found but NOT a code bug:** during the UI scan walkthrough, `/api/analyze` returned the **Cloudflare Llama 3.2 11B fallback** result (score 50, "Shinny isn't sure!", zero-filled nutrition) instead of the higher-quality Gemini response — because Google Gemini was returning *503 "This model is currently experiencing high demand"* during the audit. External Google outage, not our code. The fallback chain *worked* (user gets *some* result rather than 503). Current UI copy ("AI analysis failed" on full exhaustion) is correct, just bland; leaving as-is.

**Other audit observations (not bugs):**
- Zero no-op `onClick` handlers, zero `href="#"` placeholders, zero TODO/FIXME/HACK comments in the source tree.
- Only 2 `console.warn` calls — both in legitimate error catches.
- Decorative `bg-brand-*-400/20` blobs on the homepage extend past the viewport, but the outer wrapper has `overflow-hidden` → clipped, no actual scroll.
- 414px and 768px viewports show no overflow on any anonymous page.

**Final test posture this round:**
- Frontend unit: 169/169 ✓
- Frontend e2e: **87/87** ✓ (was 80; +9 new guards: 4 mobile-overflow + 4 no-preload + 1 anonymous-probe)
- Backend unit: 129/129 ✓

Released as **v2.1.12**.

### UX-audit Round 9 (unwired-element audit) — frontend + backend dead-code sweep

User asked: "no unwired function and element in frontend and backend." A static audit (export → import callers, t-key → source references, tier-flag → consumer queries, model → endpoint usage) found a cluster of dead code shipped across earlier rounds.

| Finding | Where | PR |
|---|---|---|
| `GradientButton`, `GlassCard` — 0 callers; referenced a stale brand palette (`BrandOrange/Magenta/Violet`) that doesn't match the live tokens | `src/components/ui/` (whole dir) | #63 |
| `cn()` helper + `clsx` + `tailwind-merge` deps — only used by the two deleted components | `src/lib/utils.ts`, `package.json` | #63 |
| `isFeatureAvailable` (twice — standalone in tier-config + method on auth-store), `canScan`, `canAskAI` — all defined, zero callers (quota enforcement is server-side) | `tier-config.ts`, `auth-store.ts` | #63 |
| 25 orphan i18n keys × 4 locales (~100 strings): PR #51 leftovers, never-wired aspirational labels, superseded duplicates, pre-AI-pipeline scan stubs | `messages/{th,en,de,da}.json` | #63 |
| `FavoriteRecipe`, `DailyTip` SQLAlchemy models — defined but no endpoint queries them; back-refs on Recipe/User pointed at nothing | `backend/app/models/` | #64 |
| `requirements.txt` pinned `python-cors==1.0.0` — package doesn't exist on PyPI; `pip install` failed outright (FastAPI's `CORSMiddleware` is already used) | `backend/requirements.txt` | #65 |
| passlib 1.7.4 vs bcrypt 4.x incompatibility — `AttributeError: module 'bcrypt' has no attribute '__about__'` broke 3/129 tests on fresh install | `backend/requirements.txt` | #65 |

Deliberately **kept** (aspirational placeholders for documented roadmap features): `mascot.{encourage,celebrate,walking,upf_alert}`, `profile.*`, `gamification.achievements.*`, `recipes.dietary.*`, `learn.quiz`. They map to features in README + PROJECT_PLAN; removing them means re-translating later.

**Final test posture this round:**
- Frontend unit: 169/169 ✓
- Backend unit: **129/129** (was 126/129 — bcrypt fix gained 3) ✓
- Frontend e2e: 80/80 ✓
- 4/4 locales aligned at 216 keys each (was 240 — net -24)
- `pip install -r backend/requirements.txt` now succeeds from a clean checkout (was failing on the phantom python-cors)

Released as **v2.1.11**.

### UX-audit Round 8 (end-user + professional-tester loop) — live-deploy verification

Round 7 was a static fresh-user reading of the app. Round 8 ran the app for real: drove Playwright against the **live deploy**, completed a real-photo scan end-to-end, and audited the authenticated surfaces (dashboard, chat) with a session cookie — surfaces the anonymous walkthrough couldn't reach. This caught one live regression that had been shipped for several PRs, plus latent bugs.

| Bug | Severity | How caught | PR |
|-----|----------|-----------|----|
| Anonymous visitors hit a `401` console error on **every** page (`SiteHeader` → `initAuth` → `/api/auth/me`, introduced by the Round-7 iter-3 header extraction) | Medium | Playwright e2e vs live deploy (4 failures) | #56 |
| Homepage hero CTA said "Start Scanning" while dashboard/demo said "Start your scan" in EN/DE/DA — iter-2's canonicalization was left half-done | Low–Med | Fresh-user walkthrough | #57 |
| Footer hardcoded "Version 2.1.7" vs `package.json` 2.1.9; `/api/health` reported "unknown" | Low | Version audit | #58 |
| Locale-aware 404's anti-dead-end CTAs **dead-ended** — bare `/scan` 404s again, bare `/` drops the locale | Medium | Internal-link audit | #59 |
| `/api/analyze` real-food probe ✓ (no bug — verified `gemini-2.5-flash` correctly IDs the dish, returns 8 dimensions + sequence) | — | AI-pipeline validation gate | — |
| Flaky live rate-limit e2e (per-instance `Map` + CF request-spreading) | — | The 80-test run itself | #60 |
| **`/chat` unreachable on hard-load/refresh/bookmark** for logged-in users — redirect race fired on the pre-probe `isAuthenticated === false`, bouncing `/chat → /login → /dashboard` | **High** (feature unreachable) | Authed walkthrough with session cookie | #61 |

**Key lesson (stated bluntly in the round's own notes):** the `401` and the chat-unreachable bugs were both shipped because earlier rounds verified with "compiles + unit-green + string looks right" rather than running the e2e suite + walking the rendered/authed app. The moment Round 8 actually ran Playwright against the deploy and drove the authed surfaces, both surfaced immediately. **Running e2e against the deploy is a hard gate, not optional** — it's already in `ITERATION_PROCESS.md`; it just wasn't being honored on the Round-7 PRs.

New regression guards: `tests/auth-store.test.ts` (5 cases pinning the `authChecked` probe lifecycle), e2e assertions for the anonymous `/api/auth/me` 200-probe contract and the in-locale 404 CTAs, and a de-flaked rate-limit probe.

### UX-audit Round 7 (fresh-user loop) — 9 iterations focused on first-impression UX

Round 6 was machine-driven (e2e probes catching machine-readable bugs: missing `htmlFor`, dropped headers, etc.). Round 7 inverted the lens: view the app as a first-time visitor with zero context — what looks broken, dishonest, or jargon-heavy? The 79-case e2e suite couldn't catch any of these because they're product/copy/IA decisions, not invariants.

| Iter | Fresh-user pain | Shipped in |
|------|------------------|-----------|
| 1 | Login defaulted to *Log in* but most landing visitors haven't registered. Homepage didn't say "free / no signup". Scan didn't promise privacy. | PR #46 |
| 2 | Three different primary CTAs across pages ("Start Scanning" / "Try Scan" / "Scan Now") read like a janky portfolio of half-finished features. | PR #47 |
| 3 | Only the homepage had a real nav. Every other page degraded to a "Back to home" link — navigation predictability evaporated. | PR #48 |
| 4 | `/recipes` was a bare "coming soon" stub with no Shinny voice and no escape route — read like a 503. | PR #48 |
| 5 | "Full 8-dimension scoring" on the Premium card is opaque jargon. Fresh users have no way to know what's measured or where the free cutoff lands. | PR #49 |
| 6 | Google/LINE social-login buttons LOOKED live but threw "coming soon" toasts on click — visual promise breaking from behaviour. | PR #50 |
| 7 | Login page had TWO code-entry inputs visible at once (voucher + promo). Fresh users had no idea which one to use. | PR #51 |
| 8 | Shinny avatar (40KB PNG) popped in late on every page that uses it — hero greeting visibly stuttered on mobile. | PR #52 |
| 9 | Headline claim "Up to 70% blood sugar spike reduction" had no source. To a skeptical first-timer, indistinguishable from marketing fabrication. | PR #53 |

**9 first-impression bugs caught by viewing the site as a fresh user that no automated suite could:**
- Login flow defaulting to the wrong tab (`mode: 'login'` → `'register'`)
- Unspoken objections: "is this free?" "do I need to sign up?" "what happens to my photo?"
- Inconsistent CTAs across pages signaling product immaturity
- Header-less secondary pages with no consistent navigation
- Stub pages with no voice and no recovery
- Jargon ("8-dimension scoring") presented without context
- Fake/dishonest affordances (clickable but non-functional buttons)
- Duplicate / competing input fields on the same screen
- Unsubstantiated headline claims without citation
- Late-loading mascot creating perceived performance issues

**Pattern that emerged**: unit tests pin code invariants, e2e tests pin rendered behaviour, but neither lens catches *editorial* problems — copy that doesn't reflect what the product actually does, IA that confuses first-timers, claims that need citation. Those need a human (or AI) walking through the product with fresh eyes and the freedom to be brutal about what's broken.

### UX-audit Round 6 (e2e loop) — 10 iterations of probe → fix → ship → verify

Introduced Playwright as a second test layer (28 e2e cases initially → 79 across 5 spec files by the end) and ran a structured iteration loop. Each iteration: write/expand the e2e suite → run against live deploy → triage findings → ship fixes → wait for deploy → re-verify. Coverage converged after 10 iterations.

| Iter | Probe | Real bugs caught | Fixed in |
|------|-------|-----------------:|----------|
| 1 | First Playwright run | Sandbox cert chain rejected | Config-only (`ignoreHTTPSErrors`) |
| 2 | Smoke re-run | 0 — 17/17 green | — |
| 3 | UI/UX suite | 1 — no hreflang alternates on any locale page | PR #41 |
| 4 | Post-deploy verify | 0 | — |
| 5 | Deep probes | 3 — email + password missing `autoComplete`; 429 responses missing `Cache-Control` | PR #42 |
| 6 | Post-deploy verify | 0 | — |
| 7 | A11y probes | 4 — hamburger + eye toggle missing `aria-label`; 5 inputs missing `htmlFor`/`id` linkage; no `color-scheme` declared | PR #43 |
| 8 | Post-deploy verify | 1 — second voucher-like input (promo redeem) still unlabeled | PR #44 |
| 9 | Responsive + perf | 1 — Cloudflare Insights script not whitelisted (legitimate; needed explicit acknowledgement) | PR #44 |
| 10 | Full-suite verify | 0 — coverage converged | — |

**10 real bugs caught by the e2e layer that the 164-case Vitest unit suite never could:**
- Per-page `<link rel="alternate" hreflang>` missing (sitemap had them, page metadata didn't)
- Login inputs without `autoComplete` (iOS Keychain / 1Password silently failed to fill)
- 429 responses bypassing `jsonResponse` so `Cache-Control` dropped
- Icon-only buttons (hamburger, eye-toggle) without accessible names
- 5 visible `<label>` elements not programmatically linked to their inputs via `htmlFor`/`id`
- Promo-redeem input on `/th/login` with no label association at all
- No `color-scheme` declaration → native widgets clashed with brand palette on system-dark
- CF Insights beacon flying under the third-party-script radar

**Test totals**: 164 unit + 79 e2e = **243 total tests**. Unit suite stays in `npm run check:all` (~2s); Playwright is opt-in via `npm run test:e2e` (~25s, needs network).

**Touched (across PRs #41–#44)**:
- `playwright.config.ts` — new file. mobile viewport, `ignoreHTTPSErrors`, baseURL → prod.
- `tests/e2e/smoke.spec.ts` — 17 cases pinning every architectural fix from PRs #21–#40.
- `tests/e2e/ui-ux.spec.ts` — 11 cases for DOM-only surfaces.
- `tests/e2e/deep-probes.spec.ts` — 20 cases for headers, headings, autocomplete, payload size, rate-limit behaviour.
- `tests/e2e/a11y.spec.ts` — 9 cases for keyboard nav, icon-button names, focus indicators, label associations, lang attribute, color-scheme.
- `tests/e2e/responsive-perf.spec.ts` — 12 cases for viewport breakpoints, payload caps, LCP preload, third-party script whitelist.
- `src/app/[locale]/layout.tsx` — `metadata.alternates.languages` + `viewport.colorScheme: 'light'`.
- `src/app/[locale]/login/page.tsx` — 6 inputs gained `id` + matching `htmlFor` on labels; `autoComplete` per mode; `aria-label` on eye toggle and promo input.
- `src/app/[locale]/page.tsx` — hamburger gained `aria-label` + `aria-expanded`.
- `src/lib/rate-limit.ts` — `tooManyResponse()` now sets `Cache-Control: no-store`.
- `src/messages/{th,en,de,da}.json` — 3 new keys (`nav.open_menu`, `nav.close_menu`, `auth.toggle_password_visibility`) × 4 locales.
- `package.json` — new scripts `test:e2e` + `test:e2e:report`; `@playwright/test` ^1.60.0.
- `.gitignore` — Playwright artefact directories.

**Pattern**: e2e is the layer that catches **"fix shipped but doesn't render correctly"** + **"surface exists but assistive tech can't use it"**. Unit tests pin source-code invariants (cheap); e2e pins rendered behaviour (medium-cost, ~25s, opt-in). Both have their place. The session-derived rule: **add an e2e probe BEFORE the next deploy cycle** when shipping any architectural change to the public surface — saves the 4-iteration spiral that PRs #34–#38 needed for the sitemap.

### Added — Playwright e2e suite + hreflang alternates on every locale page

UX-audit round 5 introduced a new test layer: **Playwright e2e against production**. Until now the test suite was Vitest source-level invariants only — `npm run check:all` was fast (~2s) but couldn't catch bugs that only appear in a real browser (DOM after hydration, network-layer 404s on referenced assets, console errors). 28 e2e tests now sit alongside the 163 unit tests.

Within the first run, Playwright caught **a real bug** the unit suite missed:

🐛 **No `<link rel="alternate" hreflang>` tags on any rendered HTML page**. The sitemap (`/sitemap.xml`) carries the locale alternates, but the per-page metadata didn't — so a crawler visiting `/th` couldn't see that `/en`, `/de`, `/da` are translations of the same content. `og:locale:alternate` covers Open Graph but not search-engine canonicalisation, which specifically needs the `rel=alternate` links.

**Fix**: `app/[locale]/layout.tsx → metadata.alternates`:
```ts
alternates: {
  canonical: '/th',
  languages: {
    th: '/th', en: '/en', de: '/de', da: '/da',
    'x-default': '/th',   // primary launch locale
  },
}
```

`metadataBase` from PR #35 makes Next.js serialise these as absolute URLs.

Other touches:
- **`playwright.config.ts`** (new): `baseURL` defaults to production; mobile viewport (414×896, iPhone 11 Pro); Thai locale via `Accept-Language`; `ignoreHTTPSErrors: true` for sandbox containers that lack the public CA bundle (Node `request` works without it; Chromium needs the flag). NOT wired into `check:all` — too slow + needs network. Invoke explicitly via `npm run test:e2e`.
- **`tests/e2e/smoke.spec.ts`** (new): 17 cases pinning every architectural fix this session has shipped — homepage renders without console errors across all 4 locales; favicon + apple-touch-icon resolve; og:image absolute URL; locale-aware 404 with native headlines (`หาหน้านี้ไม่พบ`, `Couldn't find that page`, …); sitemap.xml well-formed; security headers (X-Frame, Referrer-Policy); Cache-Control on every API route; `/api/health.deployment.shaShort` shape; zod 400 on `/api/auth/login`; scan page renders.
- **`tests/e2e/ui-ux.spec.ts`** (new): 11 cases for surfaces the unit suite can't reach — locale-switcher round-trip; nav links resolve; `<img>` alt-text after hydration; zero broken images post-load; manifest icons all serve 200; login form empty-submit doesn't navigate to `/dashboard`; robots.txt has body; **canonical/hreflang present** (the failing test that surfaced the bug above).
- **`package.json`**: new scripts `test:e2e` and `test:e2e:report`. `@playwright/test` ^1.60.0 in devDependencies.
- **`.gitignore`**: Playwright artefact dirs (`test-results/`, `playwright-report/`, `playwright/.cache/`).

**Pattern**: e2e is the layer that catches "fix shipped but doesn't render correctly" — exactly the class of bug that took 4 PRs (#34→#38) to nail down the sitemap. Future architectural changes get an e2e probe BEFORE the deploy validation cycle, so the next 4-iteration spiral takes 1 iteration instead.

Project tests: **163 unit + 28 e2e = 191 total** (was 163).

### Fixed — Browser tab icon was the default browser glyph because `src/app/icon.png` never served

UX-audit round 3 documented this in `KNOWN_ISSUES.md` but didn't fix it: `/icon.png` and `/apple-icon.png` both 404'd in production. The 418KB PNG files lived in `src/app/` (App Router convention), but the OpenNext-on-Pages adapter never served them — likely the same convention-vs-static-asset split that bit `/sitemap.xml`.

User-visible impact: every browser tab on `shinnyguide.autobahn.bot` showed the default browser globe/document icon instead of a brand mark. Mild but persistent UX scrappiness for the entire app surface.

**Fix** — apply the established escalation rule from PR #38 (convention fails → move to `/public/*`):

- **`frontend/public/favicon.svg`** — new 1KB hand-written SVG. Brand-primary-400 (`#ec7064`) rounded square + white capital "S" in `viewBox="0 0 256 256"`. Replaces the 418KB PNG that couldn't serve. Text-diffable in PRs; scales to every tab size without aliasing.
- **`frontend/src/app/[locale]/layout.tsx`** — explicit `icons` block in `metadata`: `icon: '/favicon.svg'`, `apple: '/images/shinny_avatar.png'` (the avatar is already proven to serve via the og:image path; iOS expects raster for `apple-touch-icon`).
- **`frontend/src/app/manifest.ts`** — icons array updated to reference the same paths (SVG + the avatar PNG for both `any` and `maskable` purpose).
- **`frontend/src/app/icon.png` + `frontend/src/app/apple-icon.png`** — **deleted** (836KB total). The App Router convention proven unreliable for this adapter; explicit `/public/` paths are the working surface.
- **`frontend/tests/seo-pwa.test.ts`** — 3 new cases: layout-metadata icons point at `/favicon.svg` + `/images/...`, manifest icons reject `/icon.png` and `/apple-icon.png`, `public/favicon.svg` exists with valid envelope + brand-colour token. **163/163 passing** (was 160/160).

**Pattern**: applies the rule the session derived through PRs #34–#38. Convention surfaces are unreliable on OpenNext-on-Pages; `/public/*` files always serve. For brand assets that don't change request-by-request, ship as static files.

### Fixed — Multi-photo scans always failed with "analysis taking too long" — client timeout was tighter than server budget

User report (Thai): "เวลาใส่หลายรูป เจอแบบนี้ตลอด" (every multi-photo upload errors). Screenshot showed `การวิเคราะห์ใช้เวลานานเกินไป กรุณาลองอีกครั้งด้วยรูปที่ชัดกว่านี้` — the **client-side** abort copy, not the server's "AI under high load" 503. **No `Request ID`** on the error card, confirming the request never reached server-completion state.

**Root cause**: structural mismatch between client and server timeouts.

| Layer | Budget |
|---|---|
| Client fetch abort (`API_TIMEOUT_MS`) | **30 s** (hardcoded) |
| Server cascade (`/api/analyze`) | Gemini 25 s + CF safety-net 20 s = **up to 45 s** |

Single-photo scans typically finish in 7–10 s, so the 30 s client wall never triggered — the mismatch was invisible. **Multi-photo collages** run 18–25 s baseline (larger payload + longer AI parse for the stitched image), and when the Gemini cascade falls through to the CF safety-net, total response time routinely exceeds 30 s. **Client aborted on every multi-photo scan**, leaving the user with a misleading "taking too long" message even when the server had successfully completed the analysis a few seconds later.

**Fix**: scale `API_TIMEOUT_MS` by photo count:

```ts
const API_TIMEOUT_MS = Math.min(
  60_000,
  30_000 + Math.max(0, uploadedImages.length - 1) * 12_000,
);
//  1 photo  → 30 s  (unchanged — preserves fast-fail UX for genuinely-broken requests)
//  2 photos → 42 s  (covers Gemini → CF fall-through)
//  3 photos → 54 s  (worst observed multi-photo end-to-end)
//  4+       → 60 s  (clamped; >5s headroom above server's 45s cascade budget)
```

Touched:
- `frontend/src/hooks/scan/useScanAnalysis.ts` — `API_TIMEOUT_MS` rewritten with the per-photo scale + cap. Inline comment records the user-report context, the server budget breakdown, and the per-photoCount mapping table so the next contributor doesn't shrink the cap below the cascade.
- `frontend/tests/scan-timeout.test.ts` — **new test file**, 4 cases pinning: (a) hardcoded `30_000` is forbidden in live code, (b) formula references `uploadedImages.length`, (c) cap (60 s) stays ≥ 5 s above server budget (45 s), (d) base case (1 photo) preserves the 30 s wall. Project total: **160/160 tests passing** (was 156/156).

**Pattern recognition**: this is structurally identical to PR #28's rate-limit bug — a "doesn't throw" safety wrapper masked the actual problem. Pre-fix, the hardcoded 30 s client timeout *worked* for 90 %+ of scans (single-photo) and silently failed for the remaining 10 % (multi-photo). Tests passed because no test exercised the multi-photo timing axis. **Adding the regression test makes the formula's intent visible**: the timeout must exceed server budget by 5 s, the formula must scale with photo count, the base case must preserve the fast-fail UX for single-photo. Any future contributor who reverts to a single fixed value re-introduces the bug and fails CI.

### Fixed — `/sitemap.xml` still 404 after PR #37; switched to static file in `/public/`

PR #37 moved the handler to `/api/sitemap` and added `next.config.js → rewrites()` to expose at `/sitemap.xml`. Post-deploy probing isolated the failure cleanly:

```
/api/sitemap   → 200, application/xml, 3587 bytes  ✓ handler works
/sitemap.xml   → 404                               ✗ rewrite doesn't fire
```

**`next.config.js → rewrites()` doesn't run on OpenNext-on-Cloudflare-Pages**. Likely cause: Next.js compiles rewrites into Vercel-specific edge middleware that the OpenNext adapter doesn't translate. Four iterations on this surface (#34 convention → #36 dotted folder → #37 API + rewrite → now) is enough.

**Fix**: drop the rewrite plumbing entirely. Ship `/public/sitemap.xml` as a static file. Cloudflare Pages serves `/public/*` reliably (already proven for `/images/shinny_avatar.png`). Loses dynamic generation; gains bulletproof serving.

Touched:
- `frontend/public/sitemap.xml` — **new static file**, 3587 bytes, same content as the dynamic handler produced. Update by hand when adding a locale or public path (`src/lib/i18n-config.ts → locales` change → regenerate this file).
- `frontend/src/app/api/sitemap/` — **deleted**.
- `frontend/next.config.js` — removed the `rewrites()` block (it doesn't run on the adapter).
- `.gitignore` — carve-out for `frontend/public/sitemap.xml` (the existing `*.xml` rule matches by name).
- `tests/seo-pwa.test.ts` — reads the static file directly via `readFileSync`. Same 5 invariants (well-formed envelope, home + scan entries, auth-gated routes excluded, hreflang for all 4 locales, absolute URLs). 156/156 passing.

**Revised escalation rule** (this is now version 3 — the session has been honest about its own iterations):
1. Try the Next.js convention file (`app/manifest.ts` ✓, `app/sitemap.ts` ✗).
2. **Do NOT** try `app/<name>.<ext>/route.ts` — dotted-folder collision.
3. **Do NOT** try `app/api/<name>/route.ts` + `rewrites()` — rewrites don't fire on this adapter.
4. **DO** ship a static file in `/public/` if the content can be pre-rendered.

The audit playbook in `GUIDELINE.md` is updated accordingly.

### Fixed — `/sitemap.xml` still 404 after PR #36; moved handler to `/api/sitemap` behind a rewrite

Post-deploy validation of PR #36 caught its sitemap fix didn't actually fix anything: `/sitemap.xml` continued returning 404 in production even after dropping the `app/sitemap.ts` convention for an explicit `app/sitemap.xml/route.ts` handler. The localised 404 page from the same PR shipped correctly (response carried `ขออภัย` / Shinny brand / 32KB body — vs the framework's 7.5KB default), but the sitemap stayed broken.

Suspected cause: Next.js's `sitemap.{js,ts,xml,jsx,tsx}` special-filename recognition collides with a dotted folder name like `sitemap.xml/`. Either Next.js itself or the OpenNext-on-Cloudflare-Pages adapter ends up treating the folder as a malformed convention file and skips it during route registration. No build warning, no log entry — just a 404.

Fix: move the handler to a non-dotted path that the adapter handles reliably (`/api/sitemap` — the most thoroughly-tested surface) and add a `next.config.js` rewrite so the public URL stays `/sitemap.xml`. Search engines and robots.txt links don't notice; the rewrite is transparent.

Touched:
- `src/app/api/sitemap/route.ts` — **new path**, identical handler logic moved from `src/app/sitemap.xml/route.ts`. Inline comment records PR #34 → #36 → this PR's iteration trail so the next person doesn't re-discover the dotted-folder trap.
- `src/app/sitemap.xml/` — **deleted** (folder removed; `route.ts` moved as above).
- `next.config.js` — added `rewrites()` mapping `/sitemap.xml` → `/api/sitemap`.
- `.gitignore` — removed the PR #36 carve-out (`!frontend/src/app/sitemap.xml/`) since the folder no longer exists. Back to clean state.
- `tests/seo-pwa.test.ts` — updated the sitemap test's import path to `@/app/api/sitemap/route`. No test logic changed. Project total: **158/158 passing**.

Diagnostic note: PR #36's CHANGELOG entry promised "explicit `route.ts` always works on every adapter". That claim was wrong for dotted folder names. **Revised rule**: explicit `route.ts` only beats the convention when the folder path is alphanumeric — dotted paths still collide with Next.js's special-filename recognition. `/api/*` is the universally-safe location; pair with `rewrites()` for the public-facing URL.

### Fixed — `/sitemap.xml` 404 + locale-aware 404 page not actually rendering (UX round 4 post-deploy validation)

Round 4 (PR #35) shipped `app/sitemap.ts` (Next.js convention) and `app/[locale]/not-found.tsx`. Local tests passed; production probes after deploy showed two real-world failures:

1. **`/sitemap.xml` → 404** in production, even though `/manifest.webmanifest` from the same Next.js convention family returned 200. OpenNext-on-Cloudflare-Pages handles the `manifest.ts` convention but silently drops the `sitemap.ts` one. No build error, no log entry — just a 404.
2. **`/th/no-such-path` rendered the English framework default** (`<title>404: This page could not be found.</title>`, zero Thai chars, no `<html lang="th">`). The locale layout never executed — OpenNext was short-circuiting to a static 404 fallback before the segment chain could run.

Both fixed by bypassing the adapter-fragile Next.js conventions and dropping to lower-level routing primitives that the adapter handles reliably:

- **Sitemap**: deleted `src/app/sitemap.ts`; added `src/app/sitemap.xml/route.ts` — an explicit `GET` handler that returns the XML directly with `Content-Type: application/xml`. Same content, lower-level routing.
- **Locale 404**: added `src/app/[locale]/[...slug]/page.tsx` — a catch-all server component that calls `notFound()`. Forces the locale segment to enter on any unmatched path under `/<locale>/...`. Next.js then renders the closest `not-found.tsx` — which is the localized one inside `[locale]/`. Sibling routes (`/th/scan`, `/th/login`, …) still take precedence over the catch-all by Next.js's specificity rules.

Touched:
- `src/app/sitemap.ts` — **deleted**.
- `src/app/sitemap.xml/route.ts` — **new file**, explicit `GET` handler building the XML by hand. Defensive `xmlEscape()` for the `&`-in-URL case.
- `src/app/[locale]/[...slug]/page.tsx` — **new file**, two-line catch-all that calls `notFound()`.
- `tests/seo-pwa.test.ts` — rewrote the sitemap tests to invoke the route handler directly and parse the XML body. Added 2 new cases asserting the catch-all source uses `notFound()` from `next/navigation`. Project total: **157/157 tests passing** (was 153/153).
- `docs/KNOWN_ISSUES.md` — Resolved entry; OpenNext-on-Pages adapter quirks documented so the next contributor knows to reach for explicit handlers when convention-based files silently 404.

### Added — `og:image` / `twitter:image` + locale-aware 404 page (UX round 4)

Round 4 UX audit probed the rendered HTML for share-preview metadata and the 404 experience. Found two gaps that no user had reported but that broke the share-driven product loop and the locale contract:

1. **No `og:image` / `twitter:image`** on any locale page. Sharing the homepage on LINE / FB / X / Discord / Slack produced a text-only card with no preview — embarrassing for a product whose explicit pitch is "scan your food, share with friends".
2. **404 page was fully English** even when hitting Thai URLs. `/th/this-route-does-not-exist` returned the Next.js default with `<title>404: This page could not be found.</title>` and zero Thai characters in body. Breaks the Thai-primary product positioning.

Touched:
- `src/app/[locale]/layout.tsx` — added `openGraph.images` (1200×630 ratio recommendation, our 640×640 avatar fits both FB + X), `twitter.card: 'summary_large_image'`, `twitter.images`, and `metadataBase: new URL('https://shinnyguide.autobahn.bot')` so relative paths resolve against the prod origin (without it, crawler-side renders point at `localhost`).
- `src/app/[locale]/not-found.tsx` — **new file**. Localized 404 with the Shinny avatar, two CTAs (Home + Scan) so it's not a dead-end. Uses `next-intl` from the new `not_found` namespace.
- `src/messages/{th,en,de,da}.json` — new `not_found` namespace with 5 keys × 4 locales = 20 strings. Native phrasing per locale (Thai uses `ค่ะ` polite particle to match the Shinny voice, German uses `möglicherweise verschoben`, etc.).
- `tests/seo-pwa.test.ts` — **10 new cases** pinning: og:image presence, twitter card type, metadataBase, the 404 page references `useTranslations('not_found')`, every `not_found.*` key gets rendered, both CTAs present, and cross-locale namespace completeness (4 generated tests, one per locale). Project total: **153/153 passing** (was 143/143).

### Added — Security headers + PWA manifest + multi-locale sitemap (UX round 3)

UX-audit round 3 probed HTML pages and discovered systemic gaps that no user had reported but that affected privacy, install UX, and SEO:

| Gap | Surface | Fix |
|---|---|---|
| No `X-Frame-Options` | every HTML page | `next.config.js` headers → `DENY` (no iframe-embed use case) |
| No `Referrer-Policy` | every HTML page | → `strict-origin-when-cross-origin` (stops leaking `?debug=1` URLs to third-party CDNs) |
| No `Permissions-Policy` | every HTML page | → `camera=(self)` only; mic/geo/payment/usb/sensors all off |
| `/manifest.webmanifest` → 404 | mobile users | `src/app/manifest.ts` (Next.js convention) — enables Add-to-Home-Screen |
| `/sitemap.xml` → 404 | search engines | `src/app/sitemap.ts` — public surfaces only (`/`, `/scan`, `/demo`, `/pricing`, `/recipes`, `/login`) with `hreflang` alternates across all 4 locales |

**Excluded by design from sitemap**: `/dashboard`, `/chat` (auth-gated; indexing them points search users at a redirect-to-login experience), `/admin/*`, `/api/*`.

**CSP not included**: Content-Security-Policy would require a full audit of every inline style/script Next.js emits, plus the dev-mode HMR client's `unsafe-eval`. Tracked as a follow-up in `KNOWN_ISSUES.md`.

Touched:
- `next.config.js` — `headers()` block applies the three security headers to every non-`/api/*` route. API routes already set `Cache-Control: no-store` via `lib/api-response.ts` and don't render HTML, so framing/referrer headers don't apply.
- `src/app/manifest.ts` — **new file**, returns `MetadataRoute.Manifest`. Brand colour tokens (`#ec7064` theme, `#fff5f5` background) match `globals.css`.
- `src/app/sitemap.ts` — **new file**, returns `MetadataRoute.Sitemap`. Auto-generated entries cover all 4 locales × 6 public paths = 24 hreflang-linked URLs.
- `tests/seo-pwa.test.ts` — **new test file**, **9 cases** pinning manifest + sitemap shape: brand colours, standalone-portrait display, auth-gated routes excluded, every entry carries `hreflang` alternates for all 4 locales, absolute URLs. Project total: **143/143 tests passing** (was 134/134).
- `docs/KNOWN_ISSUES.md` — Resolved entry; CSP follow-up + `/icon.png` 404 (separate deployment issue, not addressed in this PR) documented.

### Fixed — Every API route except `/api/health` was returning responses with no `Cache-Control` header

Bug-hunt May 2026 UX-audit pass: sweep of every `/api/*` endpoint showed only `/api/health` was returning `Cache-Control: no-store`. The other 12 routes (`auth/login`, `auth/me`, `auth/register`, `auth/logout`, `chat`, `analyze` 400s, `promo/redeem`, `voucher/check`, all `admin/*`) shipped responses with no `Cache-Control` at all. Each of those carries personalized data (user records), per-request identifiers (`requestId`), or session-tied state — none safe for an intermediate cache to store.

Cloudflare's edge happens not to cache cookie-bearing responses by default, so real-world blast radius was small. But relying on that is fragile and varies by edge-cache configuration — explicit `Cache-Control: no-store` is the contract.

**Fix**: new `lib/api-response.ts` exports `jsonResponse(body, init?)` — a thin wrapper around `NextResponse.json` that defaults `Cache-Control: no-store` on every API response. All 13 API routes migrated to use it. The escape hatch (caller-supplied `Cache-Control` overrides the default) is preserved for the hypothetical future "cacheable manifest" route, but opting out has to be visible at the call site.

**Locked in by test**: `tests/api-response.test.ts` walks every `src/app/api/**/route.ts` file and asserts `NextResponse.json(...)` doesn't appear in live code. Any new route that uses the unwrapped `NextResponse.json` now fails CI.

Touched:
- `lib/api-response.ts` — **new file**, single `jsonResponse` export.
- All 13 routes under `src/app/api/**/route.ts` — migrated from `NextResponse.json(...)` to `jsonResponse(...)`. Import line updated; the explicit `Cache-Control: 'no-store'` that some routes (`/analyze` success, `/health`) already passed is harmless (helper merges it the same way).
- `tests/api-response.test.ts` — **new file**, 5 helper-shape tests + per-route invariant enforcement (14 generated test cases, one per route file). Project total: **134/134 passing** (was 115/115).
- `tests/analyze-fallback.test.ts` — updated the `fallbackProviderError` regex to accept either `NextResponse.json` or `jsonResponse` at the call site (post-migration).

### Added — `fallbackProviderError` field on `/api/analyze` 503 responses

Bug-hunt May 2026, Request ID `qh0f02ft` (drink_snack mode): both the Gemini cascade AND the CF safety-net failed. The 503 response surfaced `primaryProviderError: 'The operation was aborted'` (Gemini) but **nothing about CF's failure** — only the auto-correction retry's last error in `details`. Operators couldn't tell whether CF actually failed first or whether CF wasn't even tried.

Now the response carries `fallbackProviderError` alongside `primaryProviderError`:

```json
{
  "error": "AI analysis failed",
  "details": "...",                              // last error in chain (auto-correction retry)
  "primaryProviderError": "The operation was aborted",  // Gemini cascade
  "fallbackProviderError": "CF timeout after 20s",      // CF safety-net  ← NEW
  "failedJson": "...",                           // CF's raw response if it returned anything
  "requestId": "..."
}
```

The full chain ("who failed and how") is now visible on a single curl, no log access required. **This continues the diagnostic-dividend pattern from PRs #23 + #25**: each surface added makes the next session's bug findable in one probe instead of multiple round trips.

Touched:
- `app/api/analyze/route.ts` — wrapped the CF safety-net call in a try/catch that captures `cfErr.message` into `fallbackProviderError` before re-throwing. Surfaces in the 503 response body. Inline comment explains how it interacts with `failedJson` (which still captures CF's raw response when CF DID return but the content failed validation).
- `tests/analyze-fallback.test.ts` — new regression case asserts the field is captured at the right call site (`fallbackProviderError = cfErr.message`) AND surfaced in the 503 response shape (not just declared). Project total: **115/115 tests passing** (was 114/114).

### Fixed — CF safety-net fallback was truncating its JSON output (default `max_tokens` too low)

User report: scan 503 with Request ID `02tf04hd` on the Thai locale (user is on premium tier — not a quota issue). Direct probe (Request ID `eh0dzg8k`) surfaced the diagnostic chain via PR #23's `primaryProviderError` + PR #25's `failedJson` preview:

```
primaryProviderError: 'The operation was aborted'                       ← Gemini cascade timed out
failedJson:           {"isFood":true,"dishes":[{"name":"ข้าวผัด",      ← CF served, saw the food
                       "detectedItems":["🥔 ข้าว","🐟 น้ำปลา",…        ← but stopped mid-array
details:              JSON Parse Error: Regex-extracted JSON also       ← validation failed
                       invalid: Expected ',' or ']' …
```

**Root cause**: when CF Workers AI runs `@cf/meta/llama-3.2-11b-vision-instruct` without explicit `max_tokens`, it defaults to ~256 — way too tight for our schema. On a verbose Thai response (long `detectedItems` array + multi-byte UTF-8), the model stopped mid-stream and the JSON parser couldn't recover. The Gemini call already passed `maxOutputTokens: 4096`; the CF call didn't pass the equivalent.

**Fix**: pass `max_tokens: 4096` on both CF call sites in `attemptAiInference` (initial inference + post-license-accept retry). Matches the Gemini budget. The text-only `prompt: 'agree'` license-acceptance call doesn't need it (default is fine for a ~10-token ping).

The combined diagnostic chain that surfaced this — `primaryProviderError` (PR #23) + `failedJson` (PR #25) — meant root cause was visible in one probe. **The session's diagnostic investment is paying recurring dividends**: every subsequent 503 will continue to surface its actual root cause in the response body without requiring a separate logging deployment.

Touched:
- `app/api/analyze/route.ts` — `max_tokens: 4096` on both `env.AI.run({prompt, image, …})` calls. Inline comment records the Request IDs and the truncation failure mode.
- `tests/analyze-fallback.test.ts` — new regression case asserts both image-carrying CF call sites include `max_tokens: 4096`. Project total: **114/114 tests passing** (was 113/113).
- `docs/KNOWN_ISSUES.md` — Resolved entry with the diagnostic trail.

### Added — `/api/health` now surfaces Cloudflare Pages deployment metadata

Bug-hunt May 2026 closing gap: the only way to verify "is the current deploy actually the commit I just merged?" was through behavioural inference (does `modelUsed` reflect the post-PR shape? does rate-limit suddenly engage?). That's slow and error-prone — it's how PRs #21, #22, and #23 each shipped feeling complete while leaving an unfixed user-facing bug, because the validation matrix passed against a stale deploy that hadn't rolled over yet.

`/api/health` now reads `CF_PAGES_COMMIT_SHA`, `CF_PAGES_BRANCH`, and `CF_PAGES_URL` from the Cloudflare Pages build environment and exposes them as a `deployment` block:

```json
{
  "status": "healthy",
  "deployment": {
    "sha": "9e74084adfa7516f4502401cdfbe8775165f215f",
    "shaShort": "9e74084",
    "branch": "main",
    "pagesUrl": "https://nutri-vision-ai.pages.dev"
  }
}
```

`ITERATION_PROCESS.md §5` post-merge verification now starts with `git rev-parse --short main` vs `curl /api/health | jq -r .deployment.shaShort` — if they don't match within ~5 min, the §3 behavioural checks would be validating old code.

Touched:
- `app/api/health/route.ts` — added `deployment` block; reads the three CF Pages env vars defensively (null in local dev, which is the correct sentinel).
- `tests/health.test.ts` — **new test file**, 5 cases pinning the response shape: `deployment` block exists, reads from the three `CF_PAGES_*` env vars, produces a 7-char short SHA, returns `null` when env vars are unset, and `status` field stays top-level. Project total: **113/113 tests passing** (was 108/108).
- `README.md`, `docs/KNOWLEDGE_BASE.md`, `docs/GUIDELINE.md`, `docs/ITERATION_PROCESS.md` — point operators at the new field with the canonical curl-vs-git-rev-parse recipe.

### Fixed — Rate limiting was silently failing open in production

Bug-hunt May 2026 (continuation): **40 parallel requests to `/api/voucher/check`** (configured limit: 30 / minute) all returned HTTP 200. Zero 429s. Same test on `/api/auth/login` (configured limit: 10 / 15min) returned 12 consecutive 401s with no rate-limit engagement. The brute-force protection for the pilot launch was **not actually protecting anything**.

**Root cause**: `lib/rate-limit.ts` v1 used `caches.default` (Cloudflare Workers Cache API) as its primary store. In raw Workers this gives same-millisecond read-after-write consistency. In the OpenNext-on-Pages runtime, it does not — the cache `put` doesn't propagate before the next request reads, so every request sees an empty bucket. The original code's defensive `try { } catch { return allowed:true }` design meant this failure was **completely silent**: no log, no metric, no test failure.

**Fix**: switched the primary store to a module-scoped `Map<string, Bucket>`. Bucket state now lives in the worker's V8 heap and persists across requests within the same instance — always works regardless of runtime. The original `caches.default` path is dropped entirely; if we later need cross-instance coordination, swap for Upstash Redis / Durable Object behind the same `rateLimit()` API.

Threat-model fit: per-instance memory is sufficient against the *intended* threat (single-IP brute-force from one client). A distributed attacker hitting 20+ CF PoPs concurrently can still exceed the limit; that requires a cross-instance store and is documented as a future swap path.

Touched:
- `lib/rate-limit.ts` — `rateLimitInner` rewritten around a module-scoped `Map`. Added periodic LRU prune to bound memory at `O(unique_IPs × routes)` for the window TTL. Exposed `_resetForTest()` so suites don't bleed state between cases.
- `tests/rate-limit.test.ts` — **5 new enforcement tests** that exercise the actual blocking behaviour (was previously only fail-open contract testing, which is what let the bug ship). Project total: **108/108 tests passing** (was 103/103).
- `docs/KNOWN_ISSUES.md` — Resolved entry with the bug-hunt diagnostic trail.

Validation: re-probe `/api/voucher/check` with 40 parallel requests after deploy. Expected: first ~30 return 200, remainder return 429 with `retry-after` header. `/api/auth/login` brute force: 11th attempt returns 429.

### Changed — Reversed scan cascade: Gemini is now primary, Cloudflare is the safety-net fallback

Post-bug-hunt May 2026 (PRs #25 + #26) discovery: with the 5016 license and image-format bugs both fixed, CF's vision model could finally serve responses — but it served **inaccurate** ones. The smaller Llama 3.2 11B model called Shrimp Fried Rice "Pineapple" with 100% confidence on multiple probes, and its JSON compliance was non-deterministic (sometimes parseable, sometimes free-form text that failed validation).

The original CF-primary order was chosen for cost — CF is free with the Pages plan, Gemini burns a paid free-tier quota. But because CF's invalid-JSON responses were already triggering fallthrough to Gemini on most scans, **the CF-primary order wasn't actually saving meaningful Gemini quota** — it was just trading "accurate-when-Gemini-works" for "fast-and-cheap-but-sometimes-wrong" on the subset of scans where CF returned parseable garbage.

**Decision**: reverse the cascade so accuracy wins the happy path.

- **Primary**: Gemini cascade — `gemini-2.5-flash` → `gemini-2.0-flash` → `gemini-1.5-flash`. The third entry (1.5-flash explicit version) is new RPM headroom for burst loads; if a project has EOL'd 1.5, the cascade skips on 404 just like the other entries.
- **Safety-net fallback**: Cloudflare `@cf/meta/llama-3.2-11b-vision-instruct`. Runs only when the entire Gemini cascade exhausts (or returns garbage). Users get *some* response when Gemini quota is fully out, accepting accuracy degradation as the cost of "not 503'ing the user."
- **`primaryProviderError`** field semantics shift: now carries the **Gemini** error message when CF is the one ultimately serving (previously carried the CF error). The route comment is updated to reflect this.

Touched:
- `app/api/analyze/route.ts` — `runInferenceWithValidation` rewritten so Gemini runs first, CF is the catch path. Inline comment records why (the post-PR #26 accuracy regression). Attempt-2 auto-correction inverts to force CF for diversity (was forcing Google).
- `lib/ai-providers.ts` — `GEMINI_VISION_MODELS` extended with `'gemini-1.5-flash'` as a third entry. Doc comment updated with the RPM-headroom rationale.
- `tests/analyze-fallback.test.ts` — new test pins the Gemini-before-CF source order so a future contributor can't quietly swap it back. **103/103 project tests passing** (was 102/102).
- `README.md`, `README-TH.md`, `docs/KNOWLEDGE_BASE.md`, `docs/gemini.md`, `docs/claude.md` — all updated to describe the reversed cascade and the rationale.

### Fixed — Cloudflare AI vision was never seeing the image (`image: [bytes]` was a Uint8Array wrapped in an array)

Surfaced once PR #25 unblocked the 5016 license error that had been masking it on every prior scan. Post-PR #25, CF responses came back parseable but **hallucinated** — fried-rice images were being analysed as "Mixed Greens Salad", and responses included `Here is your image: ![image](https://i.imgur.com/…)`. That last detail is the smoking gun: the vision model was generating training-data-style markdown about a hypothetical image because it had zero pixels to look at.

**Root cause**: the route was calling
```ts
const bytes = decodeBase64ToBytes(base64Data);  // Uint8Array
env.AI.run(model, { prompt, image: [bytes] });  // [Uint8Array] !!
```
CF Workers AI vision models (`@cf/meta/llama-3.2-*-vision-instruct`, `@cf/llava-…`) expect `image: number[]` — a flat array of unsigned byte values. The original code shipped `[Uint8Array]`, a 1-element list whose only entry was the typed array itself. CF deserialised that as "no image present" and the model fell back to text-only behaviour.

The bug had been there since the original `/api/analyze` commit but was **completely invisible** because every CF call returned 5016 (Llama Community License never accepted on this account) before ever reaching the model. Auto-accept (PR #25) made the call succeed, which made the format bug observable for the first time.

**Fix**: flatten via `Array.from(decodeBase64ToBytes(…))` at the decode site, then pass `image: bytes` (no wrapper).

Touched:
- `app/api/analyze/route.ts` — `decodeBase64ToBytes(...) ` wrapped in `Array.from(...)`; both call sites changed from `image: [bytes]` to `image: bytes`. Comment block records the failure mode so the next person doesn't accidentally re-wrap.
- `tests/analyze-fallback.test.ts` — new regression case forbids `image: [bytes]` or `image: [decodeBase64ToBytes(...)]` in live code and requires `Array.from(decodeBase64ToBytes` at the decode site. Project total: **102/102 tests passing** (was 101/101).
- `docs/KNOWN_ISSUES.md` — entry under Resolved with the full diagnostic trail and the masking-by-5016 narrative.

Validation: re-probe `/api/analyze` against production after deploy. Expected: `modelUsed: cloudflare-llama-3.2-11b` returning a `dishes` array with the actual food in the image (Shrimp Fried Rice for the canonical test fixture).

### Fixed — Cloudflare AI primary 100% failure (Llama 3.2 license never accepted); now auto-accepts on first 5016

Surfaced by bug-hunt May 2026 (Request ID `sex01ab2`). The `primaryProviderError` field shipped in PR #23 had been quietly hiding the same error on every production scan since launch:

```
5016: Prior to using this model, you must submit the prompt 'agree'.
By submitting 'agree', you hereby agree to the
llama-3.2-11b-vision-instruct Community License …
```

Meta requires Cloudflare account holders to explicitly accept the Llama 3.2 Community License once before the model will run any inference. This account had never accepted, so **every scan since launch was being served by the Gemini fallback** — costing Google free-tier quota for work the CF primary should have done for free. The cascade absorbed it (users saw successful results), so the failure was silent until both Gemini cascade entries 429'd in the same window during a burst probe.

**Fix**: `attemptAiInference` in `/api/analyze` now catches the first `5016:` error, sends `prompt: 'agree'` (Cloudflare's documented programmatic acceptance path — text-only, no image), and retries the actual food inference once. Acceptance is account-level and one-shot; subsequent scans never re-trigger it. If acceptance itself fails, the original 5016 propagates and the Gemini cascade picks up as before — net behaviour can only improve, never regress.

Touched:
- `app/api/analyze/route.ts` — wrapped the `env.AI.run` call in a try/catch that detects `5016:` prefix, submits the agree-prompt acceptance, then retries the real inference. Added `CF_LLAMA_LICENSE_ACCEPTING` / `CF_LLAMA_LICENSE_ACCEPTED` telemetry stages.
- `tests/analyze-fallback.test.ts` — new regression case asserts the route contains the `5016:` marker, the `prompt: 'agree'` retry call, and both telemetry stages. Project total: **101/101 tests passing** (was 100/100).
- `docs/KNOWN_ISSUES.md` — removed stale §0 "CF primary frequently fails" (now resolved); added "Cloudflare AI primary 100% failure — Meta Llama 3.2 license never accepted" under Resolved with the diagnostic trail.

Validation: re-probe against production after deploy. Expected: scans now report `modelUsed: cloudflare-llama-3.2-11b` for the bulk of traffic; Gemini falls back only when CF actually times out / errors out.

### Fixed — Google free-tier `gemini-2.0-flash` quota silently dropped to `limit: 0`; scan fallback broken (again)

User report: scan upload **still** returns `503 "Food analysis is temporarily unavailable"` after the previous Gemini-alias swap (Request IDs `tqunrejp` shown in the UI, `fz64f4uh` from a direct probe). PR #22 was deployed correctly — the fix shipped — but the route's catch path only echoed the LAST error in the chain, hiding the actual cause.

Root cause, surfaced by directly probing `/api/analyze` with the user's image:

```
Google API error: 429 — Quota exceeded for metric:
generativelanguage.googleapis.com/generate_content_free_tier_requests,
limit: 0, model: gemini-2.0-flash
```

`limit: 0` means this project's API key has zero free-tier allowance for `gemini-2.0-flash` specifically — even though `gemini-2.5-flash` on the same key still has the standard 1500 req/day. Google can quietly retune per-project per-model free-tier policy, and a single hardcoded model id is one such policy change away from outage.

Separate but related: the Cloudflare primary is also failing on this image (we see `failedJson:""` and a fast `durationMs:548`, meaning `env.AI.run` threw rather than returning bad JSON). The route was discarding `cfErr.message` after falling through to Google, so operators looking at the 503 response could only see Google's 429 and had no signal about the primary failure.

**Fix** — two-part:

1. **Cascade, don't hardcode.** Introduced `GEMINI_VISION_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash']` exported from `lib/ai-providers.ts`. `attemptGoogleInference` walks the list in order, returning the first model that responds 200, skipping on 404 (model retired) or 429 (per-model quota gone), and throwing immediately on any other status (5xx / network — retrying a sibling won't help). Per-model timeout = `floor(totalTimeout / cascade.length)` so the cascade fits inside the caller's budget.
2. **Stop swallowing the primary error.** Captured `cfErr.message` into a route-scoped `primaryProviderError` and added it as a top-level field on the 503 response body, so future failures surface BOTH the primary and fallback errors. No more "Google 429 only" responses hiding a CF binding outage.

Touched:
- `lib/ai-providers.ts` — added exported `GEMINI_VISION_MODELS` cascade + `GeminiVisionModel` type. Chat fallback (`callGemini`) now references `GEMINI_VISION_MODELS[0]` instead of a literal id; same single-source-of-truth contract as scan.
- `app/api/analyze/route.ts` — `attemptGoogleInference` rewritten as a `for…of GEMINI_VISION_MODELS` loop with 404/429 fall-through. Returns `{parsedJson, rawResponse, model}` so `usedModel` reflects the model that actually answered (e.g. `google-gemini-2.5-flash`). Outer 503 catch now includes `primaryProviderError`.
- `app/[locale]/scan/page.tsx` — replaced the hardcoded `=== 'google-gemini-2.0-flash'` ternary with a `modelDisplayName(modelUsed)` helper that handles any `google-gemini-*` id. Future cascade additions render correctly without touching the page.
- `tests/analyze-fallback.test.ts` — rewritten to assert (a) `GEMINI_VISION_MODELS` is non-empty and every entry passes the gemini/non-gemma/non-`-latest` invariants, (b) the route imports the constant and iterates it (no hardcoded `const model = 'gemini-…'`), (c) the route surfaces `primaryProviderError`, (d) the scan page uses `startsWith('google-gemini-')`, (e) the chat call references `GEMINI_VISION_MODELS[0]`. Suite passes 5/5; project total 100/100.
- `README.md` — Smart Inference Pipeline + Tech Stack sections updated to describe the cascade.

Validation: probed live `https://shinnyguide.autobahn.bot/api/analyze` with the user's actual image after deploy — see PR description for the curl probe and `200` response.

### Fixed — Google retired the `gemini-1.5-flash-latest` alias; scan + chat fallback broken

User report: scan upload still returns `503 "Food analysis is temporarily unavailable"` after the previous Gemma → Gemini swap (Request IDs `brxqf5nr`, `2s24bp5i`). Probing `/api/analyze` directly surfaced the upstream error in the response body's `details` field:

```
Google API error: 404 — models/gemini-1.5-flash-latest is not found for
API version v1beta, or is not supported for generateContent.
```

Root cause: Google retired the `-latest` alias from the `v1beta` Generative Language API in May 2026 without notice. The chat path uses the same model but Groq is first in its cascade, so the Gemini fallback there had also been silently broken without ever being exercised.

**Fix:** swap to `gemini-2.0-flash` — current canonical free-tier vision model, GA since Feb 2025, multimodal (same `inline_data` payload shape), free quota 1500 req/day. Pin to the explicit version id, **never** a `-latest` alias.

Touched:
- `app/api/analyze/route.ts` — `gemini-1.5-flash-latest` → `gemini-2.0-flash`; identifier `'google-gemini-1.5-flash'` → `'google-gemini-2.0-flash'`. Inline comment now records both incidents (Gemma text-only April 2026, alias-retirement May 2026) so the next person doesn't reach for a `-latest` alias.
- `app/[locale]/scan/page.tsx` — "analyzed by" footer reads "Gemini 2.0 Flash".
- `lib/ai-providers.ts` — chat cascade Gemini step also swapped to `gemini-2.0-flash` (single source of truth across scan + chat).
- `tests/analyze-fallback.test.ts` — added 4th invariant: model id must NOT match `/-latest$/`. Added 4th case that checks `lib/ai-providers.ts` stays on the same explicit non-alias id. Suite passes 4/4.

### Fixed — `/api/analyze` had no real vision fallback (April 2026)

User report: scan upload returns `503 "Food analysis is temporarily unavailable"` (Request ID `7063ch9g`). Root cause: `attemptGoogleInference` in `/api/analyze` used `gemma-3-27b-it` as the fallback model. Free-tier availability of Gemma 3 multimodal on Google's Generative Language API is inconsistent in practice, so a Cloudflare Workers AI primary failure left the route with **no working vision fallback** — the second provider couldn't process the image either. Both attempts failed, route returned the catch-all 503, and the user-facing copy ("AI under high load") implied a transient issue when the fallback was structurally broken.

**Fix:** swap the Google fallback to a vision-capable Gemini model (the same one `lib/ai-providers.ts` uses for chat) and add `tests/analyze-fallback.test.ts` regression cases that read the route source and assert the model is in the Gemini family — guards against a future contributor silently reverting to text-only Gemma.

### Added — AI Coach Shinny (chat)

- **`/[locale]/chat` page** — conversational coach UI. Persisted history in localStorage, last 10 turns sent as context, retry-on-failure, daily-quota nudge that links to `/pricing`.
- **`POST /api/chat` endpoint** — auth-gated, tier-quota-gated (`aiQuestionsPerDay`: free=3, premium/family=∞), zod-validated, rate-limited (20/min/IP), persists both turns to `chat_messages`. Locale-aware system prompt builds Shinny's persona per `th`/`en`/`de`/`da`.
- **`lib/ai-providers.ts`** — three-stage chat-completion fallback:
  1. **Groq** (`llama-3.3-70b-versatile`, free 30 req/min, sub-300ms) — primary when `GROQ_API_KEY` is set.
  2. **Google Gemini** (`gemini-2.0-flash`, free 1500 req/day) — fallback, reuses the existing Gemini key.
  3. **Cloudflare Workers AI** (`@cf/meta/llama-3.3-70b-instruct-fp8-fast`) — safety net using the `env.AI` binding the scan path already uses.
  Each step is independently timed-out; the function never throws.
- **`lib/chat-prompts.ts`** — Shinny's system prompt, locale-keyed. Bakes the three brand rules in concrete language: never forbid food, warm older-sister tone, stay-in-scope. Thai prompt explicitly forbids parenthetical romanization (the karaoke-spelling regression from PR #15).
- **Dashboard nav card** — links to `/chat` from the dashboard so users discover it after their first scan.
- **`GROQ_API_KEY` env var** documented in `.env.example`. When unset, the route gracefully degrades to Gemini → CF cascade.
- **28 new vitest cases** locking the persona, fallback chain, schema, and "never throws" contracts. Suite total: **95 tests** (was 67).

### Fixed — auth routes resilient to half-applied migrations

- **`/api/auth/login`, `/me`, `/register`, `/promo/redeem`, `/analyze`** all switched from unqualified `db.select()` (which selects every schema-declared column) to explicit-column `db.select({ ... })`. The schema declares newer columns (`is_admin` from migration 0002, `scope`/`notes` from 0003); if those haven't been applied to the live D1 yet, an unqualified `select()` errors with "no such column" and login becomes a 500 across the board. Reported as "Internal server error" on login attempts in production. The fix makes every read side resilient to additive schema changes that haven't been wrangler-applied yet, and is also a small perf win (smaller wire size, fewer columns to deserialize).

### Added — voucher-gated registration (pilot launch)

- **`/api/voucher/check?code=…`** — read-only voucher validator the registration UI hits as the user types. Returns a uniform `{ valid, reason, scope, remainingSeats, expiresAt, grantTier, trialDays }` shape (HTTP 200 for both valid and invalid; UI branches on the `valid` field, never on status code, so we don't leak "exists-but-exhausted" vs "doesn't exist" via 404).
- **`/api/auth/register`** is now voucher-gated when `VOUCHER_REQUIRED_FOR_REGISTRATION=true` is set on Cloudflare Pages. Voucher is read + redeemed atomically with the user-row insert — no orphan accounts on partial failure, no double-consumed seats. The flag is opt-in so existing deploys stay open until the operator flips it.
- **Registration UI** (`/login` register tab) gains a voucher-code input with a 350 ms debounced live check, valid/invalid inline feedback, and an `AbortController` against the previous request so a stale response can't overwrite the latest. Submit button is disabled while the check is in flight or if the typed code is rejected.
- **`/admin/promo`** rebuilt around two scopes:
  * **Registration vouchers** — the new pilot-gating codes
  * **Upgrade promos** — the original tier-upgrade codes (unchanged behaviour)
  * Tabs switch between scopes; each lists its own table.
  * Create form gains: kind toggle (Personal = `usageLimit=1` / Organization = N), random-suffix generator, expiry-date picker, free-text "notes" field, scope hidden field bound to the active tab.
  * Each row shows: copy-to-clipboard button, Personal/Organization badge, usage bar with red/amber/green tone, days-until-expiry, `[ADMIN_ACTION]` audit log on every action.
- **Migration 0003** — `promo_codes` gains `scope TEXT NOT NULL DEFAULT 'upgrade'` and `notes TEXT`. Non-destructive; existing rows default to upgrade scope so nothing breaks.

### Added — edge rate limiting

- **`lib/rate-limit.ts`** — sliding-window per-IP rate limiter built on the Workers `caches.default` API. No new dep, no KV/DO bindings to provision. Per-route policies:
  * `auth-login`: 10 attempts / 15 min — blocks brute force without flagging a real user fat-fingering
  * `auth-register`: 3 attempts / 15 min — blocks rapid sign-up spam once a valid code is known
  * `voucher-check`: 30 / min — blocks code enumeration; plenty for an honest typing user
- Returns a uniform 429 with `Retry-After` + `X-RateLimit-*` headers; fails OPEN if the cache API is unavailable so legitimate traffic isn't blocked by a limiter outage.

### Fixed — login button stuck disabled (regression in PR #12)

- Auth-store initial `isLoading: true` was stuck `true` because nothing called `initAuth()` on mount of `/login`. The submit button's `disabled={isLoading}` gate was therefore permanently on. Tracked + fixed in PR #14: initial state is now `false`, and `/login` calls `initAuth()` in a `useEffect` on mount (side-benefit: a returning user with a valid session cookie auto-redirects to `/dashboard` instead of seeing the login form).

### Known follow-ups

- **Voucher seat-claim race**: today the register route reads the voucher row, then inserts the user, then inserts the redemption row. D1 doesn't expose a transaction API to the Workers runtime, so two concurrent registrations against a 1-seat voucher could in theory both pass the read. Acceptable for pilot scale; the `code_redemptions(user_id, code_id)` UNIQUE index from migration 0001 prevents *the same user* from double-claiming. Tracked for post-pilot hardening — the right answer is either the new D1 transaction API (in beta) or a Durable Object claim queue.
- **Playwright smoke for login**: the stuck-button regression slipped through every static gate (tsc, vitest, build) because no test actually clicks the login button. A Playwright happy-path script that types email/password and asserts the navigation would catch this whole class of bug. Tracked in `docs/KNOWN_ISSUES.md`.
- **Email delivery for voucher distribution**: vouchers are currently distributed by the operator out-of-band (paste into chat, share via Slack/email). Once email is wired up, an `/admin/promo/send` endpoint could mail a personal voucher straight to a recipient.

### Added — admin console
- **New `/admin` area** gated by `requireAdmin()` / `requireAdminApi()` helpers in `lib/admin-auth.ts`. Non-admins are silently redirected to `/login` (no "admin required" message — intentional, to avoid revealing the admin area's existence).
- **`/admin`** landing with live stats: registered users, admin count, active sessions, scans & scan-errors in the last 24h, active promo codes.
- **`/admin/users`** — paginated list (25/page) with per-row `Grant/Revoke admin` and subscription-tier dropdown. Server ensures an admin cannot revoke their own admin bit (would lock everyone out if they're the only admin).
- **`/admin/promo`** — promo-code list + inline "Create new" form + per-row "Deactivate / Reactivate" toggle. Create endpoint validates the code pattern (`A-Z0-9_-`) and returns 409 on duplicate.
- **`/admin/health`** — wraps the `/api/health?verbose=1` data (AI / DB / Google-key status, runtime detection) in a readable UI. Secret-pattern env var names still hidden.
- **DB prerequisite** `users.is_admin` (migration `0002_add_user_is_admin`) shipped in PR #11. `/api/auth/register` does NOT set it, so public sign-up can't create admins.
- **Vitest coverage** for `admin-auth`: 9 tests covering session-absent, expired-session, non-admin (with WARN log), admin-success paths for both the page helper (`requireAdmin`) and the API helper (`requireAdminApi`).
- **Audit logging** — every admin action (toggle admin, flip tier, create promo, toggle promo) emits `logger.warn('[ADMIN_ACTION] …')` with actor email, target, and before/after values so the Cloudflare log stream becomes an informal audit trail.

### Added — project-hardening phases
- **i18n drift CI gate** (`scripts/check-i18n-keys.mjs`, `npm run check:i18n`). Scans every `useTranslations('ns')` + `t('key')` call and verifies each key exists in `th/en/de/da`. Catches the class of bug that let `scan.dishes_found` ship to production in PR #7.
- **Frontend Vitest infra** (`vitest.config.ts`, `tests/setup.ts`). 34 tests across `crypto`, `ai-prompt`, and `schemas` — locks the PR #6–#8 security and prompt-logic fixes.
- **Zod request validation** at every `/api/*` boundary (`lib/schemas.ts`). Login, register, promo/redeem, analyze now `safeParse` their bodies and return a uniform `{ error, fields }` shape on failure. No more ad-hoc `const { x, y } = await req.json()` + null-checks; no more `any`-typed request bodies.
- **`npm run check:all`** as the single command contributors run before pushing: `type-check + check:i18n + test`.
- **`docs/ITERATION_PROCESS.md`** — defines the zero-error-navigation process each PR follows (local loop → CI loop → CF preview smoke → merge → post-merge verification → iterate).

### Fixed — promo double-redemption race (previously deferred from PR #8)
- `code_redemptions(user_id, code_id)` now has a `UNIQUE` index (Drizzle migration `0001_promo_unique_redemption`). The `/api/promo/redeem` route re-orders its steps so the INSERT (the race-safe claim) runs *before* the user-tier UPDATE, and catches the UNIQUE-constraint driver error to return the same 400 as the pre-check — indistinguishable responses, no race-window side-channel.

### Security
- **Fixed: expired sessions accepted on `/api/promo/redeem`** — the redemption endpoint previously looked up sessions by token only, not by `expiresAt`. A user holding an expired-but-uncleaned token could still redeem promo codes. Now matches the check in `/api/auth/me` (`eq(token) AND gt(expiresAt, now)`).
- **Fixed: timing side-channel in password verification** — `verifyPassword` used `hexA === hexB` to compare the derived hash with the stored hash, which short-circuits on the first differing byte and leaks timing information about the hash prefix. Replaced with a byte-wise XOR-accumulator `constantTimeEqual` helper that walks the full buffer regardless of where the mismatch is. (Node's `timingSafeEqual` isn't available on the Cloudflare Workers edge runtime, so we implement the primitive ourselves.)
- **Fixed: race + error-leak on `/api/auth/register`** — concurrent registrations with the same email could both pass the pre-check and hit the DB unique constraint, surfacing the raw driver message ("UNIQUE constraint failed: users.email") to the client. The race is now caught around the insert and translated to the same generic 409 as the pre-check, so the response is indistinguishable between the two paths.
- **Fixed: `error.message` no longer returned in 500 responses** on `/api/auth/login`, `/api/auth/register`, `/api/auth/me`, and `/api/promo/redeem`. The full error is still logged server-side, but clients receive a clean `{ error: "Internal server error" }`.

### Known follow-ups
- ~~`code_redemptions` unique index~~ — shipped in project-hardening phase 4 (migration `0001_promo_unique_redemption`).
- **Rate limiting** on `/api/auth/login`, `/register`, `/analyze`, `/promo/redeem` — no throttling today. Brute force and abuse of expensive AI calls are possible. Planned: edge-cache-based sliding window per IP. Tracked in `docs/KNOWN_ISSUES.md`.
- **Legacy SHA-256 fallback** in `lib/crypto.ts` — still present for backward compat. Tracked for retirement after a 30-day observation window.
- **Empirical prompt evaluation** — no CI harness for prompt quality regressions. Tracked in `docs/KNOWN_ISSUES.md`.
- **FK indexes** on `sessions.user_id` and `code_redemptions.user_id` — lacking secondary indexes; full-scans acceptable at current scale.

### Fixed
- **No more "karaoke" romanization in Thai output**: the Thai locale instruction now explicitly forbids phonetic transliterations / English translations in parentheses (e.g. `ซุปปลา (Soup Pla)`). Same rule applied for de / da / en so the model no longer volunteers unwanted translations. Native Thai users see clean Thai text.
- **Dish ↔ source-photo linkage for multi-photo scans**: each `DishCard` now shows a small thumbnail of the specific uploaded photo the dish was identified from, so users can immediately see which tile produced which analysis. Backed by a new optional `sourcePhotoIndex` field on `AiDishAnalysis`; the validator guarantees a deterministic index (model value, clamped to the valid range, with array-index fallback) so the UI never has to branch on undefined.

### Changed
- Strengthened the meal prompt: the collage-mode preamble and final reminder now both tell the model to emit `sourcePhotoIndex` per dish, in addition to the existing "one entry per tile" constraint. The JSON schema example in `AI_PROMPT_MEAL` includes the field so the model has a concrete target shape.

## [2.1.9] - 2026-03-17

### Added
- ðŸ“¸ **Multi-Photo Scan (Collage System)**: Users can now upload multiple photos for a single meal analysis (Free: up to 3, Premium/Family: up to 10).
- ðŸ–¼ï¸ **Client-Side Image Stitching**: Engineered a frontend canvas stitcher that automatically calculates optimal grid layouts and scales resolution dynamically depending on photo count to preserve AI precision, combining all images before edge upload.
- âœ… **Review Stage UX**: Added a review stage where users can preview their selected photos or remove them before confirming the "Analyze" action.

### Fixed & Improved
- ðŸ—œï¸ **Edge Memory Optimization**: Implemented early compression (1200px max) on file selection before storing images in React state to reduce frontend memory footprint natively.
- ðŸ›¡ï¸ **Stitching Resilience**: The canvas stitcher now gracefully skips empty or broken base64 inputs without failing the entire batch, and handles generic canvas failures gracefully.
- ðŸŒ **Full i18n & UX Polish**: Supported drag-and-drop for multi-file selections, replaced all hardcoded strings with localization keys (EN, TH, DE, DA), and updated the visual loading phase to include a specific "Stitching..." indicator.

---

## [2.1.8] - 2026-03-11

### Added
- ðŸ› ï¸ **Debug Mode & Telemetry**: Added `?debug=1` URL parameter to the scan page, revealing a dark panel with phase timings, model used, and raw AI responses.
- ðŸ“¡ **Health Check API**: Added `/api/health` deployment verification endpoint to monitor AI binding, DB status, and Google fallback key availability (`?verbose=1` for environment diagnostics).
- ðŸ•’ **Client-Side Scan History**: Added `scan-history.ts` module storing the last 10 scans locally with compressed thumbnails, works independently of auth.
- ðŸŽ¨ **Enhanced Scan UX**: Implemented phased loading indicators ("Compressing â†’ Analyzing â†’ Processing"), added a prominent overall score badge, and integrated AI-generated tip cards directly into the results UI.

### Changed
- ðŸ§  **Structured AI Sequencing**: Refactored the AI prompt to enforce a strict `{step, emoji, items, category}` array format instead of flat strings, eliminating brittle string parsing in the client.
- âš™ï¸ **Dynamic Spike Reduction**: The `spikeReduction` percentage is now dynamically calculated by the AI rather than hardcoded to 60%.
- ðŸš€ **Memory Optimization**: Eliminated `Array.from()` memory waste in the API layer, improving base64 to byte conversion efficiency.

---

## [2.1.7] - 2026-03-10

### Changed
- ðŸ§  **Super Fallback Upgrade**: Upgraded the Google AI fallback model from `gemini-2.0-flash` to the newly released **`gemma-3-27b-it`**. This model provides superior multimodal capabilities and better reasoning for complex food scenes while acting as our highly reliable secondary layer.

---

## [2.1.6] - 2026-03-10

### Added
- ðŸ›¡ï¸ **Triple-Layer AI Fallback**: Implemented a highly resilient multi-provider fallback strategy: Cloudflare Llama 11B -> Google Gemini 2.0 Flash -> Cloudflare Llama 3B. This ensures scanning works even during provider outages.
- ðŸš€ **Google Gemini Integration**: Added native `fetch`-based integration for Google AI to maintain a lightweight Edge bundle.

---

## [2.1.5] - 2026-03-10

### Added
- ðŸ›¡ï¸ **AI Model Fallback**: Implemented automatic fallback from Llama 3.2 11B Vision to the faster 3B model if the primary model fails or times out. This significantly reduces "temporarily unavailable" errors during peak load.
- ðŸ“¡ **Granular Error Reporting**: Improved error responses to distinguish between primary and fallback failures.

---

## [2.1.4] - 2026-03-10

### Changed
- ðŸ”§ **AI Timeout Increase**: Increased AI inference timeout from 25s to 35s to better accommodate the Llama 3.2 11B Vision model on Cloudflare Workers.
- ðŸ“¡ **Enhanced Debug Logging**: Added granular phase tracking (`AI_AWAITING_RESPONSE`), prompt length logging, and error code capturing for AI failures.
- ðŸ›¡ï¸ **Improved Error Messages**: Added specific user-facing messages for AI timeouts to distinguish from generic service failures.

---

## [2.1.3] - 2026-03-02

### Changed
- ðŸ—ï¸ **Architectural Refactor**: Extracted Cloudflare binding access logic into a shared helper `src/lib/cloudflare.ts`. All 6 API routes now use `getEnv()` or `getEnvSafe()`. This prevents future regressions caused by the broken `(req as any).context?.env` pattern.

---

## [2.1.2] - 2026-03-02

### Added
- ðŸ›¡ï¸ **Fault-Tolerant API Pipeline**: Rewrote the `/api/analyze` route into a 10-phase pipeline. Session and Database initialization failures are now gracefully caught, allowing the main AI scan to succeed even if the Auth or DB layers are temporarily down.
- â±ï¸ **Zero-Hang Server Timeouts**: Added a server-side 25-second `Promise.race` timeout to the AI inference call to prevent the Cloudflare Worker from hanging indefinitely and hitting hard execution limits.
- ðŸ†” **Request Tracing**: Added short `requestId` generation to every request. This ID is displayed on the UI error screen and tracks the request linearly across all logs.
- ðŸ›¡ï¸ **Client-Side File Validation**: Added early validation to reject corrupt (<500B), non-image, and oversized (>15MB) files immediately before compression.

### Fixed
- ðŸ› **Cloudflare Binding Access**: Replaced broken `(req as any).context?.env` pattern with official `getCloudflareContext()` from `@opennextjs/cloudflare` in all 6 API routes. This was the root cause of the "AI binding is not configured" error â€” the env object was always `undefined`.
- ðŸ› **Internal Server Error on Base64 Decode**: Replaced Node.js `Buffer.from()` base64 decoding with Edge-safe native `atob()` and `Uint8Array`. This fixes silent pipeline crashes in the Cloudflare runtime.
- ðŸ› **Crash on Malformed AI JSON**: Added strict post-processing sanitization for AI outputs. Missing or malformed keys are coerced into safe defaults to prevent React render crashes.
- ðŸ”§ **Project Name**: Fixed `wrangler.toml` and `package.json` deploy script to use correct Cloudflare project name `eatinorder`.

---

## [2.1.1] - 2026-03-02

### Added
- â±ï¸ **Robust AI Fetching**: Added a 30-second `AbortController` timeout to the food scan API request.
- ðŸ”„ **Auto-Retries**: Implemented automatic single-retry for transient 503 errors from Cloudflare Workers AI.
- ðŸ“¡ **Deep Diagnostic Logging**: Added 7 new scan-specific diagnostic methods to `logger.ts` tracking 20 distinct points across the client upload, compression, API boundary, and DB insertion phases. Include payload sizes and `durationMs`.

### Fixed
- ðŸŒ **Missing i18n Keys**: Added missing error state and low-confidence translations to all 4 locale files (`en`, `th`, `de`, `da`).
- ðŸ› **Broken Fallbacks**: Removed fragile `||` string fallbacks from the scan page error display which failed due to `next-intl` returning truthy key paths. 

---

## [2.1.0] - 2026-02-26

### Changed
- ðŸ§  **Vision Model Upgrade**: Replaced the weak `@cf/llava-hf/llava-1.5-7b-hf` model with the much more capable **`@cf/meta/llama-3.2-11b-vision-instruct`**.
- ðŸ› ï¸ **"Identify-First" AI Pipeline**: Rewrote the AI extraction prompt to identify the food FIRST rather than assuming everything is a prepared Thai dish. This fixes major misidentification bugs (e.g., misclassifying raw fruits as Som Tam).

### Removed
- ðŸ—‘ï¸ **Mock Fallbacks Removed**: Removed the hardcoded mock fallback data ("Pad Thai" / "Som Tam") from both the API route and the frontend catch block.

### Fixed
- ðŸ› **Silent AI Failures**: Fixed an issue where AI inference failures were silently masked by mock data holding a fake 90% confidence score. The app now displays an honest error state UI with the Shinny mascot explaining the failure.
- ðŸ› **Confidence Score Default**: Fixed leftover code defaulting confidence to 90% when missing; it now correctly defaults to 0%.

---

## [2.0.0] - 2026-02-26
 
### Added
 
#### App Pages
- ðŸ“¸ **Scan Page**: Drag-and-drop food photo upload with simulated AI analysis. Shows detected ingredients, nutrition breakdown, optimal eating sequence (Veggies â†’ Protein â†’ Carbs â†’ Sweets), spike reduction percentage, and 8-dimension health scores with tier-gated visibility.
- ðŸŽ“ **Demo Page**: Interactive 4-step walkthrough of food sequencing science. Includes animated blood sugar curve comparison (with/without sequencing) and CTAs to scan or register.
- ðŸ” **Login Page**: Tabbed login/register form with email validation, password visibility toggle, promo code redemption section, Google & LINE social login buttons (styled, coming soon), and auto-redirect to dashboard on success.
- ðŸ“Š **Dashboard Page**: Authenticated member dashboard with quick stats (scans used, streak, points, level), daily challenge, recent scans list, trial expiry warnings, and upgrade CTAs for free-tier users.
- ðŸ’° **Pricing Page**: Three-tier comparison cards (Free/Premium/Family) with monthly/annual toggle, feature checklists, enterprise CTA, promo code input, and FAQ accordion.
 
#### Member System
- ðŸ‘¤ **Auth Store**: Zustand-based authentication with `localStorage` persistence. Supports login, register, logout, promo code redemption, scan/AI question tracking, and points system. Ready for Cloudflare D1 backend swap.
- ðŸŽŸï¸ **Promotion Code System**: Supports TRIAL, DISCOUNT, FANCLUB, and REFERRAL code types. Built-in demo codes: `SHINNY2024` (30-day Premium), `EATWELL` (7-day trial), `LAUNCH50` (50% off), `FAMILY2024` (14-day Family trial).
- ðŸ”’ **Feature Gating**: `tier-config.ts` maps features to Free/Premium/Family tiers with configurable limits (scans/month, AI questions/day, recipe access, score dimensions).
- ðŸ—„ï¸ **Database Schema**: Added `promo_codes`, `code_redemptions`, and `sessions` tables. Extended `users` table with `display_name`, `trial_expires_at`, `promo_source`, `scans_this_month`, `streak_days`, `total_points`.
 
#### Business Development
- ðŸ’¼ Freemium pricing: Free (10 scans/mo) â†’ Premium (à¸¿199/mo) â†’ Family (à¸¿299/mo)
- ðŸ“ˆ Annual pricing with ~30% discount
- ðŸ¢ Enterprise/Corporate Wellness placeholder
- ðŸŽ¯ Usage tracking via logger for conversion funnels
 
#### Documentation
- ðŸ“„ Updated `README.md` and `README-TH.md` with feature table, promo codes, and business development
- ðŸ“ Created `docs/claude.md` and `docs/gemini.md` â€” project guides for AI assistants
- ðŸ’° Updated `research/business/monetization.md` with promo code strategy
- ðŸ“‹ Updated `CHANGELOG.md` with v2.0.0 entry
 
#### Previous (Unreleased)
- ðŸ‘©â€ðŸ« **Shinny Mascot Integration**: Rebranded to **Shinny** with "Live long to eat well" philosophy
- ðŸ“‚ Business strategy research documents
- ðŸŒ i18n updates for mascot across all languages
- ðŸ”— Themed placeholder pages for all routes
- ðŸ“± Mobile hamburger menu and responsive header
 
### Planned Features
- Restaurant menu scanning
- Barcode scanner integration
- Real AI food analysis via Cloudflare Workers AI
- Payment integration (PromptPay, Rabbit LINE Pay)
- Social login (Google, LINE)
- Fitness tracker integration
- Voice input support
 
---
 
## [0.2.2] - 2026-02-23
 
### Fixed
- ðŸš€ **Cloudflare Deployment**: Resolved OpenNext compatibility issues by updating `compatibility_date` to `2024-09-23`.
- â˜ï¸ **Cloudflare D1 Setup**: Successfully initialized D1 database `nutri-vision-d1` and mapped its ID in `wrangler.toml`.
- âš™ï¸ **Deployment Script**: Fixed Powershell execution issues for deployment scripts.
- ðŸ› ï¸ **Deployment Automation**: Replaced `prepare-pages.sh` with a cross-platform Node.js script and fixed `npx wrangler pages deploy` directory resolution on Windows.
 
---
 
## [0.2.1] - 2026-02-23
- ðŸ› ï¸ **i18n Refinements**: Replaced hardcoded Thai strings in the UI with dynamic translation keys.
- ðŸ”— **Locale Routing**: Fixed hardcoded locale paths in navigation links to use current user locale.
- ðŸš€ **SEO & Performance**: 
  - Added SEO metadata to the main layout.
  - Optimized font loading for `Inter` and `Sarabun` (Thai).
  - Added `antialiased` class for smoother text rendering.
  - Added missing `drizzle-orm` dependency for edge database schema.
 
---
 
## [0.2.0] - 2026-02-23
 
### Added
- ðŸŒ **Internationalization (i18n)**: Added Danish (`da`) and German (`de`) language support via `next-intl`.
- ðŸŽ¨ **UI/UX Revolution**: 
  - Dynamic Glassmorphism aesthetic.
  - "à¸­à¸£à¹ˆà¸­à¸¢ à¸•à¸²à¸¡ à¸¥à¸³à¸”à¸±à¸š" (Delicious in Order) active sequencing guide component.
  - New modern typography (`Inter`, `Outfit`) integrated alongside `Sarabun`.
 
### Changed
- â˜ï¸ **Infrastructure Paradigm Shift**: Migrated from Dockerized FastAPI & PostgreSQL to a fully serverless Cloudflare architecture.
  - Replaced PostgreSQL with **Cloudflare D1** (SQLite) using Drizzle ORM.
  - Switched Next.js builds to Edge Worker compatibility via **OpenNext** (`@opennextjs/cloudflare`).
  - Shifted AI services to use the Cloudflare Workers AI token.
 
### Removed
- Removed Docker/docker-compose requirements and FastAPI backend codebase dependencies.
 
---
 
## [0.1.0] - 2025-01-17
 
#### Core Features
- ðŸ” **AI Food Recognition**: Image analysis using Google Gemini Vision API
- ðŸ“Š **8-Dimension Nutrition Scoring System**:
  - Blood Sugar Impact scoring
  - Gut Health scoring
  - Inflammation scoring
  - Nutrient Density scoring
  - Processing Level scoring
  - Protein Quality scoring
  - Micronutrient Coverage scoring
  - Overall Health Score calculation
- ðŸœ **Thai Food Specialization**:
  - 1000+ Thai recipes database
  - Thai ingredients database
  - Thai measurement conversions
  - Cultural context integration
- ðŸ’¬ **AI Nutrition Coach**: Interactive chat with AI nutritionist
- ðŸ“± **Mobile-First PWA**: Progressive Web App with offline capabilities
- ðŸŒ **Bilingual Support**: Full Thai and English internationalization
- ðŸ‘¤ **User Authentication**: Email/password registration and login
- ðŸ“ˆ **User Dashboard**: Personal nutrition tracking and history
- ðŸ”’ **GDPR Compliance**: Data export, right to be forgotten, consent management
 
#### Technical Infrastructure
- **Backend**: FastAPI with async support
- **Frontend**: Next.js 14 with App Router and React 18
- **Database**: PostgreSQL with SQLAlchemy ORM
- **Caching**: Redis for sessions and caching
- **AI Integration**: Google Gemini API for vision and chat
- **Containerization**: Docker and Docker Compose setup
- **Database Migrations**: Alembic for schema versioning
- **Testing**: Pytest for backend, Jest for frontend
- **Code Quality**: Black, Flake8, MyPy, ESLint, Prettier
 
#### Documentation
- Comprehensive README with setup instructions
- API documentation with OpenAPI/Swagger
- Project plan and architecture documentation
- Deployment guide
- Environment configuration examples
- Thai language documentation (README-TH.md)
 
#### Security
- Password hashing with bcrypt
- JWT token authentication
- CORS protection
- Rate limiting on all endpoints
- SQL injection prevention with parameterized queries
- XSS protection
- CSRF tokens
- Environment-based secrets management
 
#### Developer Experience
- Docker Compose for local development
- Hot reload for both frontend and backend
- Database seeding scripts
- Comprehensive npm scripts for common tasks
- TypeScript support with strict type checking
- Python type hints throughout backend
 
### Changed
- N/A (Initial release)
 
### Deprecated
- N/A (Initial release)
 
### Removed
- N/A (Initial release)
 
### Fixed
- N/A (Initial release)
 
### Security
- Implemented comprehensive security measures (see Security section above)
 
---

## Release Notes Format

### Types of Changes
- `Added` - New features
- `Changed` - Changes in existing functionality
- `Deprecated` - Soon-to-be removed features
- `Removed` - Removed features
- `Fixed` - Bug fixes
- `Security` - Security improvements

### Version Numbering
We use Semantic Versioning (SemVer):
- **MAJOR** version for incompatible API changes
- **MINOR** version for new functionality in a backwards compatible manner
- **PATCH** version for backwards compatible bug fixes

Example: `1.2.3`
- `1` = Major version
- `2` = Minor version
- `3` = Patch version

---

## How to Update This Changelog

When making changes:

1. Add your changes under the `[Unreleased]` section
2. Use the appropriate category (Added, Changed, Fixed, etc.)
3. Write clear, user-focused descriptions
4. Include issue/PR numbers when applicable
5. When releasing, move `[Unreleased]` items to a new version section

Example entry:
```markdown
### Added
- feat(nutrition): Add omega-3 to omega-6 ratio calculation (#123)
  - Implements inflammation score component
  - Supports both marine and plant-based sources
```

---

## Links

- [Project Repository](https://github.com/bejranonda/Nutri-Vision-AI)
- [Issue Tracker](https://github.com/bejranonda/Nutri-Vision-AI/issues)
- [Contributing Guidelines](CONTRIBUTING.md)
- [License](LICENSE)

---

**Made with â¤ï¸ for the Thai community**

*"à¸­à¸±à¸›à¹€à¸”à¸•à¹€à¸žà¸·à¹ˆà¸­à¸ªà¸¸à¸‚à¸ à¸²à¸žà¸—à¸µà¹ˆà¸”à¸µà¸‚à¸¶à¹‰à¸™" - Updates for better health*
