# ⚠️ Known Issues - Nutri-Vision AI (EatInOrder)

This document lists currently identified bugs, limitations, and ongoing technical challenges in the EatInOrder project.

## 🐛 Open Bugs

### 1. Placeholder Content
- **Current Status**: Several pages (Scan, Dashboard, Recipes) are currently implemented as "Coming Soon" placeholders.
- **Priority**: High (Functional Roadmap).
- **Target**: v1.1.0 and v1.2.0.

### 2. AI Inference Timeouts
- **Current Status**: Llama 3.2 Vision on Cloudflare Workers AI can occasionally hang or return 503 when queues are full.
- **Priority**: Medium.
- **Workaround**: We implemented a 30-second `AbortController` timeout on the client and an automatic single-retry for 503 errors. Users receive a polite localized timeout message if it still fails.

### 3. Nutrition Scoring Data Gaps
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
-   **Multi-Ingredient Recognition**: Recognizing 10+ distinct ingredients in a single complex dish (e.g., Thai Som Tum with multiple toppings).
-   **Language Consistency**: Ensuring the AI's "Shinny" persona remains consistent across all 4 languages.
