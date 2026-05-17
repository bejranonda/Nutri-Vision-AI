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

### Next.js App Router file conventions are unreliable on OpenNext-on-Cloudflare-Pages — prefer explicit `route.ts` handlers (May 2026 — resolved)

**Symptom**: Round 4 (PR #35) shipped two Next.js convention files. After deploy, production probes showed only one worked:

```
/manifest.webmanifest  (from app/manifest.ts)   → 200 ✓
/sitemap.xml           (from app/sitemap.ts)    → 404 ❌
```

No build error in either case — the adapter just silently dropped the sitemap one. Same family of convention, opaque difference.

Separately, `app/[locale]/not-found.tsx` shipped in the same PR also didn't render on production. Probing `/th/no-such-path` returned Next.js's English framework default (`<title>404: This page could not be found.</title>`), zero Thai chars in body, no `<html lang="th">`. The locale segment never executed — the adapter served a static 404 fallback before the layout chain ran.

**Root cause** (suspected, not proven): the OpenNext-on-Cloudflare-Pages adapter handles `manifest.ts` but not `sitemap.ts`; and serves a static 404 before nested `not-found.tsx` files in dynamic segments. Both behaviours are adapter quirks, not Next.js bugs.

**Fix** (PR #36): bypass the conventions and reach for lower-level routing primitives the adapter handles reliably.

- Replaced `app/sitemap.ts` with `app/sitemap.xml/route.ts` — an explicit `GET` returning hand-built XML. Same content, fully under our control.
- Added `app/[locale]/[...slug]/page.tsx` — a catch-all that calls `notFound()`, forcing the locale segment to enter and the closest `not-found.tsx` (the localized one) to render.

**Rule for future contributors (revised after PR #37)**: PR #36 originally said "drop to `route.ts` at the target URL". That worked for the locale-404 catch-all but **not for `/sitemap.xml`** — putting an explicit handler at `app/sitemap.xml/route.ts` (a dotted folder name) ALSO 404'd. Next.js's `sitemap.{js,ts,xml,jsx,tsx}` special-filename recognition collides with the dotted folder.

**Revised rule**:
1. **Try the convention file first** (`app/manifest.ts`, `app/robots.ts`, etc.) — fastest if it works.
2. **If the convention 404s in production**, do NOT switch to `app/<name>.<ext>/route.ts` — same trap.
3. **Move to `/api/<name>/route.ts`** (universally-safe, fully-tested surface) and add a `rewrites()` rule in `next.config.js` to expose at the public URL. Search engines and robots.txt links don't notice; the rewrite is transparent.

**Codified in**: `docs/GUIDELINE.md` → "Probe response headers, not just bodies" gained a "convention vs explicit handler" rule of thumb. The sitemap + locale-404 probes are now in the routine sweep.

### 404 page rendered fully English on Thai URLs; no og:image on any locale (May 2026 round 4 — resolved)

**Symptom**: probing `/th/this-route-does-not-exist` returned Next.js's default 404 with `<title>404: This page could not be found.</title>` and zero Thai characters anywhere in the response body. Same applied to `/de/...` and `/da/...` — every locale fell through to the English default.

Separately, every locale page rendered HTML head with no `og:image` and no `twitter:image`. Sharing the URL on LINE, Facebook, X, Discord, or Slack rendered a text-only card with no preview — embarrassing for a product whose explicit pitch is "scan your food, share with friends".

**Root cause**:
1. **404**: there was no `src/app/[locale]/not-found.tsx`. Next.js falls back to the framework default when no local segment defines its own.
2. **og:image**: the layout's `metadata.openGraph` had `title`/`description`/`type`/`locale` but no `images` array. The Open Graph spec requires an `og:image` for any preview card to render.

**Fix**: locale-aware not-found page using a new `not_found` namespace in all four locale JSONs (`title`, `headline`, `subtitle`, `back_to_home`, `start_scan`); layout metadata extended with `openGraph.images`, `twitter.card`, `twitter.images`, and `metadataBase` so relative paths resolve against the prod origin. Locked in by 10 new test cases.

**Lesson for the audit playbook**: probing arbitrary not-found paths per locale belongs in the routine HTML sweep. The default 404 page looks fine if you only probe `/`, `/scan` etc. — only "rare" paths reveal it.

### `/icon.png` and `/apple-icon.png` return 404 in production despite existing in `src/app/` (May 2026 round 3)

**Symptom**: HTML head correctly references `<link rel="icon" href="/icon.png?<hash>"/>` (Next.js App Router auto-generates this from `src/app/icon.png`), but the URL itself returns HTTP 404. Every browser tab therefore shows the default browser icon instead of the Shinny logo.

**Suspected cause**: the icon files are 418KB each. The OpenNext-on-Cloudflare-Pages adapter likely has a size threshold for assets it serves via the App Router convention (vs assets that should be in `/public/`). Files this large weren't designed to be served as favicons anyway — standard tab icons are 16×16/32×32 PNGs under 50KB.

**Workaround until fixed**: leave as-is. Browser default icon is mildly ugly but not user-blocking. The newly-added PWA manifest references the same paths, so it inherits the same 404 — install-as-app flows will show the default icon too.

**Fix path** (separate PR):
1. Generate proper-sized icons (16, 32, 192, 512px PNGs + a maskable variant) — needs image tooling not available in this session.
2. Move them to `/public/` (predictable serving, no App Router convention) and reference explicitly from `metadata.icons` in `app/[locale]/layout.tsx`.
3. Update `app/manifest.ts` to point at the new paths.
4. Delete the 418KB PNGs in `src/app/`.

### Content-Security-Policy not yet set on HTML responses (May 2026 round 3 follow-up)

**Status**: round-3 UX audit shipped `X-Frame-Options`, `Referrer-Policy`, and `Permissions-Policy` (PR #34). CSP was deliberately deferred.

**Why deferred**: Next.js emits inline `<style>` blocks for critical CSS, and the dev-mode HMR client uses `unsafe-eval`. A meaningful CSP would need:
1. A nonce-or-hash strategy for the inline styles (Next.js supports `nonce` via `headers()` callback but it's per-request, which complicates static export and edge caching).
2. Separate dev vs prod policies (dev needs `unsafe-eval`; prod doesn't).
3. An audit of every third-party origin: fonts (already preloaded from same-origin), `next/image` Cloudflare loader, any analytics.

**Risk of NOT shipping CSP**: a successful XSS injection would have free reign. The codebase uses React (which auto-escapes string interpolation) and zod (which validates shapes), so XSS injection vectors are narrow — but defence-in-depth means CSP should ship eventually.

**Tracked**: ship in a dedicated PR with the audit and a `report-only` rollout window before flipping to enforcing.

### Every API route except `/api/health` returned responses with no `Cache-Control` header (May 2026)

**Symptom** (surfaced by UX-audit sweep, not by a user report): probing every `/api/*` endpoint for response headers showed 12 of 13 routes returning no `Cache-Control` at all. Personalized endpoints like `/api/auth/me` (returns user PII), authentication 4xx responses (carry request-tied identifiers), and 400 zod failures (carry `requestId`) were all theoretically cacheable by an intermediate proxy.

**Real-world blast radius**: Cloudflare's edge happens not to cache cookie-bearing responses by default, so this likely never produced a user-visible incident. But:
- The behaviour is **implicit** — depends on edge-cache configuration, not on a contract we own
- Future routes added without thinking about cache headers would inherit the same gap
- Defense-in-depth says set the header explicitly

**Fix**: new `lib/api-response.ts` exports `jsonResponse(body, init?)` — `NextResponse.json` with `Cache-Control: no-store` defaulted. All 13 API routes migrated. `tests/api-response.test.ts` walks every `src/app/api/**/route.ts` and asserts `NextResponse.json(...)` doesn't appear in live code — invariant locked in.

**Lesson**: "browse the response headers of every endpoint at least once" belongs in the routine UX audit. The surface is invisible from looking at code (NextResponse.json *seems* fine — it just doesn't set the header you want). Only an HTTP-level probe catches it.

### CF safety-net was truncating JSON mid-stream — default `max_tokens` too low (May 2026)

**Symptom**: scan 503 on the Thai locale, Request ID `02tf04hd` (user-facing), `eh0dzg8k` (diagnostic probe). User was on the premium tier (∞ scans/month), so not a quota issue.

**Root cause**, surfaced by the existing `primaryProviderError` + `failedJson` diagnostic surfaces in one probe:

```
primaryProviderError: 'The operation was aborted'
failedJson:           {"isFood":true,"dishes":[{"name":"ข้าวผัด",
                       "detectedItems":["🥔 ข้าว","🐟 น้ำปลา","🥗 ผัก",
                                        "🍳 ไข่","🌶 พริก",…
details:              JSON Parse Error: Regex-extracted JSON also
                       invalid: Expected ',' or ']' …
```

Two stacked conditions:
1. **Gemini cascade timed out** (per-model = floor(25s / 3) = 8.3s; when one model genuinely hangs, the AbortController fires and the cascade exits — by design, since hangs aren't fixable by trying a sibling model).
2. **CF safety-net was invoked, correctly identified the food** ("ข้าวผัด" / fried rice in Thai), but stopped mid-array because the CF Workers AI default `max_tokens` for `@cf/meta/llama-3.2-11b-vision-instruct` is ~256 tokens. A verbose Thai response (long `detectedItems` array + multi-byte UTF-8 chars) easily exceeds that budget. The JSON parser saw an unclosed `["…","…",` and the route returned 503.

The Gemini call had been passing `maxOutputTokens: 4096` all along; the CF call site never had the equivalent. The bug was invisible while CF was failing for other reasons (5016 license, image format), and only became observable once both of those were fixed (PRs #25 + #26) AND the cascade started actually falling through to CF (which happens whenever Gemini is slow or rate-limited).

**Fix**: pass `max_tokens: 4096` on both CF call sites in `attemptAiInference` (initial inference + post-license-accept retry). Matches the Gemini budget. The `prompt: 'agree'` license-acceptance ping doesn't need it (default 256 is fine for a ~10-token reply).

**Diagnostic note**: this 503 was diagnosable in **one probe** because the response body carries `primaryProviderError` (PR #23) and `failedJson` preview (existed before #23). Each prior session's bug took multiple round trips because the diagnostic chain wasn't there yet. The investment in diagnostic surfaces compounds: every subsequent 503 starts at the root cause, not at "well, the user-facing message is generic — let me probe and see."

### Rate limiting silently failed open in production — `caches.default` doesn't persist between OpenNext requests (May 2026)

**Symptom**: 40 parallel requests to `/api/voucher/check` (limit 30 / min) all returned 200. 12 consecutive bad-credential `/api/auth/login` attempts all returned 401 (limit was 10 / 15min). No 429s anywhere. Brute-force protection for the pilot launch was effectively absent.

**Root cause**: `lib/rate-limit.ts` v1 stored its sliding-window buckets in `caches.default`. In raw Cloudflare Workers this gives same-millisecond read-after-write consistency suitable for rate-limit accounting. In the OpenNext-on-Pages runtime, it does not — the cache `put` doesn't propagate before the next request reads, so every request sees an empty bucket and the counter never accumulates. The original code's defensive `try { } catch { return allowed:true }` design meant the failure was **completely silent** — no log, no metric, and the existing unit tests only verified the fail-open contract (no `caches` global in Vitest → returned `allowed:true`), which is exactly the same shape the broken production runtime produced.

**Fix**: switched the primary store to a module-scoped `Map<string, Bucket>` that lives in the worker's V8 heap and persists across requests within the same instance. Always works regardless of runtime. Memory is bounded by a periodic prune.

**Lesson**: tests that only verify "doesn't throw" are insufficient for a contract that says "enforces a limit." After this incident the suite adds 5 enforcement tests covering same-IP exhaustion, distinct-IP isolation, distinct-route isolation, sustained-flood handling, and the no-IP "anon" bucket — every code path that could quietly fail-open now has positive coverage.

**Future**: if we ever need cross-instance coordination (distributed attacker hitting 20+ PoPs simultaneously), swap the in-memory primary for Upstash Redis or a Durable Object behind the same `rateLimit()` API. Call sites stay identical.

### CF AI vision wasn't seeing the image (`image: [Uint8Array]` instead of `number[]`) — May 2026

**Symptom** (only observable after PR #25 unblocked the 5016 license error): post-license-acceptance CF responses were syntactically valid JSON but the *content* was hallucinated — fried-rice images analysed as "Mixed Greens Salad", responses including markdown like:

```
Here is your image:

![image](https://i.imgur.com/8R1RzVH.jpg)

Here is your response:
{ "isFood": true, "dishes": [...] }
```

That `![image](https://imgur…)` line is the smoking gun. A vision model that actually receives an image doesn't reference URLs from training data — it describes pixels. The model was generating training-style markdown because it had **zero pixels to look at**.

**Root cause**: the route was calling
```ts
const bytes = decodeBase64ToBytes(base64Data);  // Uint8Array
env.AI.run(model, { prompt, image: [bytes] });  // [Uint8Array] ← BUG
```
CF Workers AI vision models (`@cf/meta/llama-3.2-*-vision-instruct`, `@cf/llava-*`) expect `image: number[]` — an array of unsigned byte values. The original code shipped `[Uint8Array]` — a 1-element list whose only entry was the typed array itself. CF's runtime deserialised that as "no image present" and the model fell back to text-only behaviour.

**Why this was invisible until now**: the same line had been in `/api/analyze` since the original commit, but every CF call returned 5016 (Meta Llama Community License never accepted on this account) before ever reaching inference. Auto-accept (the entry above) made the call succeed for the first time, which made the format bug observable. **The two bugs masked each other** — one prevented us from seeing the other, and the cycle was only broken by `primaryProviderError` from PR #23 surfacing the 5016 error.

**Fix**: flatten via `Array.from(decodeBase64ToBytes(...))` at the decode site, then pass `image: bytes` (no wrapper). Regression test in `tests/analyze-fallback.test.ts` forbids the wrong shape and requires the right one — any future contributor who reaches for `image: [bytes]` will fail CI.

**Lesson**: when two upstream errors are stacked, the inner one is invisible until the outer one is fixed. `primaryProviderError` was the right diagnostic tool — without it, this could have stayed hidden for arbitrarily long.

### Cloudflare AI primary 100% failure — Meta Llama 3.2 license never accepted (May 2026)

**Symptom**: every production scan returned a Gemini-served response. Looked successful to users (because the Gemini cascade absorbed it), but every scan burned Gemini free-tier quota for work the Cloudflare primary should have done for free.

**Surfaced by** bug-hunt May 2026 (Request ID `sex01ab2`): a single-ingredient pineapple scan happened to land while my probes had already burned through Gemini's per-minute quota, so BOTH `gemini-2.5-flash` and `gemini-2.0-flash` returned 429 simultaneously, the cascade exhausted, and the route's 503 response body finally surfaced the real primary failure via the `primaryProviderError` field shipped in PR #23:

```
5016: Prior to using this model, you must submit the prompt 'agree'.
By submitting 'agree', you hereby agree to the
llama-3.2-11b-vision-instruct Community License …
```

**Root cause**: Meta requires Cloudflare account holders to explicitly accept the Llama 3.2 Community License before the model will run inferences. The acceptance is one-time per account; this account had never accepted. KNOWN_ISSUES.md had a footnote about this but described "visit the Cloudflare AI dashboard" as the only fix — the programmatic path was overlooked.

**Fix** — auto-accept on first 5016 inside `attemptAiInference`:

```typescript
try {
    response = await runWithTimeout({ prompt, image: [bytes] });
} catch (firstErr) {
    if (firstErr.message?.startsWith('5016:')) {
        await env.AI.run(model, { prompt: 'agree' });   // ← acceptance
        response = await runWithTimeout({ prompt, image: [bytes] }); // ← retry
    } else { throw firstErr; }
}
```

The `prompt: 'agree'` call is Cloudflare's documented programmatic acceptance path; subsequent scans never re-trigger the 5016. Net effect: the CF primary starts serving most scans, Gemini reverts to its designed role as the rare-case fallback, and Google free-tier quota stops being the only thing standing between users and a 503.

**Regression test**: `frontend/tests/analyze-fallback.test.ts` now asserts the route source contains the `5016:` marker, the `prompt: 'agree'` retry call, and both license-accepting telemetry stages. **Prevention**: any change to `attemptAiInference` that drops the auto-accept fails CI.

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
