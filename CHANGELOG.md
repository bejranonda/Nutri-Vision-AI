# Changelog

All notable changes to the NutriVision AI project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.1.8] - 2026-03-11

### Added
- 🛠️ **Debug Mode & Telemetry**: Added `?debug=1` URL parameter to the scan page, revealing a dark panel with phase timings, model used, and raw AI responses.
- 📡 **Health Check API**: Added `/api/health` deployment verification endpoint to monitor AI binding, DB status, and Google fallback key availability (`?verbose=1` for environment diagnostics).
- 🕒 **Client-Side Scan History**: Added `scan-history.ts` module storing the last 10 scans locally with compressed thumbnails, works independently of auth.
- 🎨 **Enhanced Scan UX**: Implemented phased loading indicators ("Compressing → Analyzing → Processing"), added a prominent overall score badge, and integrated AI-generated tip cards directly into the results UI.

### Changed
- 🧠 **Structured AI Sequencing**: Refactored the AI prompt to enforce a strict `{step, emoji, items, category}` array format instead of flat strings, eliminating brittle string parsing in the client.
- ⚙️ **Dynamic Spike Reduction**: The `spikeReduction` percentage is now dynamically calculated by the AI rather than hardcoded to 60%.
- 🚀 **Memory Optimization**: Eliminated `Array.from()` memory waste in the API layer, improving base64 to byte conversion efficiency.

---

## [2.1.7] - 2026-03-10

### Changed
- 🧠 **Super Fallback Upgrade**: Upgraded the Google AI fallback model from `gemini-2.0-flash` to the newly released **`gemma-3-27b-it`**. This model provides superior multimodal capabilities and better reasoning for complex food scenes while acting as our highly reliable secondary layer.

---

## [2.1.6] - 2026-03-10

### Added
- 🛡️ **Triple-Layer AI Fallback**: Implemented a highly resilient multi-provider fallback strategy: Cloudflare Llama 11B -> Google Gemini 2.0 Flash -> Cloudflare Llama 3B. This ensures scanning works even during provider outages.
- 🚀 **Google Gemini Integration**: Added native `fetch`-based integration for Google AI to maintain a lightweight Edge bundle.

---

## [2.1.5] - 2026-03-10

### Added
- 🛡️ **AI Model Fallback**: Implemented automatic fallback from Llama 3.2 11B Vision to the faster 3B model if the primary model fails or times out. This significantly reduces "temporarily unavailable" errors during peak load.
- 📡 **Granular Error Reporting**: Improved error responses to distinguish between primary and fallback failures.

---

## [2.1.4] - 2026-03-10

### Changed
- 🔧 **AI Timeout Increase**: Increased AI inference timeout from 25s to 35s to better accommodate the Llama 3.2 11B Vision model on Cloudflare Workers.
- 📡 **Enhanced Debug Logging**: Added granular phase tracking (`AI_AWAITING_RESPONSE`), prompt length logging, and error code capturing for AI failures.
- 🛡️ **Improved Error Messages**: Added specific user-facing messages for AI timeouts to distinguish from generic service failures.

---

## [2.1.3] - 2026-03-02

### Changed
- 🏗️ **Architectural Refactor**: Extracted Cloudflare binding access logic into a shared helper `src/lib/cloudflare.ts`. All 6 API routes now use `getEnv()` or `getEnvSafe()`. This prevents future regressions caused by the broken `(req as any).context?.env` pattern.

---

## [2.1.2] - 2026-03-02

### Added
- 🛡️ **Fault-Tolerant API Pipeline**: Rewrote the `/api/analyze` route into a 10-phase pipeline. Session and Database initialization failures are now gracefully caught, allowing the main AI scan to succeed even if the Auth or DB layers are temporarily down.
- ⏱️ **Zero-Hang Server Timeouts**: Added a server-side 25-second `Promise.race` timeout to the AI inference call to prevent the Cloudflare Worker from hanging indefinitely and hitting hard execution limits.
- 🆔 **Request Tracing**: Added short `requestId` generation to every request. This ID is displayed on the UI error screen and tracks the request linearly across all logs.
- 🛡️ **Client-Side File Validation**: Added early validation to reject corrupt (<500B), non-image, and oversized (>15MB) files immediately before compression.

### Fixed
- 🐛 **Cloudflare Binding Access**: Replaced broken `(req as any).context?.env` pattern with official `getCloudflareContext()` from `@opennextjs/cloudflare` in all 6 API routes. This was the root cause of the "AI binding is not configured" error — the env object was always `undefined`.
- 🐛 **Internal Server Error on Base64 Decode**: Replaced Node.js `Buffer.from()` base64 decoding with Edge-safe native `atob()` and `Uint8Array`. This fixes silent pipeline crashes in the Cloudflare runtime.
- 🐛 **Crash on Malformed AI JSON**: Added strict post-processing sanitization for AI outputs. Missing or malformed keys are coerced into safe defaults to prevent React render crashes.
- 🔧 **Project Name**: Fixed `wrangler.toml` and `package.json` deploy script to use correct Cloudflare project name `eatinorder`.

