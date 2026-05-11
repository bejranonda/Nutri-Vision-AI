# ⚠️ Known Issues - Nutri-Vision AI (EatInOrder)

This document lists currently identified bugs, limitations, and ongoing technical challenges in the EatInOrder project.

## 🐛 Open Bugs

### 1. Placeholder Content
- **Current Status**: Several pages (Scan, Dashboard, Recipes) are currently implemented as "Coming Soon" placeholders.
- **Priority**: High (Functional Roadmap).
- **Target**: v1.1.0 and v1.2.0.

### 2. Nutrition Scoring Data Gaps
- **Current Status**: Many foods in the nutrition database lack specific values for micronutrients like Vitamin D or Omega-3:6 ratios, resulting in a default middle score (50).
- **Priority**: Medium (Data Quality).
- **Target**: Integration with a more comprehensive GI/Nutrition API.

## 🚧 Technical Limitations

### 0. Cloudflare Workers AI vision primary (`@cf/meta/llama-3.2-11b-vision-instruct`) frequently fails on real images
- **Current Status**: Live probes show the CF primary throwing an exception (not just returning malformed JSON) on most real food photos. Every successful production scan in the May 2026 sample was served by the Gemini fallback. The cascade absorbs it — users still get results — but the primary is doing approximately zero useful work.
- **Why we still call it first**: When it does work, it's free (uses the `env.AI` binding the Pages plan already includes) and faster than Gemini. We don't want to remove the call until we've diagnosed *why* it's failing (model retired? input format mismatch? per-account quota?). The `primaryProviderError` field on `/api/analyze` 503 responses (shipped PR #23) is the signal we'll use.
- **Mitigation**: Cascade fallback now lands on `gemini-2.5-flash` reliably. No user-visible impact, but every scan costs a Gemini call instead of a free CF call.
- **Tracked**: needs a separate diagnostic PR — read CF AI run logs, or temporarily swap to a different CF vision model (`@cf/meta/llama-3.2-90b-vision-instruct`, `@cf/llava-1.5-7b-hf`) to isolate whether it's account-specific or model-specific.

### 1. Cloudflare Functions Size Limit
- **Current Status**: The frontend build (Next.js + OpenNext) occasionally hits the 1MB script size limit for Cloudflare Workers (Free Tier).
- **Current Mitigation**: `pages:build` script optimization.
- **Future Solution**: Move some logic to a separate Worker or upgrade to the Paid Tier.

### 2. SQLite (D1) vs. PostgreSQL
- **Current Status**: The backend uses SQLAlchemy with SQLite/PostgreSQL, but Cloudflare D1 is SQLite-based. This can cause compatibility issues with complex migrations.
- **Mitigation**: Use Drizzle ORM for the frontend and standard SQLAlchemy for the standalone backend.

### 3. Image Upload Storage
- **Current Status**: Local file storage is used in the development backend (`./uploads`), which is not persistent on Cloudflare Pages.
- **Mitigation**: Plans to integrate Cloudflare R2 for persistent image storage.

### 4. High-Resolution Canvas Memory Limits
- **Current Status**: The Multi-Photo Collage Engine dynamically scales to 2048x2048 for up to 10 photos. Older mobile devices (e.g., older iOS Safari versions) may hit memory limitations when attempting to stitch and compress heavily.
- **Mitigation**: Implemented an "Early Compression" pipeline (v2.1.9) that compresses incoming photos to 1200px max *before* holding them in React state. Also added **Dynamic Canvas Scaling** using the `navigator.deviceMemory` API to restrict max tile size to 500px for models with `< 4GB` of RAM, practically eliminating Safari Out-Of-Memory reloads.

## 📋 Ongoing Investigations

-   **Accuracy of Portions**: AI occasionally overestimates or underestimates portion sizes based on photo angles.
-   **Language Consistency**: Ensuring the AI's "Shinny" persona remains consistent across all 4 languages.

## 🚧 Ongoing Follow-ups (PR-tracked)

### 0a. Voucher-registration follow-ups
- **Status**: Voucher-gated registration ships as part of the pilot launch. Two limitations to track:
  - **Concurrent seat claim**: D1 doesn't expose a transaction API to the Workers runtime, so two parallel registrations against a 1-seat voucher could in theory both read it as valid. Acceptable at pilot scale; the `code_redemptions(user_id, code_id)` UNIQUE index from migration 0001 prevents the *same user* from double-claiming. Tracked for post-pilot — fix path is either the in-beta D1 transaction API or a Durable Object claim queue.
  - **No voucher email delivery**: operators currently share codes by hand. A future `/admin/promo/send` endpoint could mail a personal voucher to a recipient once email is wired up.

### 0b. Admin console — next-phase additions
- **Status**: The `/admin` console (shipped with `is_admin` migration + UI) covers users, promo codes, and health. Remaining gaps on the original spec:
  - **`/admin/scans`** — recent scans across all users, filtered by `errorClass` / `modelUsed`. Useful for spotting AI-pipeline regressions but requires a read-only design decision on PII exposure (photos).
  - **`/admin/logs`** — tail of Cloudflare logs via the GraphQL API. Needs the Cloudflare Account API token surfaced as a Pages secret.
  - **Audit table** — right now `[ADMIN_ACTION]` entries live only in the CF log stream. Persisting them to a dedicated `admin_actions` table would give a queryable audit trail. Requires a schema migration + retention policy.
  - **Rate limit on `/api/admin/*`** — same gap as the public routes (see item 2). Admin routes are gated by auth, so the blast radius is smaller, but brute-forcing a stolen admin cookie would still benefit from throttling.
- **Plan**: split into one PR per item so each ships with its own risk review.

### 1. Retire legacy SHA-256 password-hash fallback
- **Status**: `lib/crypto.ts` currently accepts two hash formats: the new `iterations:salt:hash` PBKDF2 shape written by `hashPassword()` *and* a legacy bare-hex SHA-256 fallback for pre-PBKDF2 accounts. The fallback is cryptographically weak and should be removed once every active account has been re-hashed.
- **Plan**: after a 30-day observation window measuring the `legacy_hash_observed` counter, ship a migration that (a) emails any remaining legacy users a forced password reset and (b) deletes the fallback branch. Regression tests in `frontend/tests/crypto.test.ts` currently *verify* the fallback works; those tests should be deleted in the same PR.

### 2. Rate limiting on auth & scan endpoints
- **Status**: `/api/auth/login`, `/register`, `/analyze`, `/promo/redeem` have **no rate limit**. An attacker can brute-force passwords or abuse the expensive Gemini path without throttling. Cloudflare Pages has built-in Rate Limiting rules but nothing is wired up.
- **Plan**: edge helper `lib/rate-limit.ts` using `caches.default` as an ephemeral per-IP sliding window (no new deps). Apply per-route policies: login 5/15min, register 3/15min, analyze 20/min, promo/redeem 5/min. Return 429 with a `Retry-After` header.

### 3. Empirical prompt evaluation
- **Status**: Every prompt change (e.g. `sourcePhotoIndex` addition in PR #8) ships to 100% of traffic without measurement. The only "validation" is manual spot-check by the developer.
- **Plan**: offline eval harness with ~20 labelled collage fixtures. `npm run eval` scores the current prompt's output (schema compliance + dish count + index range) against the baseline. Runs in CI on any change to `lib/ai-prompt.ts` — fails the PR if regression > 5%.

### 4. DB indexes on foreign-key columns
- **Status**: `sessions.user_id` and `code_redemptions.user_id` are foreign-key columns but lack explicit secondary indexes, so queries like "all sessions for user X" or "all redemptions for user X" full-scan. Acceptable at today's scale but will bite when the user base grows.
- **Plan**: add two `CREATE INDEX` statements in a follow-up migration. Non-destructive — can ship anytime.

---

## ✅ Resolved Issues

### Cloudflare auth (`/memberships` 10000) — D1 migration apply blocked
- **Symptom**: `npx wrangler d1 migrations apply eatinorder-db --remote` failed with `Authentication error [code: 10000]` against `/memberships`, even though `wrangler whoami` succeeded. Hit on wrangler 4.67 *and* 4.86 — not a version regression.
- **Root cause (two stacked problems)**:
  1. The `CLOUDFLARE_API_TOKEN` was created with the obvious scopes (`D1:Edit`, `Workers Scripts:Edit`, `Pages:Edit`, `User Details:Read`) but was missing **`User → Memberships:Read`**. `whoami` only needs `User Details:Read`, so it succeeded — but every other remote command probes `/memberships` first as a token-validation step.
  2. The token has access to **two Cloudflare accounts**. With no account pin, wrangler errored with *"More than one account available… please set `account_id` … or `CLOUDFLARE_ACCOUNT_ID`"*. We tried `account_id` at the top level of `wrangler.toml`, but for **Pages-style configs** (`pages_build_output_dir = …`) `wrangler d1` ignores top-level `account_id` — the env var is the only path that actually works.
- **Fix**:
  - Edited the existing API token to add the **`User → Memberships:Read`** scope.
  - Set `CLOUDFLARE_ACCOUNT_ID` in `frontend/.env.local` (project-scoped — every contributor / CI runner can pin a different account independently). Wrangler 4.x auto-loads `.env.local` for its own auth, so no shell-level export and no wrapper script is needed.
  - Removed the dead `account_id = "…"` line from `wrangler.toml` so future readers don't waste time wondering why it's there but ineffective.
- **Prevention**:
  - `.env.example` now spells out every required token scope including the easy-to-miss `Memberships:Read`.
  - `wrangler.toml` carries an inline comment pointing the next person at `.env.local` instead of letting them re-discover the Pages-config quirk.
  - Recorded as a knowledge-base entry (`docs/KNOWLEDGE_BASE.md` → "Cloudflare wrangler auth") with the exact scope list so future contributors copy-paste the right thing on first try.

### Bug-hunt hardening pass (project-hardening branch)
- **Problems addressed**:
  - `/api/promo/redeem` accepted expired sessions (it didn't check `expiresAt`, unlike `/api/auth/me`).
  - `verifyPassword` short-circuited on the first differing byte — a timing side-channel.
  - `/api/auth/register` leaked the raw DB unique-constraint message on the concurrent-registration race.
  - All four auth/promo routes returned `error.message` in 500 responses — schema / stack disclosure.
  - Promo codes could be double-redeemed via a check-then-insert race.
- **Fixes**:
  - `promo/redeem` now does `and(eq(token), gt(expiresAt, now))`. Added a `CREATE UNIQUE INDEX code_redemptions_user_code_unique` (migration 0001) and re-ordered the route so the INSERT (the race-safe claim) runs before the user-tier UPDATE.
  - `crypto.ts` now uses a byte-wise XOR-accumulator `constantTimeEqual` helper (Node's `timingSafeEqual` isn't available on the Workers edge runtime).
  - `register` catches the UNIQUE-constraint driver error and returns the same 409 as the pre-check.
  - All 500 responses now return opaque `{ error: "Internal server error" }`; full errors are logged server-side.
- **Prevention**: `frontend/tests/crypto.test.ts` locks in the constant-time and round-trip behaviour; `frontend/tests/schemas.test.ts` locks the zod validation; CI runs `npm run check:all` on every PR.

### Missing i18n keys rendering as literal strings in production
- **Root Cause**: `scan.dishes_found` and `scan.score_label` were referenced in `scan/page.tsx` but absent from `messages/th.json` / `en.json` / `de.json` / `da.json`. No automated check compared `t('…')` call sites against locale JSONs, so the drift wasn't caught pre-merge.
- **Fix**: added `scripts/check-i18n-keys.mjs` — walks `src/**/*.{ts,tsx}`, builds a per-file map of `useTranslations('ns')` bindings (handles multi-namespace files like `page.tsx` that use `tNav` / `tBrand` / `tGamify`), and verifies every key exists in every locale. Exposed as `npm run check:i18n` and rolled into `npm run check:all`.
- **Prevention**: CI gate blocks any PR that references a key missing from any locale.

### "Karaoke" romanization in Thai AI output
- **Root Cause**: Gemma 3 27B volunteered phonetic English transliteration in parens (`ซุปปลา (Soup Pla)`) because the Thai locale instruction never forbade it. Native Thai users read this as noise.
- **Fix**: `LOCALE_INSTRUCTION.th` now explicitly forbids Latin letters in parentheses with concrete examples the model can pattern-match. Same rule added to `en`, `de`, `da`.

### Multi-photo scan returning one dish for N photos
- **Root Cause**: PR #6's squash merge silently fell back to a two-parent merge and dropped two commits (the multi-photo client→server `photoCount` plumbing). Re-applied in PR #7. Then: even with `photoCount`, Gemma sometimes returned `dishCount: 1` because the collage instruction was at the start of the prompt and the model "forgot" it once the JSON schema dominated the context.
- **Fix**: `buildCollageInstruction` now emits `{ preamble, reinforcement }`. Preamble goes at the top, reinforcement goes *after* the JSON schema (the last thing the model reads). Both also require `sourcePhotoIndex` per dish so the UI can link each `DishCard` back to its source photo.

## ✅ Earlier Resolved Issues

### Scan Page Monolith Refactor (v2.2.0)
- **Root Cause**: The `scan/page.tsx` file had organically grown to almost 1000 lines, mixing UI state, API polling, compression logic, and local storage side effects, making future feature expansion risky.
- **Fix**: Extracted all specific concerns into three scoped React Hooks (`useScanUpload`, `useScanAnalysis`, `useScanDebug`) and compartmentalized the visual layout into clean presentational components (`ScanUploadArea`, `ScanLoadingOverlay`, `ScanDebugPanel`). The page now serves strictly as an orchestrator.
- **Lesson**: Adopt a composable architecture early. Pushing complex side-effects out of the component scope into dedicated hooks prevents state-syncing bugs when components mount and unmount.

### Internal Server Error on Food Scan (v2.1.2)
- **Root Cause**: All API routes used `(req as any).context?.env` which silently returns `undefined` in the `@opennextjs/cloudflare` runtime. The `env.AI` and `env.DB` bindings were never accessible.
- **Fix**: Replaced with the official `getCloudflareContext()` API from `@opennextjs/cloudflare` across all 6 API routes.
- **Lesson**: Always use `getCloudflareContext()` to access Cloudflare bindings (AI, DB, KV, R2) in Next.js Edge API routes deployed via OpenNext.

### Multi-Ingredient Recognition & Sequence Formatting (v2.1.8)
- **Root Cause**: Earlier versions relied on flat string arrays from the AI for the eating sequence, leading to brittle category extraction and missing localized food names when parsing 10+ ingredients.
- **Fix**: Refactored the AI prompt to enforce a strict `{step, emoji, items, category}` array format instead of flat strings. This completely eliminates manual string-splitting and robustly categorizes elements.
- **Lesson**: Structured JSON output schemas provide far more resilience than unstructured markdown lists, especially as prompt complexity grows.

### AI Inference Timeouts & 503 Errors (v2.1.1 → v2.1.7)
- **Root Cause**: The `@cf/meta/llama-3.2-11b-vision-instruct` model occasionally hits resource limits or capacity issues on Cloudflare Workers AI, leading to 503 "Service Unavailable" or 502 "Bad Gateway" errors.
- **Fix (v2.1.7)**: Implemented a **Dual-Provider Fallback Strategy**. The system attempts the Cloudflare 11B model first (25s timeout); if it fails, it automatically falls back to **Google's `gemma-3-27b-it`** model via the Google AI API.
- **Note on Meta Llama License**: If Cloudflare returns a "Prior to using this model, you must submit the prompt 'agree'" error, you must visit the Cloudflare AI dashboard and manually accept the Meta Llama 3.2 license agreement.

### Scan 503 — three stacked Google-fallback failures (Apr–May 2026)

Three back-to-back incidents on `/api/analyze` produced the same user-visible symptom (`503 "Food analysis is temporarily unavailable. Our AI models are currently under high load."`) from three structurally different root causes. The mitigation that ended the cycle is the **Gemini cascade** in `lib/ai-providers.ts → GEMINI_VISION_MODELS`.

| # | Date | Request IDs | Root cause | Why "dual-provider fallback" didn't save us |
|---|------|-------------|------------|---------------------------------------------|
| 1 | Apr 2026 | `7063ch9g` | Google fallback was `gemma-3-27b-it`, **text-only** on free tier. | The "vision fallback" couldn't actually see images, so a CF primary failure left us with two providers and no working vision path. |
| 2 | May 2026 | `brxqf5nr`, `2s24bp5i` | Google fallback was `gemini-1.5-flash-latest`. Google retired the `-latest` alias from `v1beta` without notice. | A 404 from the alias surfaced as `models/… is not found … or is not supported for generateContent`. The fix in PR #21 (alias swap) shipped to a now-retired endpoint. |
| 3 | May 2026 | `tqunrejp`, `fz64f4uh`, `bfmb11hq` | Google fallback was a hardcoded `gemini-2.0-flash`. Google silently dropped this project's free-tier quota for that exact model to `limit: 0`, while `gemini-2.5-flash` on the same key still had the standard 1500 req/day. | A single hardcoded model id is one Google policy change away from outage. The 429 carried `RESOURCE_EXHAUSTED` for that one model id only. |

**Resolved by PR #23**:
- **Cascade, don't hardcode**. `GEMINI_VISION_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash']` is exported from `lib/ai-providers.ts` and consumed by both `/api/analyze` (vision) and `lib/ai-providers.ts → callGemini` (chat). The route's `attemptGoogleInference` walks the list, returning on the first 200, **skipping on 404 (model retired) or 429 (per-model quota gone)**, throwing on any other status (5xx / network — sibling models won't help). Per-model timeout = `floor(totalTimeout / cascade.length)`.
- **Stop swallowing the primary error**. The route now captures `cfErr.message` into `primaryProviderError` and includes it in the 503 response body. Future 503s carry both the primary and fallback errors so operators aren't blind to "which provider failed first."
- **Regression test** (`frontend/tests/analyze-fallback.test.ts`) locks the cascade invariants: non-empty, every entry `^gemini-`, no `gemma`, no `-latest$`, route imports and iterates the constant, route surfaces `primaryProviderError`, scan page uses `startsWith('google-gemini-')` not a single-id ternary. 100/100 project tests pass.
- **Process gate** added to `ITERATION_PROCESS.md §3`: post-deploy verification must round-trip a real food photo to a populated `dishes` array — a 200 with `isFood:false` (non-food image) is not sufficient evidence the cascade works. Three "fixed" PRs went out in this incident because earlier validation only proved the route returned 200 for a non-food image.

**Lesson**: free-tier policy on any external provider is a moving target. Hardcoding a single model id is a latent bug; cascade across explicit (never `-latest`) ids and skip on the two known per-model failure modes (404 / 429).

### Environment Variable Parsing Failures (v2.1.8)
- **Root Cause**: When appending API keys to `.env` using PowerShell (e.g., `echo "KEY=VAL" >> .env`), PowerShell defaults to **UTF-16LE** encoding. Node.js `fs` reads and most `.env` parsers expect **UTF-8**, resulting in `undefined` variables even if the file looks correct in some editors.
- **Fix**: Re-saved all environment files (`.env`, `.env.local`) with strict **UTF-8** encoding.
- **Prevention**: Use standard text editors or `write_file` tools that default to UTF-8 for environment configuration. Avoid PowerShell `>>` for sensitive `.env` management.

### Non-Food Image Analysis Crashes (v2.1.9)
- **Root Cause**: Uploading images of pets or random objects caused the backend AI to return 422 Unprocessable Entity, which was not gracefully handled by the frontend, leading to unhelpful generic timeout/crash errors constraint.
- **Fix**: Implemented the `isFood` boolean flag within the schema natively. Backends no longer return HTTP 422 for bad images, but HTTP 200 with an explicit `isFood: false` and `nonFoodReason` message gracefully rendered in the UI by the Shinny Mascot.

### Multi-Photo Upload Concurrency & UI Freezing (v2.1.10)
- **Root Cause**: Drag-and-dropping or selecting multiple heavy images concurrently triggered massive CPU spikes as all images attempted Base64 canvas compression simultaneously on the main thread. Additionally, React state race conditions caused the final `setUploadedImages` to overwrite earlier ones if the UI was in a "results" state.
- **Fix**: Implemented `processMultipleFiles` to process uploads strictly sequentially. Replaced parallel `.forEach` loops with an async `for...of` loop that yields to the browser event loop (`await new Promise(r => setTimeout(r, 15))`), keeping the UI responsive. The loop also strictly pre-filters uploads against Tier photo limits before starting any intensive operations.

### Truncated JSON on Menu/Multi-Dish Scans (v2.1.9)
- **Root Cause**: Google Gemma fallback was restricted to `maxOutputTokens: 1024`, meaning complex Thai food scans (e.g., 10 item menu scans) routinely clipped the trailing JSON object closures.
- **Fix**: Increased `maxOutputTokens` from 1024 to 4096. Additionally implemented `safeParseJson` algorithm extracting `{...}` bounds directly if standard `JSON.parse` fails from prepended conversational text. 
