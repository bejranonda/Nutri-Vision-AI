# 📜 Development Guideline - Nutri-Vision AI (EatInOrder)

This document provides guidelines for developers to maintain code quality, consistency, and efficient debugging.

## 🛠️ Code Conventions

### ⚛️ Frontend (TypeScript)
- **Framework**: Next.js 14 (App Router).
- **Styling**: Vanilla Tailwind CSS. Avoid external component libraries when possible for maximum flexibility and performance.
- **Components**: Use Client Components (`'use client'`) only when necessary (interactive elements, hooks).
- **Composable Architecture**: For complex components exceeding 300 lines (e.g., Pages with deep state, file uploader chains, and API fetching), logic **must** be extracted into focused Custom Hooks (`useScanAnalysis`, etc.). Do not build monolithic `page.tsx` files.
- **Internationalization**: Always use `next-intl`. Never hardcode strings.
- **Logging**: Use the unified `logger` from `@/lib/logger`.

### ☁️ Backend (Next.js Edge API)
- **Framework**: Next.js App Router API Routes (`/api/*`).
- **Runtime**: Edge Runtime (`@opennextjs/cloudflare`) compatible. 
  - 🚫 **Avoid Node.js APIs**: Do NOT use `fs`, `path`, or `Buffer`. `Buffer` is not globally guaranteed in Cloudflare edge runtimes. Use `atob()` and `Uint8Array` for binary decoding instead.
- **Cloudflare Bindings**: Always use the shared helpers in `@/lib/cloudflare` to access env bindings (AI, DB, KV, R2). **Never** use `(req as any).context?.env` — it silently returns `undefined`.
  ```typescript
  import { getEnv, getEnvSafe } from '@/lib/cloudflare';
  
  // Use getEnv() for strict access (throws if binding missing)
  const env = await getEnv();
  
  // Use getEnvSafe() for fault-tolerant access (falls back to process.env)
  const env = await getEnvSafe();
  ```
- **Fault Tolerance**: Wrap all external service dependencies (DB, Session, AI) in isolated `try/catch` blocks so a single failure (e.g., missing db binding) doesn't tear down the whole route.
  - **Auto-Correction Loop**: Validations (`safeParseJson`) should catch malformed JSON and illegal states, triggering a secondary inference pass using a provider fallback (e.g. Google) rather than looping the same deterministic error.
- **Timeouts & Fallbacks**:
  - Wrap AI or long-running bindings in `Promise.race()` to abort gracefully before hitting Cloudflare's strict CPU/wall-time execution limits.
  - **Primary + Fallback Cascade Pattern**: Always implement a cross-provider fallback for high-capacity models, and **the fallback itself must be a cascade across explicit model ids** — never a single hardcoded id, never a `-latest` alias.
  ```typescript
  // v2.3 Pattern — see lib/ai-providers.ts → GEMINI_VISION_MODELS
  //
  // Why a cascade not a single id: external-provider free-tier policy
  // is per-project AND per-model. Three back-to-back outages in
  // Apr–May 2026 (see KNOWN_ISSUES.md → "Scan 503 — three stacked
  // Google-fallback failures") all looked identical to the user but
  // had three different root causes (text-only model, retired alias,
  // limit:0 quota). The cascade survives all three classes.
  try {
      result = await attemptPrimaryInference(CLOUDFLARE_MODEL, 25_000);
  } catch (primaryErr) {
      // Capture so the 503 response carries BOTH errors. Without this
      // the user-facing response only shows the LAST error in the chain,
      // hiding which provider actually broke.
      primaryProviderError = primaryErr.message;
      for (const model of GEMINI_VISION_MODELS) {
          const res = await fetch(buildGeminiUrl(model), { ... });
          if (res.status === 404 || res.status === 429) continue; // sibling may have quota
          if (!res.ok) throw new Error(...); // 5xx / network — siblings won't help
          return await res.json();
      }
      throw new Error(`all ${GEMINI_VISION_MODELS.length} fallback models exhausted`);
  }
  ```
  Rules of thumb:
  - **Skip on 404** (model retired) and **429** (per-model quota gone). Throw on anything else — sibling models can't help with upstream-wide failures.
  - **Per-model timeout = `floor(totalTimeout / cascade.length)`** so the cascade fits inside the caller's budget.
  - **Surface every error in the chain**, not just the last one. The 503 body must include a `primaryProviderError` field (or equivalent) so operators aren't blind.
  - **Single source of truth across surfaces**: scan + chat both use `GEMINI_VISION_MODELS[0]` so they can never silently drift apart.
