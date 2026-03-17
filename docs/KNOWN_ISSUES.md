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
- **Mitigation**: Future update to dynamically adjust the maximum canvas size constraint based on the user's `window.devicePixelRatio` and available RAM.

## 📋 Ongoing Investigations

-   **Accuracy of Portions**: AI occasionally overestimates or underestimates portion sizes based on photo angles.
-   **Accuracy of Portions**: AI occasionally overestimates or underestimates portion sizes based on photo angles.
-   **Language Consistency**: Ensuring the AI's "Shinny" persona remains consistent across all 4 languages.

## ✅ Resolved Issues

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

### Environment Variable Parsing Failures (v2.1.8)
- **Root Cause**: When appending API keys to `.env` using PowerShell (e.g., `echo "KEY=VAL" >> .env`), PowerShell defaults to **UTF-16LE** encoding. Node.js `fs` reads and most `.env` parsers expect **UTF-8**, resulting in `undefined` variables even if the file looks correct in some editors.
- **Fix**: Re-saved all environment files (`.env`, `.env.local`) with strict **UTF-8** encoding.
- **Prevention**: Use standard text editors or `write_file` tools that default to UTF-8 for environment configuration. Avoid PowerShell `>>` for sensitive `.env` management.

### Non-Food Image Analysis Crashes (v2.1.9)
- **Root Cause**: Uploading images of pets or random objects caused the backend AI to return 422 Unprocessable Entity, which was not gracefully handled by the frontend, leading to unhelpful generic timeout/crash errors constraint.
- **Fix**: Implemented the `isFood` boolean flag within the schema natively. Backends no longer return HTTP 422 for bad images, but HTTP 200 with an explicit `isFood: false` and `nonFoodReason` message gracefully rendered in the UI by the Shinny Mascot.
