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
- **Runtime**: Edge Runtime (`@opennextjs/cloudflare`) compatible. Avoid Node.js standard library modules (`fs`, `path`) unless polyfilled.
- **Type Hints**: Mandatory for all request bodies and database interactions. Use Drizzle ORM schemas.
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

## 🚀 Development Workflow

1.  **Branching**: `feature/`, `bugfix/`, `docs/`.
2.  **Commits**: Use [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/).
    - `feat: add new scan logic`
    - `fix: correct GI calculation for sticky rice`
    - `docs: update knowledge base`
3.  **Testing**:
    - Run `npm run type-check` before pushing frontend changes.
    - Ensure all backend unit tests pass (`pytest`).
4.  **Security**:
    - Never commit `.env` or `.env.local`.
    - Always use `SECRET_KEY` from environment variables for JWT.
    - Validate all user-supplied data using Pydantic.

## 🧪 Testing Strategy
- **Unit Tests**: For isolated logic like nutrition score calculations.
- **Integration Tests**: For end-to-end API flows (e.g., Scan -> Analyze -> Score -> Save).
- **UI Tests**: For verifying multi-language rendering and interactive components.
