# 🧭 UX-audit Round 12 — full user-journey e2e, June 2026 (unreleased)

> User asked: "can we test as a real user for the whole user journey." Added
> the fifth testing lens: `frontend/tests/e2e/user-journey.spec.ts` (PRs
> #76–#78) — one spec that walks production end-to-end through the rendered
> UI in four phases: landing + locale switch, photo upload → AI analyze →
> terminal result, registration round-trip, recipes/chat/dashboard browse.

## What this round shipped

| Item | Outcome |
|------|---------|
| **Journey spec** | 4 phases, all green against production. Every flow must reach a *terminal UI state* (result, handled-error card, or clean redirect) — never a stuck spinner or crash. Scan phase has its own 180s budget for cold-start Workers AI → Gemini cascades. |
| **Self-contained fixture** | The upload image is a 256×256 LCG-noise PNG generated in-memory at runtime — no binary checked into the repo, sized to clear the 500-byte client-side floor in `useScanUpload.ts`. |
| **Crash sentinel** | Phase 3 explicitly fails if the Next.js client error boundary engages after the register response — a crash observed twice during development (server contract was correct; client handling crashed). Tracked in `KNOWN_ISSUES.md`. |
| **De-flake under load** | #78: phases 1–2 flaked only inside the full parallel suite (Next.js RSC-prefetch fallback noise). Shared `isBenignConsoleError()` filter with per-pattern rationale. |
| **Cold-path validation** | One run exercised the analyze-timeout path end-to-end: the UI rendered the friendly handled-error card with a retry CTA. The error path is a *valid journey*, and it works. |

## Final test posture after Round 12
- Frontend unit: **171/171** ✓
- Frontend e2e: **97/97** ✓ (+4 journey phases; full suite verified twice, ~1.1 min/run)
- Backend unit: **129/129** ✓

---

# 🚀 UX-audit Round 11 — comprehensive depth, June 2026 (v2.1.13)

> 7 audit angles, 5 PRs that turned up real wins (#70–#74). User asked to
> "try as much as iterations to validate and improve comprehensively."

## What this round shipped

| Angle | Outcome |
|-------|---------|
| **CI workflow** | First GitHub Actions on the repo (frontend `check:all` + backend `pytest`). Resolved the long-running "what is the backend for?" ambiguity: it's the canonical reference impl (`nutrition_scorer.py` = the 536-line algorithmic spec). |
| **Web Vitals** | Homepage FCP **2272ms → 620ms (−73%)**, Scan **2100ms → 372ms (−82%)**. Root cause was `Prompt` (5 weights) + `Plus Jakarta Sans` Google fonts loaded on every page with **zero consumers** — no `font-display` / `font-thai` class anywhere. |
| **Deep a11y** | 5 of 6 public pages had no `<main>` landmark — WCAG 2.1 AA failure. Wrapped content in `<main>`, added `aria-label` to scan's hidden file inputs and pricing's promo input. 6 new permanent guards. |
| **Schema audit** | `users.language` was hardcoded `'th'` on register regardless of locale. Latent (unread) but wrong; fixed. Two truly dead columns (`healthInfo`, `usageTracking`) documented in KNOWN_ISSUES for a future D1 migration. |
| WebKit/Safari iPhone 13 smoke | 6/6 clean — no Safari-specific bugs |
| Interaction-time console | 0 notable messages across 7 user-action stages |
| i18n quality heuristic | 35 flags reviewed, all defensible (brand terms, marketing tier names) |

## Final test posture after Round 11
- Frontend unit: **171/171** ✓ (+2)
- Frontend e2e: **93/93** ✓ (+6 a11y `<main>`-landmark guards)
- Backend unit: **129/129** ✓
- CI now runs on every PR
- 6 of 6 public pages have `<main>` landmark (was 1 of 6)
- 6 of 6 public pages under "good" FCP threshold

---

# 📱 UX-audit Round 10 — mobile + perf hygiene, June 2026 (v2.1.12)

> Drove the rendered UI for real (not just `/api/analyze` probes) and surveyed
> across 3 mobile widths × 5 pages.

| Bug | Severity | PR |
|---|---|---|
| Global avatar preload fired on every page, but only the homepage uses the base `shinny_avatar.png` (other pages use variants); browser logged "preloaded but not used" on 4 of 5 pages + wasted ~40KB per page | Low | #67 |
| `/pricing` "Apply Code" button overflowed iPhone-SE viewport by ~24px — flex `min-width: auto` trap with a `whitespace-nowrap` button | Low–Med | #68 |
| **Found but NOT a code bug**: scan UI returned the Cloudflare Llama fallback (weaker) during the audit because Google Gemini was responding 503 "high demand". External outage. | — | — |

Released as **v2.1.12**.

---

# 🧹 UX-audit Round 9 — unwired-element sweep, June 2026 (v2.1.11)

> User asked: "no unwired function and element in frontend and backend." A
> static audit (export → import callers, t-key → source references, tier-flag
> → consumer queries, model → endpoint usage) found a cluster of dead code
> shipped across earlier rounds.

| Finding | Where | PR |
|---|---|---|
| `GradientButton`, `GlassCard` — 0 callers; referenced a stale brand palette (`BrandOrange/Magenta/Violet`) | `src/components/ui/` (whole dir deleted) | #63 |
| `cn()` helper + `clsx` + `tailwind-merge` deps — only used by the two deleted components | `src/lib/utils.ts`, `package.json` | #63 |
| `isFeatureAvailable` (×2), `canScan`, `canAskAI` — all defined, zero callers | `tier-config.ts`, `auth-store.ts` | #63 |
| 25 orphan i18n keys × 4 locales (~100 strings) | `messages/{th,en,de,da}.json` | #63 |
| `FavoriteRecipe`, `DailyTip` SQLAlchemy models — defined, never queried | `backend/app/models/` | #64 |
| `requirements.txt` pinned `python-cors==1.0.0` — package doesn't exist on PyPI | `backend/requirements.txt` | #65 |
| passlib 1.7.4 vs bcrypt 4.x incompat — broke 3/129 tests on fresh install | `backend/requirements.txt` | #65 |

Released as **v2.1.11**.

---

# 🔐 UX-audit Round 8 — live-deploy + authed surfaces, May 2026 (v2.1.10)

> Drove Playwright against the **live deploy** and the authenticated surfaces
> with a session cookie. Caught one shipped-but-undetected regression plus
> latent bugs.

| Bug | Severity | PR |
|---|---|---|
| Anonymous visitors hit a **401 console error on every page** (`SiteHeader` → `initAuth` → `/api/auth/me`); introduced by the Round-7 iter-3 header extraction | Medium | #56 |
| Homepage hero CTA said "Start Scanning" while dashboard/demo said "Start your scan" in EN/DE/DA — iter-2's canonicalization was left half-done | Low–Med | #57 |
| Footer hardcoded "Version 2.1.7" vs `package.json` 2.1.9; `/api/health` reported "unknown" | Low | #58 |
| Locale-aware 404's anti-dead-end CTAs **dead-ended** — bare `/scan` 404'd again, bare `/` dropped locale | Medium | #59 |
| `/chat` **unreachable on hard-load** for logged-in users — redirect race fired on the pre-probe `isAuthenticated === false`, bouncing `/chat → /login → /dashboard` | **High** (feature unreachable) | #61 |
| Flaky live rate-limit e2e (per-instance `Map` + CF request-spreading) | — | #60 |

Pattern stated bluntly in the round's own notes: the `401` and the
chat-unreachable bugs both shipped because earlier rounds verified with
"compiles + unit-green + string looks right" instead of running the e2e suite
against the live deploy. Lesson codified: **running e2e against the deploy is
a hard gate, not optional**.

Released as **v2.1.10** + **v2.1.11** (the version SSOT pin from #58 cascaded).

---

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