- **Type Hints**: Mandatory for all request bodies and database interactions. Use Drizzle ORM schemas.
    - **Dynamic Scaling**: Low-memory devices scaling down canvas size.
  - **Early Compression**: To prevent React state and mobile browser memory bloat, high-volume image features must compress incoming photos (e.g., `1200px` max, `0.85` quality) *before* storing them in frontend memory arrays.
- **AI-output validation**: Validate all AI outputs (e.g., `validateAiResponse`) using `safeParseJson` strategies to catch markdown prefixes before LLM JSON structures.
- **Request-body validation (mandatory)**: every `/api/*` route that accepts JSON **must** parse its body through a zod schema declared in `frontend/src/lib/schemas.ts`. Use `safeParse` + `zodFailure(result.error)` → `{ status: 400 }`. This is the boundary at which garbage input dies — never destructure `await req.json()` directly. See the existing `LoginRequest` / `RegisterRequest` / `AnalyzeRequest` / `PromoRedeemRequest` for the pattern.

## ☁️ Cloudflare / wrangler env (project-scoped, never global)

Wrangler picks up auth from `frontend/.env.local` automatically. Keep it that way:

- **Do** put `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` in `frontend/.env.local`. The file is gitignored. Each developer / CI runner sets their own values — works cleanly when the same machine has multiple Cloudflare accounts.
- **Don't** export them in your Windows / shell user profile. That pins every project on the machine to the same account ID and makes account isolation impossible.
- **Don't** put `account_id` in `wrangler.toml`. For Pages configs, `wrangler d1` ignores it. The repo carries an inline comment in `wrangler.toml` to keep the next reader from re-discovering this.

### Token scopes (the full set that actually works)

```
Account → D1:Edit
Account → Workers Scripts:Edit
Account → Cloudflare Pages:Edit
User    → User Details:Read
User    → Memberships:Read     ← without this, every remote wrangler
                                  command 401s on /memberships before
                                  reaching your actual resource.
```

When creating a token, picking the **"Edit Cloudflare Workers"** template includes all of these by default. If you hand-pick scopes, double-check `Memberships:Read` is on the list.

### Verifying after rotation

```bash
cd frontend
npx wrangler whoami                            # only needs User Details:Read
npx wrangler d1 migrations list eatinorder-db --remote   # needs the full set
```

If `whoami` works but `migrations list` returns 10000 → token is missing `Memberships:Read`. If it errors with *"More than one account available…"* → `CLOUDFLARE_ACCOUNT_ID` isn't set in `.env.local`. See `docs/KNOWN_ISSUES.md → Resolved → Cloudflare auth (/memberships 10000)` for the full debug trail.

## 📊 Logging & Debugging

### How to use the Unified Logger
The `logger` is available in both Frontend and Backend to ensure you can trace a request from the UI to the service layer.

#### In the Frontend:
```typescript
import { logger } from '@/lib/logger';

// Track a user land or feature status
logger.trackFeature('My Feature', 'success', { meta: 'data' });

// Log an error with context
logger.error('Failed to load data', { error: err.message });
```

#### In the Backend (Edge Route):
```typescript
import { logger } from '@/lib/logger';

// Use domain-specific loggers to track entire flows (e.g., scanApiStage)
logger.scanApiStage('AI_INFERENCE_START', { model: 'llama-3.2-11b', locale });

// Catch blocks must log stack traces and exact phases
try { ... } catch (err) {
    logger.scanApiStage('UNHANDLED_ERROR', { error: err.message, stack: err.stack, totalDurationMs });
}
```

### Checking Logs on Cloudflare
1.  **Dashboard**: Navigate to Workers & Pages -> Project -> Deployments.
2.  **Real-time Logs**: Click on the deployment and select "Begin Log Streaming".
3.  **Search Patterns**:
    - `[FEATURE]`: To see which UI components are being accessed.
    - `[ERROR]`: To find crashes and failed operations.
    - `X-Process-Time`: To monitor performance.

### On-Device Telemetry
Instead of relying solely on Cloudflare Dashboard logs, use built-in tools for rapid iterative testing:
1. **Debug Mode**: Append `?debug=1` to the `/scan` URL. After completing a scan, this exposes a dark accordion panel detailing precise API phase timings, the specific model used, network overhead, and the raw, unparsed JSON output of the AI directly in the UI.
   - **Copy Data**: The Debug Panel includes a "Copy Data" button allowing QA to easily copy exactly what the AI responded with. If validation/parsing fails, this debug panel will also intercept and render the broken `failedJson` payload.