---

## [2.1.1] - 2026-03-02

### Added
- ⏱️ **Robust AI Fetching**: Added a 30-second `AbortController` timeout to the food scan API request.
- 🔄 **Auto-Retries**: Implemented automatic single-retry for transient 503 errors from Cloudflare Workers AI.
- 📡 **Deep Diagnostic Logging**: Added 7 new scan-specific diagnostic methods to `logger.ts` tracking 20 distinct points across the client upload, compression, API boundary, and DB insertion phases. Include payload sizes and `durationMs`.

### Fixed
- 🌍 **Missing i18n Keys**: Added missing error state and low-confidence translations to all 4 locale files (`en`, `th`, `de`, `da`).
- 🐛 **Broken Fallbacks**: Removed fragile `||` string fallbacks from the scan page error display which failed due to `next-intl` returning truthy key paths. 

---

## [2.1.0] - 2026-02-26

### Changed
- 🧠 **Vision Model Upgrade**: Replaced the weak `@cf/llava-hf/llava-1.5-7b-hf` model with the much more capable **`@cf/meta/llama-3.2-11b-vision-instruct`**.
- 🛠️ **"Identify-First" AI Pipeline**: Rewrote the AI extraction prompt to identify the food FIRST rather than assuming everything is a prepared Thai dish. This fixes major misidentification bugs (e.g., misclassifying raw fruits as Som Tam).

### Removed
- 🗑️ **Mock Fallbacks Removed**: Removed the hardcoded mock fallback data ("Pad Thai" / "Som Tam") from both the API route and the frontend catch block.

### Fixed
- 🐛 **Silent AI Failures**: Fixed an issue where AI inference failures were silently masked by mock data holding a fake 90% confidence score. The app now displays an honest error state UI with the Shinny mascot explaining the failure.
- 🐛 **Confidence Score Default**: Fixed leftover code defaulting confidence to 90% when missing; it now correctly defaults to 0%.

---

## [0.1.0] - 2025-01-17

#### Core Features
- 🔍 **AI Food Recognition**: Image analysis using Google Gemini Vision API
- 📊 **8-Dimension Nutrition Scoring System**:
  - Blood Sugar Impact scoring
  - Gut Health scoring
  - Inflammation scoring
  - Nutrient Density scoring
  - Processing Level scoring
  - Protein Quality scoring
  - Micronutrient Coverage scoring
  - Overall Health Score calculation
- 🍜 **Thai Food Specialization**:
  - 1000+ Thai recipes database
  - Thai ingredients database
  - Thai measurement conversions
  - Cultural context integration
- 💬 **AI Nutrition Coach**: Interactive chat with AI nutritionist
- 📱 **Mobile-First PWA**: Progressive Web App with offline capabilities
- 🌐 **Bilingual Support**: Full Thai and English internationalization
- 👤 **User Authentication**: Email/password registration and login
- 📈 **User Dashboard**: Personal nutrition tracking and history
- 🔒 **GDPR Compliance**: Data export, right to be forgotten, consent management

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

## [0.2.2] - 2026-02-23

### Fixed
- 🚀 **Cloudflare Deployment**: Resolved OpenNext compatibility issues by updating `compatibility_date` to `2024-09-23`.
- ☁️ **Cloudflare D1 Setup**: Successfully initialized D1 database `nutri-vision-d1` and mapped its ID in `wrangler.toml`.
- ⚙️ **Deployment Script**: Fixed Powershell execution issues for deployment scripts.
- 🛠️ **Deployment Automation**: Replaced `prepare-pages.sh` with a cross-platform Node.js script and fixed `npx wrangler pages deploy` directory resolution on Windows.

---

## [0.2.1] - 2026-02-23
- 🛠️ **i18n Refinements**: Replaced hardcoded Thai strings in the UI with dynamic translation keys.
- 🔗 **Locale Routing**: Fixed hardcoded locale paths in navigation links to use current user locale.
- 🚀 **SEO & Performance**: 
  - Added SEO metadata to the main layout.
  - Optimized font loading for `Inter` and `Sarabun` (Thai).
  - Added `antialiased` class for smoother text rendering.
  - Added missing `drizzle-orm` dependency for edge database schema.

---

## [0.2.0] - 2026-02-23

### Added
- 🌍 **Internationalization (i18n)**: Added Danish (`da`) and German (`de`) language support via `next-intl`.
- 🎨 **UI/UX Revolution**: 
  - Dynamic Glassmorphism aesthetic.
  - "อร่อย ตาม ลำดับ" (Delicious in Order) active sequencing guide component.
  - New modern typography (`Inter`, `Outfit`) integrated alongside `Sarabun`.

### Changed
- ☁️ **Infrastructure Paradigm Shift**: Migrated from Dockerized FastAPI & PostgreSQL to a fully serverless Cloudflare architecture.
  - Replaced PostgreSQL with **Cloudflare D1** (SQLite) using Drizzle ORM.
  - Switched Next.js builds to Edge Worker compatibility via **OpenNext** (`@opennextjs/cloudflare`).
  - Shifted AI services to use the Cloudflare Workers AI token.

