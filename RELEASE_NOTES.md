# 👀 UX-audit Round 7 — fresh-user loop, May 2026

> 9 iterations, 9 shipped fixes, 8 PRs (#46–#54). Same iterate-until-zero
> cadence as Round 6 (the e2e loop), but with a different lens: view the
> app as a first-time visitor with **zero context** and surface
> editorial / IA / honesty bugs that no automated probe can catch.

## What we caught the unit + e2e suites couldn't

| Pain a fresh visitor would feel | Fix | PR |
|---|---|---|
| Login defaulted to *Log in* but most landing visitors haven't registered. Homepage didn't say "free / no signup". Scan didn't promise privacy. | Register-default + free-tier tagline + scan privacy note | #46 |
| Three different primary CTAs across pages (*Start Scanning* / *Try Scan* / *Scan Now*) read like a janky portfolio of half-finished features. | Canonicalized to *Start your scan* everywhere | #47 |
| Only the homepage had a real nav. Every other page degraded to a "Back to home" link — navigation predictability evaporated. | New `<SiteHeader/>` extracted and reused on all 6 pages, auth-aware right CTA | #48 |
| `/recipes` was a bare "coming soon" stub with no Shinny voice and no escape route — read like a 503. | Shinny-voiced empty state + Scan CTA | #48 |
| "Full 8-dimension scoring" on the Premium card is opaque jargon. Fresh users have no way to know what's measured or where the free cutoff lands. | Expandable disclosure listing all 8 dimensions with one-line explanations + Free badges on the 3 the Free tier unlocks | #49 |
| Google/LINE social-login buttons LOOKED live but threw "coming soon" toasts on click — visual promise breaking from behaviour. | Disabled styling + visible "Soon" badge + `aria-disabled` | #50 |
| Login page had TWO code-entry inputs visible at once (voucher in form + promo-redeem below) — fresh users had no idea which to use. | Removed the standalone promo input from login (still lives on `/pricing` for logged-in users) | #51 |
| Shinny avatar (40KB PNG) popped in late on every page using it — hero greeting visibly stuttered on mobile. | `<link rel="preload" as="image" fetchPriority="high">` in locale layout | #52 |
| Headline claim "Up to 70% blood sugar spike reduction" had no source — indistinguishable from marketing fabrication to a skeptical first-timer. | Citation footnote (Shukla et al., 2015, Weill Cornell, T2D patients) + asterisk on the badge, all 4 locales | #53 |
| Methodology not documented — next person picking up the project couldn't repeat the audit. | Captured in CHANGELOG + KNOWN_ISSUES + GUIDELINE + KNOWLEDGE_BASE; six-step recipe in `docs/GUIDELINE.md → The fresh-user audit lens` | #54 |

## The pattern that emerged

Unit tests pin **code invariants**. e2e tests pin **rendered behaviour**. Neither lens catches **editorial problems** — copy that doesn't reflect what the product does, IA that confuses first-timers, claims that need citation, dishonest affordances (buttons that look live but aren't), duplicate / competing inputs on the same screen, jargon presented without context.

→ **Three-leg testing stool**: `vitest` + `playwright` + fresh-user audit. Different lenses, different bugs, different cadences. Run all three. Round 6 found 10 bugs the unit suite missed; Round 7 found 9 bugs the unit + e2e combo missed.

## Test posture

- **164/164 unit tests** still green
- **79/79 e2e tests** still green
- 4/4 locales (th/en/de/da) at 100% key coverage throughout the round

---

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