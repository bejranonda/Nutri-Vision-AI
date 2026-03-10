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

## 📋 Ongoing Investigations

-   **Accuracy of Portions**: AI occasionally overestimates or underestimates portion sizes based on photo angles.
-   **Multi-Ingredient Recognition**: Recognizing 10+ distinct ingredients in a single complex dish (e.g., Thai Som Tum). (Improved in v2.1.2 by updating the AI prompt with strict extraction rules).
-   **Language Consistency**: Ensuring the AI's "Shinny" persona remains consistent across all 4 languages.

## ✅ Resolved Issues

### Internal Server Error on Food Scan (v2.1.2)
- **Root Cause**: All API routes used `(req as any).context?.env` which silently returns `undefined` in the `@opennextjs/cloudflare` runtime. The `env.AI` and `env.DB` bindings were never accessible.
- **Fix**: Replaced with the official `getCloudflareContext()` API from `@opennextjs/cloudflare` across all 6 API routes.
- **Lesson**: Always use `getCloudflareContext()` to access Cloudflare bindings (AI, DB, KV, R2) in Next.js Edge API routes deployed via OpenNext.

### AI Inference Timeouts & 503 Errors (v2.1.1 → v2.1.5)
- **Root Cause**: The `@cf/meta/llama-3.2-11b-vision-instruct` model occasionally hits resource limits or capacity issues on Cloudflare Workers AI, leading to 503 "Service Unavailable" or 502 "Bad Gateway" errors.
- **Fix (v2.1.5)**: Implemented a **Dual-Model Fallback Strategy**. The system attempts the 11B model first (30s timeout); if it fails, it automatically retries with the faster, more available **3B model** (`@cf/meta/llama-3.2-3b-vision-instruct`).
- **Lesson**: High-capacity models on serverless platforms require automated fallbacks to smaller, more resilient models to maintain 99.9% uptime for users.