### Removed
- Removed Docker/docker-compose requirements and FastAPI backend codebase dependencies.

---

## [2.1.0] - 2026-02-26

### Added
- 👩‍🏫 **Custom AI Avatar**: Replaced generic emojis with dynamic Shinny AI avatars (`Analyzing`, `Explaining`, and `Celebrating` postures) for a more personalized UX.
- 🎨 **App Favicons**: Added new custom Shinny AI avatar as the app's `icon.png` and `apple-icon.png` for a cohesive brand identity.
- 🌍 **Global Language Switcher**: Extracted language dropdown into a shared component available on all pages, with path-aware locale switching powered by `next-intl` `createNavigation`. Full WCAG 2.1 AA keyboard accessibility (ArrowUp/Down, Home/End, Escape), focus management, centralized locale config (`i18n-config.ts`), and native `<Link>` for proper browser behavior.
- 🔒 **Edge-native Security**: Replaced client-side `localStorage` authentication with secure Next.js Edge APIs (`/api/auth/*`) backed by Cloudflare D1 + Web Crypto + HttpOnly cookies.
- 🎟️ **Secure Promo Codes**: Moved promotion code validation and redemption logic (`/api/promo/redeem`) securely to the backend.
- 🧠 **Workers AI Integration**: Built `/api/analyze` to handle image scanning via Cloudflare Workers AI with fallback mechanisms and rate-limiting.
- 🎨 **UI Component Abstraction**: Created reusable `<GlassCard>` and `<GradientButton>` components, streamlining the `/scan` and `/pricing` pages.

---

## [2.0.0] - 2026-02-26

### Added

#### App Pages
- 📸 **Scan Page**: Drag-and-drop food photo upload with simulated AI analysis. Shows detected ingredients, nutrition breakdown, optimal eating sequence (Veggies → Protein → Carbs → Sweets), spike reduction percentage, and 8-dimension health scores with tier-gated visibility.
- 🎓 **Demo Page**: Interactive 4-step walkthrough of food sequencing science. Includes animated blood sugar curve comparison (with/without sequencing) and CTAs to scan or register.
- 🔐 **Login Page**: Tabbed login/register form with email validation, password visibility toggle, promo code redemption section, Google & LINE social login buttons (styled, coming soon), and auto-redirect to dashboard on success.
- 📊 **Dashboard Page**: Authenticated member dashboard with quick stats (scans used, streak, points, level), daily challenge, recent scans list, trial expiry warnings, and upgrade CTAs for free-tier users.
- 💰 **Pricing Page**: Three-tier comparison cards (Free/Premium/Family) with monthly/annual toggle, feature checklists, enterprise CTA, promo code input, and FAQ accordion.

#### Member System
- 👤 **Auth Store**: Zustand-based authentication with `localStorage` persistence. Supports login, register, logout, promo code redemption, scan/AI question tracking, and points system. Ready for Cloudflare D1 backend swap.
- 🎟️ **Promotion Code System**: Supports TRIAL, DISCOUNT, FANCLUB, and REFERRAL code types. Built-in demo codes: `SHINNY2024` (30-day Premium), `EATWELL` (7-day trial), `LAUNCH50` (50% off), `FAMILY2024` (14-day Family trial).
- 🔒 **Feature Gating**: `tier-config.ts` maps features to Free/Premium/Family tiers with configurable limits (scans/month, AI questions/day, recipe access, score dimensions).
- 🗄️ **Database Schema**: Added `promo_codes`, `code_redemptions`, and `sessions` tables. Extended `users` table with `display_name`, `trial_expires_at`, `promo_source`, `scans_this_month`, `streak_days`, `total_points`.

#### Business Development
- 💼 Freemium pricing: Free (10 scans/mo) → Premium (฿199/mo) → Family (฿299/mo)
- 📈 Annual pricing with ~30% discount
- 🏢 Enterprise/Corporate Wellness placeholder
- 🎯 Usage tracking via logger for conversion funnels

#### Documentation
- 📄 Updated `README.md` and `README-TH.md` with feature table, promo codes, and business development
- 📝 Created `docs/claude.md` and `docs/gemini.md` — project guides for AI assistants
- 💰 Updated `research/business/monetization.md` with promo code strategy
- 📋 Updated `CHANGELOG.md` with v2.0.0 entry

#### Previous (Unreleased)
- 👩‍🏫 **Shinny Mascot Integration**: Rebranded to **Shinny** with "Live long to eat well" philosophy
- 📂 Business strategy research documents
- 🌍 i18n updates for mascot across all languages
- 🔗 Themed placeholder pages for all routes
- 📱 Mobile hamburger menu and responsive header

### Planned Features
- Restaurant menu scanning
- Barcode scanner integration
- Real AI food analysis via Cloudflare Workers AI
- Payment integration (PromptPay, Rabbit LINE Pay)
- Social login (Google, LINE)
- Fitness tracker integration
- Voice input support

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

**Made with ❤️ for the Thai community**

*"อัปเดตเพื่อสุขภาพที่ดีขึ้น" - Updates for better health*
