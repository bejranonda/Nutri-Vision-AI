# 🚀 Deployment Guide - NutriVision AI

This guide covers deploying NutriVision AI to production using Cloudflare Workers (Recommended) or Docker.

## ☁️ Cloudflare Pages / Workers (Recommended)

Thanks to OpenNext, NutriVision AI can be fully deployed to Cloudflare as a Serverless Edge application.

### Prerequisites
- Cloudflare Account
- Cloudflare API Token (with D1, Workers, AI, and Pages Edit permissions)
- Node.js 18+

### Setup & Deployment

1. **Configure Environment**
Set the `CLOUDFLARE_API_TOKEN` environment variable in `frontend/.env.local` or the root `.env`:
```env
CLOUDFLARE_API_TOKEN=your_token_here
```

Also, set your Google AI API key as a secret in Cloudflare Pages:
```bash
echo "your-google-api-key" | npx wrangler pages secret put GOOGLE_AI_API_KEY --project-name your-project-name
```

> **⚠️ Security Tip:** Storing tokens in `.env` files is much safer than hardcoding them. Ensure your `.env` files are included in `.gitignore` to prevent accidental leaks. Use UTF-8 encoding for all environment files.

2. **Initialize D1 Database**
```bash
cd frontend
npx wrangler d1 create nutri-vision-d1
```
Copy the returned `database_id` and update it in `frontend/wrangler.toml`:
```toml
[[d1_databases]]
binding = "DB"
database_name = "nutri-vision-d1"
database_id = "your-database-id"
```

3. **Apply database migrations**
```bash
cd frontend
# First deploy / schema change — apply every pending migration to prod D1.
npx wrangler d1 migrations apply eatinorder-db --remote
```
All migrations live under `frontend/drizzle/` and are registered in `drizzle/meta/_journal.json`. They are **idempotent** (`CREATE TABLE IF NOT EXISTS`, `CREATE UNIQUE INDEX IF NOT EXISTS`) so re-running them is safe. Test locally first with `--local`.

4. **Pre-deploy quality gate**

Before running `npm run deploy`, always run the combined check suite — same gates Cloudflare Pages runs on every push:

```bash
cd frontend
npm run check:all     # = type-check + check:i18n + test
```

This catches three classes of regression we've historically had:
- Type-check errors that would fail the Next.js build on CF Pages.
- i18n-key drift — the scanner walks every `useTranslations('ns') + t('key')` call and verifies it exists in all four locales (`th/en/de/da`).
- Broken unit tests for crypto, AI-prompt validators, and zod request schemas.

If any gate fails, **do not deploy**. See [`docs/ITERATION_PROCESS.md`](docs/ITERATION_PROCESS.md) for the full zero-error-navigation workflow.

5. **Build and Deploy**
```bash
# Generate the build assets for Cloudflare
npm run pages:build

# Deploy to Cloudflare Pages
npm run deploy
```

Your app will be deployed globally on Cloudflare's Edge network with D1 and AI bindings automatically configured via `wrangler.toml`.

6. **Post-deploy smoke check**

Within 5 minutes of deploy, manually verify on the live URL:
- Home loads without console errors.
- A known-good food scan completes; the results panel renders no literal `ns.key` strings.
- Locale switch (to Thai) renders native text; no `(Soup Pla)`-style romanization in AI output.
- Register / login round-trip still works.

If any of these fail, roll back immediately (see `ITERATION_PROCESS.md §5`).

---

## 🛠️ Performance & Maintenance

### Monitoring
You can monitor your deployment directly in the [Cloudflare Dashboard](https://dash.cloudflare.com/):
- **Pages**: View build history and basic analytics.
- **Workers AI**: Monitor AI model usage.
- **D1**: Query and backup your database.

### Local Development
To test the production build locally:
```bash
npm run preview
```
---

**Happy Deploying! 🚀**