2. **Health Endpoints**: Use `/api/health` to verify deployment dependencies (Database connection, Cloudflare AI binding, Google API key availability) without incurring full inference costs. Append `?verbose=1` for detailed environment traces. The response also carries a `deployment` block with `sha` / `shaShort` / `branch` / `pagesUrl` pulled from `CF_PAGES_*` build-time env vars — use this to verify deployment freshness in one curl:
   ```bash
   curl -s https://shinnyguide.autobahn.bot/api/health | jq .deployment.shaShort
   # → "9e74084"  ← compare to `git rev-parse --short main`
   ```

## 🚀 Development Workflow

1.  **Branching**: `feature/`, `bugfix/`, `docs/`.
2.  **Commits**: Use [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/).
    - `feat: add new scan logic`
    - `fix: correct GI calculation for sticky rice`
    - `docs: update knowledge base`
3.  **Testing** (single combined gate — run before every push):
    - Frontend: `cd frontend && npm run check:all`
      (= `type-check` + `check:i18n` + Vitest `test`).
    - Backend: `cd backend && pytest -q` (**129 tests**; <10s).
    - See [`docs/ITERATION_PROCESS.md`](ITERATION_PROCESS.md) for the full per-PR workflow (local loop → CI gates → CF preview smoke → merge method → post-merge verification → iterate).
4. **Security**:
    - Never commit `.env` or `.env.local`. Ensure they are always in `.gitignore`.
    - **No Hardcoded Keys**: API keys must never be hardcoded in source files or scripts (even test scripts). Always load from `process.env`.
    - **Encoding**: Ensure `.env` files are saved with **UTF-8** encoding. Avoid using PowerShell `>>` for appends as it may use UTF-16LE, which causes parsing failures in Node.js.
    - **Cloudflare Secrets**: In production, use `wrangler pages secret put` to manage sensitive values.
    - Always use `SECRET_KEY` from environment variables for JWT.
    - Validate all user-supplied data using Pydantic.

## 🧪 Testing Strategy

### Current automated coverage

| Layer | Runner | Location | Count |
|-------|--------|----------|-------|
| Frontend unit (edge-safe libs + AI fallback + rate-limit + health + API-response + SEO/PWA + share-metadata + locale-404 + auth-store + admin-route wiring) | Vitest | `frontend/tests/*.test.ts` (14 files) | **193** |
| E2e (Playwright, opt-in via `npm run test:e2e`) | Playwright + Chromium | `frontend/tests/e2e/*.spec.ts` (6 files: smoke, ui-ux, deep-probes, a11y, responsive-perf, user-journey) | **99** |
| Backend unit (security, scorer, gemini, config) | pytest | `backend/tests/` | **129** |
| TypeScript strict | `tsc --noEmit` | whole `frontend/` | gates on CI |
| i18n key drift | `scripts/check-i18n-keys.mjs` | whole `frontend/src/**` | gates on `check:all` |

### What to test when

- **Unit Tests** (`tests/*.test.ts` in Vitest, `tests/*.py` in pytest): isolated logic like nutrition score calculations, password hashing, prompt builders, request-body schemas.
- **Integration Tests**: end-to-end API flows (Scan → Analyze → Score → Save). Not yet implemented — on the roadmap (see `KNOWN_ISSUES.md → Ongoing Follow-ups`).
- **UI Tests**: multi-language rendering and interactive components. Also roadmap (Playwright smoke test for `Home → Scan → Results`).

### When a bug makes it to production

Follow `ITERATION_PROCESS.md §6` — the fix PR must add the missing regression test that would have caught the bug, and (if the bug is a class of thing rather than a one-off typo) extend the automated check suite so the whole class is prevented.

### Probe response headers, not just bodies — UX audit checklist

Bug-hunt May 2026 round 2 caught 12 of 13 `/api/*` routes shipping responses with **no `Cache-Control` header**. Bug-hunt round 3 caught HTML responses missing `X-Frame-Options`, `Referrer-Policy`, and `Permissions-Policy`. None of these were visible from reading code — `NextResponse.json` *seems* fine; it just silently doesn't set the headers you want. Only an HTTP-level probe surfaces these gaps.

**Rule**: when changing any `/api/*` route OR any HTML page surface, run the response-header sweep:

