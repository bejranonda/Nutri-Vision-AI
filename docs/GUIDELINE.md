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
  - **Dual-Provider Fallback Pattern**: Always implement a cross-provider fallback for high-capacity models. If the primary Cloudflare model fails or times out, immediately retry with a highly reliable external model (like Google Gemma 3).
  ```typescript
  // v2.1.9 Pattern
  try {
      result = await attemptPrimaryInference(CLOUDFLARE_MODEL, 25000);
  } catch {
      result = await attemptGoogleInference(GOOGLE_MODEL, 20000);
  }
  ```
- **Type Hints**: Mandatory for all request bodies and database interactions. Use Drizzle ORM schemas.
    - **Dynamic Scaling**: Low-memory devices scaling down canvas size.
  - **Early Compression**: To prevent React state and mobile browser memory bloat, high-volume image features must compress incoming photos (e.g., `1200px` max, `0.85` quality) *before* storing them in frontend memory arrays.
- **AI-output validation**: Validate all AI outputs (e.g., `validateAiResponse`) using `safeParseJson` strategies to catch markdown prefixes before LLM JSON structures.
- **Request-body validation (mandatory)**: every `/api/*` route that accepts JSON **must** parse its body through a zod schema declared in `frontend/src/lib/schemas.ts`. Use `safeParse` + `zodFailure(result.error)` → `{ status: 400 }`. This is the boundary at which garbage input dies — never destructure `await req.json()` directly. See the existing `LoginRequest` / `RegisterRequest` / `AnalyzeRequest` / `PromoRedeemRequest` for the pattern.

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
2. **Health Endpoints**: Use `/api/health` to verify deployment dependencies (Database connection, Cloudflare AI binding, Google API key availability) without incurring full inference costs. Append `?verbose=1` for detailed environment traces.

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
| Frontend unit (edge-safe libs) | Vitest | `frontend/tests/crypto.test.ts`, `ai-prompt.test.ts`, `schemas.test.ts` | **34** |
| Backend unit (security, scorer, gemini, config) | pytest | `backend/tests/` | **129** |
| TypeScript strict | `tsc --noEmit` | whole `frontend/` | gates on CI |
| i18n key drift | `scripts/check-i18n-keys.mjs` | whole `frontend/src/**` | gates on `check:all` |

### What to test when

- **Unit Tests** (`tests/*.test.ts` in Vitest, `tests/*.py` in pytest): isolated logic like nutrition score calculations, password hashing, prompt builders, request-body schemas.
- **Integration Tests**: end-to-end API flows (Scan → Analyze → Score → Save). Not yet implemented — on the roadmap (see `KNOWN_ISSUES.md → Ongoing Follow-ups`).
- **UI Tests**: multi-language rendering and interactive components. Also roadmap (Playwright smoke test for `Home → Scan → Results`).

### When a bug makes it to production

Follow `ITERATION_PROCESS.md §6` — the fix PR must add the missing regression test that would have caught the bug, and (if the bug is a class of thing rather than a one-off typo) extend the automated check suite so the whole class is prevented.

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
