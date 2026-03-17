# 📜 Development Guideline - Nutri-Vision AI (EatInOrder)

This document provides guidelines for developers to maintain code quality, consistency, and efficient debugging.

## 🛠️ Code Conventions

### ⚛️ Frontend (TypeScript)
- **Framework**: Next.js 14 (App Router).
- **Styling**: Vanilla Tailwind CSS. Avoid external component libraries when possible for maximum flexibility and performance.
- **Components**: Use Client Components (`'use client'`) only when necessary (interactive elements, hooks).
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
  - **Auto-Correction Loop**: Validations should catch malformed JSON and illegal states (like `isFood: false`), immediately triggering a secondary inference pass to let the LLM auto-correct itself.
- **Timeouts & Fallbacks**: 
  - Wrap AI or long-running bindings in `Promise.race()` to abort gracefully before hitting Cloudflare's strict CPU/wall-time execution limits.
  - **Dual-Provider Fallback Pattern**: Always implement a cross-provider fallback for high-capacity models. If the primary Cloudflare model fails or times out, immediately retry with a highly reliable external model (like Google Gemma 3).
  ```typescript
  // v2.1.7 Pattern
  try {
      result = await attemptPrimaryInference(CLOUDFLARE_MODEL, 25000);
  } catch {
      result = await attemptGoogleInference(GOOGLE_MODEL, 20000);
  }
  ```
- **Type Hints**: Mandatory for all request bodies and database interactions. Use Drizzle ORM schemas.
- **Image Processing**: All image transformations (like multi-photo collages) must happen **Client-Side** (e.g., via HTML5 Canvas) before upload to preserve Edge execution bandwidth, API boundaries, and memory overhead.
- **Validation**: Validate all AI outputs (e.g., `validateAiResponse`) as LLM JSON can be malformed.

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
3.  **Testing**:
    - Run `npm run type-check` before pushing frontend changes.
    - Ensure all backend unit tests pass (`pytest`).
4. **Security**:
    - Never commit `.env` or `.env.local`. Ensure they are always in `.gitignore`.
    - **No Hardcoded Keys**: API keys must never be hardcoded in source files or scripts (even test scripts). Always load from `process.env`.
    - **Encoding**: Ensure `.env` files are saved with **UTF-8** encoding. Avoid using PowerShell `>>` for appends as it may use UTF-16LE, which causes parsing failures in Node.js.
    - **Cloudflare Secrets**: In production, use `wrangler pages secret put` to manage sensitive values.
    - Always use `SECRET_KEY` from environment variables for JWT.
    - Validate all user-supplied data using Pydantic.

## 🧪 Testing Strategy
- **Unit Tests**: For isolated logic like nutrition score calculations.
- **Integration Tests**: For end-to-end API flows (e.g., Scan -> Analyze -> Score -> Save).
- **UI Tests**: For verifying multi-language rendering and interactive components.