```bash
# API surface
for endpoint in auth/me auth/login auth/register auth/logout chat \
                promo/redeem voucher/check?code=x health analyze; do
  curl -sS -D - -o /dev/null -X POST \
    "https://shinnyguide.autobahn.bot/api/$endpoint" \
    -H 'Content-Type: application/json' -d '{}' \
  | grep -i '^cache-control'
done

# HTML surface
curl -sS -D - -o /dev/null https://shinnyguide.autobahn.bot/th \
  | grep -iE '^(strict-transport-security|content-security-policy|x-frame-options|x-content-type-options|referrer-policy|permissions-policy)'
```

Expected:
- Every `/api/*` response: `Cache-Control: no-store` (enforced at CI time by `tests/api-response.test.ts` — `NextResponse.json(...)` is forbidden in live code; routes must use `jsonResponse()` from `lib/api-response.ts`).
- Every HTML page: HSTS, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` locking everything except camera.

A missing header is just as much a bug as a missing field — it's just invisible from inside the code.

**Extend the sweep to share-preview metadata and rare URLs**: bug-hunt round 4 caught no `og:image` on any locale page (text-only social cards) and a fully-English 404 page rendering on Thai URLs (`/th/nonexistent`). Routine probes hit `/`, `/scan`, `/login` — the rare paths and the *metadata inside* the HTML are what surface these bugs.

```bash
# Share-preview metadata on each locale
for l in th en de da; do
  echo "--- /$l ---"
  curl -sS https://shinnyguide.autobahn.bot/$l \
    | grep -oE '<meta (property|name)="(og:image|twitter:image|twitter:card)"[^>]*>' \
    | head -3
done

# Locale-aware 404 probe per locale
for l in th en de da; do
  echo "--- /$l/no-such-path ---"
  curl -sS https://shinnyguide.autobahn.bot/$l/no-such-path \
    | grep -oE '<title>[^<]+</title>'
