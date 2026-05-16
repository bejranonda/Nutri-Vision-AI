# Changelog

All notable changes to the NutriVision AI project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
