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
| Frontend unit (edge-safe libs + AI fallback + rate-limit + health shape) | Vitest | `frontend/tests/*.test.ts` (10 files) | **113** |
| Backend unit (security, scorer, gemini, config) | pytest | `backend/tests/` | **129** |
| TypeScript strict | `tsc --noEmit` | whole `frontend/` | gates on CI |
| i18n key drift | `scripts/check-i18n-keys.mjs` | whole `frontend/src/**` | gates on `check:all` |

### What to test when

- **Unit Tests** (`tests/*.test.ts` in Vitest, `tests/*.py` in pytest): isolated logic like nutrition score calculations, password hashing, prompt builders, request-body schemas.
- **Integration Tests**: end-to-end API flows (Scan → Analyze → Score → Save). Not yet implemented — on the roadmap (see `KNOWN_ISSUES.md → Ongoing Follow-ups`).
- **UI Tests**: multi-language rendering and interactive components. Also roadmap (Playwright smoke test for `Home → Scan → Results`).

### When a bug makes it to production

Follow `ITERATION_PROCESS.md §6` — the fix PR must add the missing regression test that would have caught the bug, and (if the bug is a class of thing rather than a one-off typo) extend the automated check suite so the whole class is prevented.

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