done
```

Expected: every locale has an `og:image` and `twitter:image` tag; the 404 title is in that locale's language.

**Convention vs explicit handler rule of thumb** (v3, post-PR #38 — the session iterated four times on `/sitemap.xml` before landing on the final form): Next.js's App Router file conventions and routing primitives are unevenly supported on OpenNext-on-Cloudflare-Pages. When a convention 404s in production, follow this **final** escalation:

1. **First**: try the convention file (`app/manifest.ts` ✓, `app/sitemap.ts` ✗ on this adapter). Fast if it works.
2. **If 404**: do **not** try `app/<name>.<ext>/route.ts` — dotted folder names collide with Next.js's `<name>.{js,ts,xml,jsx,tsx}` special-filename recognition. PR #36 verified this fails for `/sitemap.xml`.
3. **Do not** try `app/api/<name>/route.ts` + `next.config.js → rewrites()` — `rewrites()` doesn't fire on this adapter. PR #37 verified: `/api/sitemap` returned 200 + correct XML, but the rewrite from `/sitemap.xml` → `/api/sitemap` never triggered. `/sitemap.xml` stayed 404.
4. **If the content can be pre-rendered**: ship a **static file in `/public/`**. Cloudflare Pages serves these reliably. PR #38 did this for `/sitemap.xml`. Trade dynamic generation for bulletproof serving. Manual updates when source data changes are fine for low-frequency content (locale lists, public-path inventory).
5. **If the content MUST be dynamic at request time**: accept that the public URL has to be `/api/<name>` directly. Update `robots.txt` (or equivalent discovery surface) to point at the API path. The canonical URL is just a convention.

Trade-off across all five: convention buys typed return values; explicit handler buys typed route handler; static file buys nothing but reliability. For URLs that must be at a fixed path (sitemap, robots, well-known JSON files), reliability beats every other concern.

Same lesson for nested `not-found.tsx` in dynamic segments: OpenNext-on-Pages short-circuits to a static 404 fallback before the layout chain runs. Add a catch-all `[...slug]/page.tsx` in the segment that calls `notFound()` to force the chain to execute. See PR #36 + `KNOWN_ISSUES.md → Next.js App Router file conventions are unreliable on OpenNext-on-Cloudflare-Pages`.

### Run e2e BEFORE the deploy-validate cycle for any public-surface change

Bug-hunt round 6 introduced Playwright as an opt-in second test layer (`npm run test:e2e`). It catches a class of bug the Vitest unit suite never can: things visible only in the rendered DOM (icon-button accessible names, label/input associations, hreflang link tags, og:image absolute URLs) and things visible only in HTTP responses (Cache-Control on 429s, payload sizes, third-party script sources).

**Rule**: any PR changing the public surface — HTML metadata, form structure, API response shape, layout components, manifest, sitemap, robots — runs `npm run test:e2e` against the local dev server or production deploy **before** merge. The e2e suite has ~25 s runtime; it's not in `check:all` (too slow for every commit) but it IS the gate before the deploy-validate cycle.

Why this matters: PRs #34→#38 took 4 iterations to fix `/sitemap.xml` because each attempt's behavioural validation only happened post-deploy. With e2e in front of the deploy, the same class of bug shows up locally in seconds, and the loop reaches 1 iteration instead of 4.

```bash
# Add this to your pre-merge checklist for any public-surface PR:
npm run test:e2e
# Failures → fix locally → re-run. No deploy round-trips needed
# until the suite is green.
```

### Client timeouts MUST exceed server budgets

PR #39 caught a structural mismatch: client fetch abort was `30_000` ms while the server cascade can take up to 45 s (Gemini 25 s + CF 20 s). Single-photo scans finished well under 30 s so the wall never triggered. Multi-photo collages routinely exceeded 30 s and the client aborted before the server returned, showing the user a misleading "analysis taking too long" message even when the server had completed successfully.

**Rule**: any `fetch` against `/api/*` that wraps an `AbortController` deadline must use a deadline that's at least 5 s greater than the server's worst-case end-to-end budget at that route. For `/api/analyze` the worst case is multi-photo + Gemini-cascade-to-CF-fallthrough ≈ 45 s, so the client deadline must be ≥ 50 s (current cap: 60 s).

When the server budget is variable (multi-photo collages need longer), scale the client deadline by the same axis (`photoCount`, payload size, scan mode). See `frontend/src/hooks/scan/useScanAnalysis.ts → API_TIMEOUT_MS` for the canonical pattern: `Math.min(cap, base + (photoCount - 1) * step)`.

### "Doesn't throw" is not the same as "works" — enforcement testing

Bug-hunt May 2026 (PR #28) caught a class of test gap that the existing process didn't surface: the rate-limit unit suite had 9 tests, all green, all verifying *"this function doesn't throw under weird conditions"* (no `caches` global, weird headers, missing IPs). The function never threw. The function also **never blocked a single request in production** because `caches.default` wasn't persisting between OpenNext requests — the bucket reset on every call. The tests' fail-open contract was *exactly* the shape the broken production runtime produced. Bug shipped with green tests.

**Rule**: when a contract is *enforcing* something (rate limit, scan quota, voucher single-use, password verification, …), the test suite must include at least one test that proves the *enforcement* triggers, not just that the function returns. The "doesn't throw" contract is necessary (broken helpers must not 500 the route) but not sufficient.

Concretely, for `lib/rate-limit.ts` the post-#28 suite adds:
- Same-IP exhaustion blocks the (N+1)th request
- Distinct IPs get distinct buckets
- Distinct routes get distinct buckets
- A sustained flood after the limit is hit doesn't extend the window indefinitely
- The "anon" bucket exists for requests with no IP header

Apply the same lens whenever you add a route gate, schema, quota counter, or domain invariant. If your test could pass with the gate completely commented out, it's a fail-open contract test — add an enforcement test alongside it.

### Before declaring an AI-pipeline fix "shipped" — real-food validation

Static checks (`npm run check:all`) verify the *shape* of the route — types, schemas, the strings in source files. They cannot verify that a Google model id still has free-tier quota, or that a Cloudflare AI model still accepts your image format. **Provider-side breakage looks identical to a code bug from the user's seat.**

Mandatory before merging any change to `/api/analyze`, `lib/ai-providers.ts`, `GEMINI_VISION_MODELS`, or related pipeline code:

1. **End-to-end probe with a real food image**, post-deploy, against the live production URL. A sample image is committed under `research/test-image/` for this purpose.
   ```bash
   B64=$(base64 -w0 research/test-image/buymeacoffee-food-6940159_640.jpg)
   printf '{"imageBase64":"data:image/jpeg;base64,%s","locale":"en","scanMode":"meal","photoCount":1}' "$B64" > /tmp/body.json
   curl -sS -X POST https://shinnyguide.autobahn.bot/api/analyze \
        -H 'Content-Type: application/json' --data-binary @/tmp/body.json
   ```
2. **The response must have `isFood: true` and a populated `dishes` array** with scores and an eating sequence. A 200 with `isFood: false` (e.g. the image is a screenshot of the error UI) only exercises the non-food branch and is **not** evidence the success branch works.
3. **Record the `modelUsed` value** in the PR description so the audit trail captures which cascade step served the response.

Three PRs (#21, #22, #23) shipped in Apr–May 2026 for the same underlying class of bug because each round's "validation" only proved the route returned 200 on a non-food image. The rule above exists to break that cycle.

### The fresh-user audit lens (Round 7, May 2026)

Unit tests pin code invariants. E2e tests pin rendered behaviour. Neither lens catches **editorial** problems — copy that doesn't reflect what the product does, IA that confuses first-timers, claims that need citation, dishonest affordances (buttons that look live but aren't). Those need a human (or AI) walking through the product with fresh eyes and the freedom to be brutal.

**Practical recipe** for running a fresh-user audit when you suspect a UX gap:

1. **Reset your mental model**. Open the site in an incognito window, log out, clear cookies. Start at the homepage. You have zero context about the product.
2. **Read every visible string out loud**. If it uses jargon ("8-dimension scoring", "GLP-1 hormone", "NOVA classification"), flag it.
3. **Click every interactive thing you see**. If a button looks live but isn't (e.g., shows a "coming soon" toast), the visual promise is breaking the contract — fix the visual, not the behaviour.
4. **Count code-entry inputs per page**. Two on one page → confusion. One per page → clarity.
5. **Look for headline claims** ("Up to X%", "Backed by science"). Each one needs a source link or qualifier.
6. **Check that every primary CTA across pages says the same thing**. Three different "scan" verbs across three pages reads like a janky portfolio of half-finished features.

Round-7 caught 9 fresh-user bugs across 9 iterations. None were caught by the 164-case unit suite or 79-case e2e suite. Pattern: this lens is the third leg of the testing stool. Run it whenever the product changes its first-impression surface.

### The live-deploy + authed-surface lens (Round 8, May 2026)

Round 7 was a *static* fresh-user reading. Round 8 ran the app for real: Playwright against the live production URL, a real-photo scan end-to-end, and the authenticated surfaces driven with a session cookie. That caught:
- A `401` console error firing on every anonymous page load (the SiteHeader extracted in Round 7 introduced an unconditional `initAuth` → `/api/auth/me`).
- `/chat` being **completely unreachable on hard-load/refresh/bookmark** for logged-in users — a redirect race in the auth store where guards fired on the pre-probe `isAuthenticated === false`.
- A footer `Version 2.1.7` literal that had drifted from `package.json` 2.1.9.
- The locale-aware 404 page's "anti-dead-end" CTAs themselves dead-ending (bare `/scan` 404'd again, bare `/` dropped locale).

**Practical recipe**:
1. Run the **full Playwright e2e** against the live deploy URL (not localhost). Hidden regressions like the 401 console error only surface against a real network + edge runtime.
2. **Register a throwaway account via the API**. Extract the session cookie (`shinnyguide_session`). Inject it into Playwright with `context.addCookies(...)`.
3. **Drive the authenticated surfaces**: hard-load `/dashboard`, `/chat`, `/admin` (expect redirect for non-admins). Confirm each STAYS on its URL rather than bouncing through `/login`.
4. **Drive the core feature end-to-end**: run a real-photo scan through the UI (not just probe `/api/analyze`). Confirm the upload affordance triggers the full flow.
5. **Verify deploy SHA matches main HEAD** at each step (`curl /api/health | jq .deployment.shaShort`). If they diverge, your e2e is testing old code.

### The Web-Vitals + a11y inventory lens (Round 11, June 2026)

Even after the editorial lens (Round 7) and the live-deploy lens (Round 8), two more classes of defect remained invisible:
- **Performance regressions**: the homepage was loading three Google Font families, but two of them were referenced by zero Tailwind classes and zero CSS variables — pure dead weight pushing FCP to **2272ms** (threshold 1800ms). Functional tests don't fail when fonts are wasted.
- **Screen-reader-only failures**: 5 of 6 public pages were missing the `<main>` landmark. The page rendered fine, looked fine, passed every unit + e2e + fresh-user test — but a screen-reader user had no "skip past nav" target on every navigation.

**Practical recipe**:
1. **Web Vitals capture** — drive a fresh browser context per page (cold cache), call `performance.getEntriesByType('paint')` + `'largest-contentful-paint'` + a `PerformanceObserver` for `layout-shift`. Flag `FCP > 1800ms`, `LCP > 2500ms`, `CLS > 0.1`. Also count `content-length` per `content-type` (image/js/total) to spot bundle bloat.
2. **Font-payload audit** — `grep -rcE "font-display|font-thai|var\(--font-\w+\)" src/` against the fonts imported in the layout. Zero hits = pure dead weight, delete.
3. **Landmark + label inventory** — for each public page, evaluate `document.querySelectorAll('main, [role=main]').length` (expect 1), `h1` count (expect 1), and every `input/textarea/select` missing both a `label[for]` and `aria-label`. Round 11 added 6 permanent guards for this in `a11y.spec.ts`.
4. **WebKit smoke** — run the smoke spec via `webkit.launch()` + `devices['iPhone 13']`. Catches Safari-specific bugs Chromium misses.
5. **Schema vs route field usage** — for every column on a `users`/`sessions`/etc. table, `grep` the codebase for read sites + write sites. Zero hits anywhere = dead column. Round 11 caught `users.language` being written but never read AND being hardcoded to `'th'` regardless of actual locale.

Round 11 hit 7 audit angles and shipped 5 PRs with substantive wins (FCP −73%, `<main>` on every page, locale persistence bug fixed). 2 angles turned up nothing (WebKit, interaction console — good news).

### The full user-journey lens (Round 12, June 2026)

The per-surface e2e specs probe one thing at a time (a header, a tag, a payload size). The journey lens (`tests/e2e/user-journey.spec.ts`, PRs #76–#78) instead walks the whole product **in sequence, through the rendered UI** — set a file on the real `<input type=file>`, click the rendered Analyze CTA, fill and submit the actual register form — and asserts every flow reaches a **terminal UI state**. It catches integration-seam bugs the per-surface probes structurally can't: client timeout vs server budget mismatches, error-boundary engagement on a response the server got right, silent file rejection that leaves nothing on screen to probe.

**Approach — the four rules that make a journey spec reliable:**

1. **Assert terminal states, not happy paths.** An AI-backed flow has several *valid* endings (result rendered, not-food rejection, handled-error card with retry). The bug class to forbid is the flow that ends **nowhere** — a stuck spinner, a blank crash, a dead-end. Write the locator as a union of all valid terminals and give it the worst-case budget (the scan phase carries its own `test.setTimeout(180_000)` for cold Workers AI → Gemini cascades; the default 30s cuts the test off mid-analysis and reports a false failure).
2. **Generate fixtures at runtime; respect client-side floors.** The upload fixture is a 256×256 PNG built in-memory — no binary in the repo. It must be **noise-filled**: a solid-colour tile deflates below the 500-byte `MIN_FILE_SIZE` floor in `useScanUpload.ts` and is **silently dropped** (only an `uploadError` state, no CTA ever renders, nothing for the test to find). Whenever an upload test "can't find the next button", check the client-side validation floors before blaming the selector.
3. **Pin submit buttons by `type`, not text.** Tab-style mode switchers often share their label with the submit CTA (on `/login`, tab and submit are both "สมัครสมาชิก"). `getByRole('button', { name }) + .first()` clicks the tab and the form never submits — with no error, just a silent timeout on `waitForResponse`. `button[type="submit"]` is unambiguous.
4. **Filter console noise by documented pattern, never blanket-ignore.** Keep a single `isBenignConsoleError()` helper whose every pattern carries a rationale (see `KNOWN_ISSUES.md → Known-benign console-error noise`). Two corollaries: a spec that's green standalone can flake inside the full parallel suite (RSC-prefetch races only appear under load — run the **whole suite twice** before declaring stable), and an app's own error-logging instrumentation will appear as `console.error` even when the UI handled the failure — filter the *instrumentation pattern*, keep asserting on everything else.

**Method — phase independence + crash sentinels:**

- Make each journey phase its own `test` (mode `default`, not `serial`) so a flake in the scan phase never masks an auth regression.
- When a flow has a known historical crash mode, **race the crash signature against the valid terminals** and fail with a regression-friendly message naming it. Phase 3 races the Next.js error-boundary heading against the inline-error/success states because that exact crash appeared twice during development (see `KNOWN_ISSUES.md → Intermittent client error boundary`). A sentinel that names the failure turns "flaky test 🤷" into "that bug is back, here's where to look."
- State the **side-effect budget** in the spec header (this spec: 1 vision call + 1 voucher-rejected registration per run, no cleanup needed). A journey spec hits production for real; the next contributor must be able to see the cost of running it before they put it in a loop.

**When to run it**: before any release; after any change to the scan pipeline, auth flow, or routing/middleware; and as the automated stand-in for `ITERATION_PROCESS.md §3`'s manual checks 1, 3, 4 and 5 (the real-photo + multi-photo check 2 still needs the manual probe — the journey fixture is deliberately not food).

```bash
cd frontend && npx playwright test tests/e2e/user-journey.spec.ts
# ~17s warm; up to ~2 min if the scan phase hits a cold cascade.
```

### The discoverability / SEO-metadata lens (Round 16, June 2026)

Round 4 made the SEO *structure* correct (og:image absolute via `metadataBase`, hreflang graph, sitemap, unique per-locale `<title>`) and the e2e suite pins all of it. But structurally-perfect metadata can still target the wrong audience: Round 16 found the product indexed under **brand vocabulary** ("Smart Food Sequencing") when real users search by **problem and tool** ("AI food scanner", "blood sugar", "what to eat first"). The structural tests can't catch this — the title was unique, present, and the right length; it just said the wrong thing.

**Approach — write metadata for search intent, not for the brand:**

1. **Front-load the keyword in `<title>`.** The brand name is the click target once the user is already looking at the SERP; the *ranking* terms are what got them there. Lead "Brand: Primary Keyword + Secondary Keyword", not "Brand — Aspirational Tagline". Round 16: "Shinny Guide: AI Food Scanner & Sequencing App for Blood Sugar Management".
2. **Description is verb-first and benefit-first, inside ~120 chars** (before Google's desktop truncation). "AI food scanner that tells you what to eat first. Reduce blood sugar spikes by 70%…" beats "Discover how eating in the right order can transform your health".
3. **Keep keyword tags hyphenated and aligned across three surfaces**: `layout.tsx` `metadata.keywords`, `package.json` `keywords`, and GitHub repo topics (the last is set manually in the repo UI — note it in the PR so the maintainer syncs it). End-user topic tags (`ai-food-recognition`, `blood-sugar`, `food-sequencing`) belong everywhere; developer/stack tags (`cloudflare-workers`, `nextjs`, `typescript`, `zustand`) belong only on the dev-facing `package.json` + repo topics, not in the user-facing page `<head>`.
4. **openGraph copy is action-led** for feed scrollers — verb + payoff in one line ("Snap a photo of your meal and let AI tell you the perfect eating sequence…").
5. **`package.json` `homepage` points at the live product**, not a `#readme` anchor — npm and search treat it as canonical.

**Method — the audit + the guardrail:**

```bash
# 1. Read the live <head> the way a crawler does. Are the words the ones a
#    stranger would TYPE, or the ones the founder would SAY?
curl -sS https://shinnyguide.autobahn.bot/en \
  | grep -oE '<title>[^<]+</title>|<meta (name|property)="(description|keywords|og:title|og:description)"[^>]*>'

# 2. Confirm the structural pins still hold AFTER any copy rewrite — the
#    e2e SEO/PWA + share-metadata specs guard og:image-absolute, hreflang
#    graph, unique-per-locale title, meta-description length bounds.
cd frontend && npx playwright test tests/e2e/smoke.spec.ts tests/e2e/deep-probes.spec.ts
```

The guardrail is the point: a metadata copy change is *editorial* (use the fresh-user lens — read it as a stranger), but it rides on top of *structural* invariants the e2e suite owns. Rewrite the words freely; let the existing pins prove you didn't break the og:image URL or the title-uniqueness contract while doing it. Don't add new assertions for the copy itself — copy is a judgment call that will keep evolving, and pinning it to an exact string just creates churn.

**When to run it**: any PR touching `layout.tsx` metadata, `package.json` description/keywords/homepage, the README hero/positioning, or whenever the product's positioning shifts (new primary feature, new target audience).

### Where to add a new check

| Class of check | Lives in | How to extend |
|----------------|----------|---------------|
| Type correctness | `tsconfig.json` | Tighten compiler options. |
| i18n keys | `scripts/check-i18n-keys.mjs` | Extend the extractor regex or add a post-check validator. |
| Unit tests (frontend) | `frontend/tests/*.test.ts` | One file per module, Vitest. |
| Unit tests (backend) | `backend/tests/test_*.py` | pytest. |
| Request-body validation | `frontend/src/lib/schemas.ts` | Add a `z.object(...)` export + import into the route. |
| DB invariants | `frontend/src/db/schema.ts` + `frontend/drizzle/*.sql` | Drizzle schema + matching migration file. |

All new gates should be wired into `npm run check:all` so they run on every commit, not just CI.
