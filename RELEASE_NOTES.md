# 🛠️ Platform hardening — April 2026

> Internal-quality release series covering PRs #6 – #9. No user-visible
> feature changes; every item below closes a regression path or adds a
> guardrail against one.

## Security

- **Expired sessions rejected on `/api/promo/redeem`.** The route now
  enforces the same `gt(expiresAt, now)` filter as `/api/auth/me`;
  expired-but-uncleaned tokens can no longer redeem codes.
- **Constant-time password verification.** `verifyPassword()` no longer
  short-circuits on the first differing byte. The new
  `constantTimeEqual` helper walks the full buffer (XOR-accumulator)
  for both PBKDF2 and legacy-SHA-256 paths.
- **`/api/auth/register` race window closed.** Concurrent same-email
  registrations both used to pass the pre-check and then surface the
  raw DB constraint message to the loser. The insert is now wrapped in
  a catch that translates the UNIQUE violation to the same 409 the
  pre-check returns — no race-window side-channel.
- **No more `error.message` in 500 responses** across login, register,
  `/me`, and `/promo/redeem`. Full errors are logged server-side; the
  client sees a clean `{ error: "Internal server error" }`.
- **Promo double-redemption race closed at the DB level.** Migration
  `0001_promo_unique_redemption` adds a `UNIQUE INDEX` on
  `code_redemptions(user_id, code_id)`. The route re-orders its steps
  so the INSERT (the race-safe claim) runs before the user-tier
  UPDATE; the catch for the UNIQUE error returns the same 400 as the
  pre-check path.

## Quality infrastructure

- **Zod request validation at every `/api/*` JSON boundary.** New
  `frontend/src/lib/schemas.ts` defines `LoginRequest`,
  `RegisterRequest`, `AnalyzeRequest`, `PromoRedeemRequest`, and a
  `zodFailure()` helper that flattens validation errors into a uniform
  `{ error, fields: { name: issueCode } }` shape.
- **Vitest frontend test infra** with 34 tests across
  `tests/crypto.test.ts`, `tests/ai-prompt.test.ts`, and
  `tests/schemas.test.ts`. Locks the PR #6–#8 security + prompt fixes
  so any regression fails fast.
- **i18n drift CI gate** (`scripts/check-i18n-keys.mjs`,
  `npm run check:i18n`). Walks every `useTranslations('ns')` + `t('key')`
  call and verifies each key exists in all four locales
  (`th`, `en`, `de`, `da`). Handles the multi-namespace `tNav` /
  `tBrand` / `tGamify` pattern. Would have caught the `scan.dishes_found`
  regression that shipped earlier.
- **`npm run check:all`** is the single command contributors run
  before pushing: `type-check + check:i18n + test`.

## UX fixes

- **Thai output no longer includes "karaoke" romanization**
  (`ซุปปลา (Soup Pla)`). `LOCALE_INSTRUCTION.th` explicitly forbids
  Latin letters in parentheses; `en` / `de` / `da` get the same rule
  so the model doesn't volunteer parenthetical translations elsewhere.
- **Multi-photo scans now return one dish per tile.** The meal prompt
  passes `photoCount` through from client → server → AI; the
  `buildCollageInstruction` emits both a preamble *and* a
  post-schema final reminder ("dishCount MUST equal N"). New
  `sourcePhotoIndex` field links each `DishCard` back to its source
  tile, with a 56×56 thumbnail rendered in the card header.

## Docs

- `docs/ITERATION_PROCESS.md` — defines the zero-error-navigation
  workflow: per-commit local loop, per-PR CI loop, pre-merge manual
  smoke, merge-method guidance (use `merge`, not `squash` — PR #6
  lesson), post-merge production verification, iterate-until-zero-error
  feedback loop.
- `docs/KNOWN_ISSUES.md` — "Ongoing Follow-ups" section tracks
  rate limiting, prompt-eval harness, FK indexes, legacy-crypto
  retirement with concrete plans. Shipped items promoted to
  "Resolved Issues".
- `README.md`, `CONTRIBUTING.md`, `DEPLOYMENT.md`, `PUBLISHING.md`
  all updated with the new check-suite commands.

---

# 🍽️ EatInOrder v1.0.0 - Food Sequencing Revolution

> **อร่อย ตาม ลำดับ** — Discover how eating in the right order can reduce blood sugar spikes by up to 70%

## 🎉 What's New in v1.0.0

This is a major rebrand release that transforms the app from NutriVision AI to **EatInOrder**, focusing on the scientifically-proven concept of food sequencing.

### 🔄 Brand Transformation

**From:** NutriVision AI
**To:** EatInOrder ("อร่อย ตาม ลำดับ" - Delicious in Order)

### 🎯 The Food Sequencing Concept

The core philosophy is based on Shinny's "อยู่เพื่อกินบำนาญ" (Live long to eat well) approach:

```
🥦 Vegetables → 🍗 Protein → 🍚 Carbs → 🍰 Sweets
   (1st)          (2nd)        (3rd)      (4th)
```

Following this sequence can reduce blood sugar spikes by up to **70%**!

### ✨ New Features

#### 👩‍🏫 Shinny Mascot
- Friendly AI nutrition buddy
- Guides users through food sequencing
- Encourages healthy eating habits
- Available in all 4 languages

#### 🎮 Gamification System
- **Daily Streaks** with 🔥 fire effects
- **Points System** for healthy choices
- **Achievement Badges**: First Scan, Sequence Pro, Week Warrior, Month Champion, Perfect Score
- **Levels**: Beginner → Learner → Practitioner → Master → Blood Sugar Ninja

#### 🌍 Multi-Language Support
Full support for 4 languages from day one:
- 🇹🇭 Thai (default)
- 🇬🇧 English
- 🇩🇪 German
- 🇩🇰 Danish

#### 🎨 New Brand Design System
- **Primary**: Coral Red (#FF6B6B) - Energy & Appetite
- **Secondary**: Teal (#4ECDC4) - Health & Freshness
- **Accent**: Warm Yellow (#FFE66D) - Joy & Optimism
- **Fonts**: Plus Jakarta Sans, Prompt (Thai), Inter
- **UI Style**: Glassmorphism with playful animations

### 🏗️ Architecture Updates

#### Frontend
- Next.js 14 with App Router
- Tailwind CSS with custom brand tokens
- next-intl for internationalization
- Middleware for locale routing

#### Cloudflare Edge
- Cloudflare Pages deployment
- Cloudflare D1 (SQLite) database
- Cloudflare Workers AI integration
- OpenNext adapter for edge compatibility

### 🚀 Deployment

**Live URL:** https://eatinorder.bwerapol.workers.dev

Available in all locales:
- `/th` - Thai (default)
- `/en` - English
- `/de` - German
- `/da` - Danish

### 🙏 Acknowledgments

- **Shinny** - For the "อยู่เพื่อกินบำนาญ" philosophy
- **Thalay Community** - For evidence-based nutrition research
- **Cloudflare** - For excellent free-tier edge platform

---

## 📦 Installation

```bash
# Clone the repository
git clone https://github.com/bejranonda/Nutri-Vision-AI.git
cd Nutri-Vision-AI/frontend

# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Deploy to Cloudflare
npm run deploy
```

---

**Made with ❤️ for food lovers everywhere**

**"อร่อย ตาม ลำดับ" — Delicious in Order**

*Eat smart, live long, and enjoy every bite!*