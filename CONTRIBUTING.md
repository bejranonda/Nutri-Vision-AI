# Contributing to NutriVision AI

Thank you for your interest in contributing to NutriVision AI! We welcome contributions from the community to help make nutrition analysis and healthy eating more accessible to everyone, especially the Thai community.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [How to Contribute](#how-to-contribute)
- [Code Style Guidelines](#code-style-guidelines)
- [Testing](#testing)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)

## Code of Conduct

This project adheres to a code of conduct that all contributors are expected to follow:

- Be respectful and inclusive
- Welcome newcomers and help them get started
- Focus on constructive feedback
- Respect differing viewpoints and experiences
- Accept responsibility for mistakes and learn from them

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/Nutri-Vision-AI.git
   cd Nutri-Vision-AI
   ```
3. **Add upstream remote**:
   ```bash
   git remote add upstream https://github.com/bejranonda/Nutri-Vision-AI.git
   ```

## Development Setup

### Prerequisites

- Docker and Docker Compose
- Node.js 18+ and npm 9+
- Python 3.11+
- Git
- Google Gemini API key

### Installation

1. **Copy environment file**:
   ```bash
   cp .env.example .env
   ```

2. **Add your API keys** to `.env`:
   ```env
   GEMINI_API_KEY=your_key_here
   GOOGLE_AI_API_KEY=your_key_here
   SECRET_KEY=generate_with_openssl_rand_hex_32
   JWT_SECRET_KEY=another_secret_key
   ```

3. **Cloudflare credentials** for the frontend / D1 / Pages live in
   `frontend/.env.local` (separate file, also gitignored):
   ```env
   # Token scopes: D1:Edit, Workers Scripts:Edit, Pages:Edit,
   # User Details:Read, AND User Memberships:Read.
   # The "Edit Cloudflare Workers" token template covers all of these.
   CLOUDFLARE_API_TOKEN=your_token_here
   # Required when your token has access to >1 Cloudflare account.
   CLOUDFLARE_ACCOUNT_ID=your_account_id_here
   ```
   Wrangler auto-reads `frontend/.env.local`. Don't export these in your
   shell profile — keeping them per-project lets one machine work
   against multiple Cloudflare accounts cleanly. See
   [`docs/GUIDELINE.md`](docs/GUIDELINE.md) → *Cloudflare / wrangler env*.

4. **Start the development environment**:
   ```bash
   docker-compose up
   ```

5. **In another terminal, run migrations**:
   ```bash
   docker-compose exec backend alembic upgrade head
   docker-compose exec backend python app/db/seed_data.py
   ```

6. **Access the application**:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8000
   - API Docs: http://localhost:8000/docs

### Running Without Docker

**Frontend**:
```bash
cd frontend
npm install
npm run dev
```

**Backend**:
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

## How to Contribute

### Reporting Bugs

Before creating a bug report, please check existing issues to avoid duplicates.

Include in your report:
- Clear, descriptive title
- Steps to reproduce
- Expected vs actual behavior
- Screenshots if applicable
- Environment details (OS, browser, versions)

### Suggesting Enhancements

We welcome feature suggestions! Please:
- Use a clear, descriptive title
- Provide detailed explanation of the feature
- Explain why it would be useful
- Include mockups or examples if applicable

### Contributing Code

Areas where we especially welcome contributions:
- 🍜 **Thai Food Database**: Add more Thai recipes and ingredients
- 🌐 **Translations**: Improve Thai and English translations
- 🧪 **Testing**: Add unit and integration tests
- 📱 **UI/UX**: Improve mobile experience
- 🔬 **Nutrition Science**: Enhance scoring algorithms
- 📚 **Documentation**: Improve guides and API docs
- 🐛 **Bug Fixes**: Fix reported issues

## Code Style Guidelines

### Python (Backend)

- Follow **PEP 8** style guide
- Use **type hints** for function parameters and returns
- Maximum line length: **88 characters** (Black default)
- Use **docstrings** for all public functions and classes

Format code with:
```bash
cd backend
black .
isort .
flake8 .
mypy .
```

Example:
```python
from typing import List, Optional

def calculate_nutrition_score(
    nutrients: dict,
    user_goals: Optional[dict] = None
) -> float:
    """
    Calculate overall nutrition score based on 8 dimensions.

    Args:
        nutrients: Dictionary containing nutrient values
        user_goals: Optional user health goals for personalization

    Returns:
        Overall health score from 0-100
    """
    # Implementation here
    pass
```

### TypeScript/JavaScript (Frontend)

- Follow **ESLint** and **Prettier** configurations
- Use **TypeScript** for all new files
- Prefer **functional components** with hooks
- Use **meaningful variable names**

Format code with:
```bash
cd frontend
npm run lint -- --fix
```

Example:
```typescript
interface NutritionScore {
  bloodSugar: number;
  gutHealth: number;
  inflammation: number;
  nutrientDensity: number;
  processingLevel: number;
  proteinQuality: number;
  micronutrients: number;
  overall: number;
}

export function ScoreCard({ score }: { score: NutritionScore }) {
  return (
    <div className="score-card">
      {/* Component implementation */}
    </div>
  );
}
```

## Testing

### Single command you should run before every push

```bash
cd frontend
npm run check:all       # = type-check + check:i18n + test (171/171)

cd ../backend
PYTHONPATH=. python -m pytest -q   # 129/129
```

If any of those fail, the commit isn't ready. The same commands run on every
PR in [`.github/workflows/ci.yml`](.github/workflows/ci.yml) (added Round 11),
so a green local check should also produce a green CI. See
[`docs/ITERATION_PROCESS.md`](docs/ITERATION_PROCESS.md) for the full
zero-error-navigation workflow.

### Backend Tests

```bash
cd backend
pytest -q                      # 129 tests; should run in <10s
pytest --cov=app tests/        # with coverage
```

Write tests for:
- API endpoints (FastAPI routes under `app/api/endpoints/`)
- Nutrition calculation logic (`app/services/nutrition_scorer.py`)
- Database operations (`app/db/`)
- Authentication flows (`app/core/security.py`)

### Frontend Tests (Vitest)

```bash
cd frontend
npm test                        # one-shot
npm run test:watch              # watch mode
```

Tests live under `frontend/tests/` and are **separate** from Next.js
components — vitest deliberately doesn't try to evaluate server
components. Targets:

- `tests/crypto.test.ts` — password hashing, constant-time compare, UUIDs.
- `tests/ai-prompt.test.ts` — prompt builder + response validator.
- `tests/schemas.test.ts` — zod request schemas (login, register, analyze, promo).
- `tests/analyze-fallback.test.ts` — `GEMINI_VISION_MODELS` cascade invariants for `/api/analyze`: every entry must be `gemini-*`, never `gemma-*`, never `-latest$`; route must iterate the constant; response must surface `primaryProviderError`; scan page must use the `startsWith('google-gemini-')` prefix check.

**When to add a test**: any time a user reports a bug that our static
checks missed. See `ITERATION_PROCESS.md §6` ("Iterate until zero-error").

### Full user-journey e2e (for releases and scan/auth/routing PRs)

`tests/e2e/user-journey.spec.ts` (Round 12) walks production end-to-end the
way a real user would — landing + locale switch, photo upload → AI analyze →
terminal result, registration round-trip, recipes/chat/dashboard browse —
through the rendered UI, not API probes. Run it before any release and after
any change to the scan pipeline, auth flow, or routing:

```bash
cd frontend
npx playwright test tests/e2e/user-journey.spec.ts   # ~17s warm, ≤2 min cold
```

Each run costs 1 vision-model call + 1 voucher-rejected registration attempt
(no DB row, no cleanup). Four rules to follow when extending it — terminal-state
assertions, runtime-generated fixtures above client validation floors,
`button[type=submit]` over text selectors, and the shared documented
console-noise filter — are spelled out in
`docs/GUIDELINE.md → The full user-journey lens`.

### Fresh-user audit lens (for PRs that change first-impression surface)

If your PR touches anything a first-time visitor sees in their first 30 seconds — homepage copy, primary CTAs, nav structure, login affordances, pricing tier labels, headline claims, social-login buttons, mascot placement, etc. — also walk through the product with the fresh-user audit lens before declaring done. This is the third leg of the testing stool (alongside Vitest unit and Playwright e2e); Round 7 (May 2026) caught 9 bugs across 9 iterations that 164 unit tests + 79 e2e tests both missed.

**Six-step recipe** (full version in `docs/GUIDELINE.md → The fresh-user audit lens`):

1. Open the deploy preview in an incognito window. Log out, clear cookies. You have **zero context** about the product.
2. **Read every visible string out loud**. Flag jargon ("8-dimension scoring", "GLP-1 hormone", "NOVA classification") that a stranger wouldn't decode.
3. **Click every interactive element**. A button that *looks* live but throws "coming soon" is a visual lie — fix the visual, not the behaviour.
4. **Count code-entry inputs per page**. Two on one page → confusion. One → clarity.
5. **Audit every headline claim** ("Up to X%", "Backed by science"). Each one needs a source link or a qualifier visible to a first-time reader.
6. **Verify the primary CTA is the same string across pages**. Three different "scan" verbs across three pages reads like a janky portfolio.

Round 7's 9 shipped fixes (PRs #46–#53) are listed in `CHANGELOG.md → UX-audit Round 7`. Read the table before doing a Round 8 — pattern-matching against the previous round is faster than rediscovering the same bug class twice.

### Web Vitals + a11y inventory lens (for PRs that change layout, fonts, large assets, or landmark structure)

If your PR touches the locale layout, font imports, hero/above-the-fold imagery, page semantics (`<main>`, `<section>`, headings), or anything that affects what the browser is downloading on first paint, **also run the Web Vitals + a11y inventory lens** before declaring done. Added in Round 11 (June 2026) after the lens caught the homepage FCP at **2272ms** and 5 of 6 public pages missing the `<main>` landmark — defects that 169 unit tests + 80 e2e tests all passed.

**Five-step recipe** (full version in `docs/GUIDELINE.md → The Web-Vitals + a11y inventory lens`):

1. **Capture FCP / LCP / CLS per page** via Playwright (`performance.getEntriesByType('paint')` + a `PerformanceObserver` for `layout-shift`). Flag `FCP > 1800ms`, `LCP > 2500ms`, `CLS > 0.1`. Also sum `content-length` per `content-type` to spot bundle bloat.
2. **Audit font payload** — `grep -rcE "font-display|font-thai|var\(--font-\w+\)" src/` against the families imported in the layout. Zero hits = pure dead weight, delete.
3. **Landmark + label inventory** — count `<main>` (expect 1), `<h1>` (expect 1), and every `input/textarea/select` missing both a `label[for]` and `aria-label`. Pinned in `a11y.spec.ts`.
4. **WebKit smoke** — run the smoke spec via `webkit.launch()` + `devices['iPhone 13']`. Catches Safari-specific bugs Chromium misses.
5. **Schema vs route field usage** — for every column on the affected table, `grep` the codebase for read sites + write sites. Zero hits = dead column, document for migration.

Round 11's wins are summarised in `CHANGELOG.md → UX-audit Round 11` and broken down by audit angle. Read it before running the lens yourself.

### AI-pipeline real-food validation (mandatory before merging)

Static checks cannot verify provider-side breakage — a retired model alias, a `limit: 0` free-tier quota, or a Cloudflare AI model that's rejecting your image format all look identical to a code bug from the user's seat. **For any PR that touches `/api/analyze`, `lib/ai-providers.ts`, `GEMINI_VISION_MODELS`, or related pipeline code**, run a headless probe against the live deploy with a real food image before declaring done:

```bash
B64=$(base64 -w0 research/test-image/buymeacoffee-food-6940159_640.jpg)
printf '{"imageBase64":"data:image/jpeg;base64,%s","locale":"en","scanMode":"meal","photoCount":1}' "$B64" > /tmp/body.json
curl -sS -X POST https://shinnyguide.autobahn.bot/api/analyze \
     -H 'Content-Type: application/json' --data-binary @/tmp/body.json
```

The response must have **`isFood: true`** and a **populated `dishes` array** with scores and an eating sequence. A 200 with `isFood: false` (e.g. the image is a screenshot of the error UI) only exercises the rejection branch and is **not** evidence the success branch works. Record the `modelUsed` value in the PR description.

Three "fixed" PRs (#21, #22, #23) shipped in Apr–May 2026 for the same class of bug because each round's validation only proved the route returned 200 on a non-food image. The rule above exists to break that cycle. Full procedure: `docs/GUIDELINE.md → Before declaring an AI-pipeline fix "shipped"`.

### i18n key drift check

```bash
cd frontend
npm run check:i18n
```

Scans every `useTranslations('ns')` + `t('key')` call and verifies each
key exists in all four locale JSONs (`th`, `en`, `de`, `da`). This is
the gate that would have caught the `scan.dishes_found` regression from
PR #7. Runs as part of `npm run check:all`.

### Request-body validation

All `/api/*` routes that accept JSON parse their body through a zod
schema in `frontend/src/lib/schemas.ts`. **When adding a new route**:

1. Add a `z.object(...)` schema named after the request.
2. `safeParse` the body in the route; return `zodFailure(result.error)`
   with status 400 on failure.
3. Add a unit test in `tests/schemas.test.ts` for the happy path plus
   at least one boundary rejection.

Routes that touch the DB should also handle unique-constraint errors
gracefully — see `/api/auth/register` and `/api/promo/redeem` for the
pattern (catch the driver error, return the same semantic response as
the pre-check path to avoid side-channels).

### Database migrations

Schema lives in `frontend/src/db/schema.ts` (Drizzle ORM). When you
change it, also create a matching SQL file under `frontend/drizzle/` and
register it in `drizzle/meta/_journal.json`. Apply with:

```bash
cd frontend
npx wrangler d1 migrations apply eatinorder-db --local   # dev
npx wrangler d1 migrations apply eatinorder-db --remote  # prod
```

## Commit Guidelines

We follow **Conventional Commits** format:

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, no logic change)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks
- `perf`: Performance improvements

### Examples

```bash
feat(nutrition): add omega-3 to omega-6 ratio calculation

Implements the inflammation score component that calculates
the ratio of omega-3 to omega-6 fatty acids in foods.

Closes #123
```

```bash
fix(auth): prevent token refresh loop

Fixed infinite loop in token refresh logic that occurred
when the refresh token was expired.

Fixes #456
```

```bash
docs(readme): update installation instructions

Added Docker Compose instructions and clarified environment
variable setup process.
```

## Pull Request Process

1. **Create a feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/bug-description
   ```

2. **Make your changes** following the code style guidelines

3. **Write/update tests** for your changes

4. **Run tests and linting**:
   ```bash
   npm run lint
   npm run test
   ```

5. **Commit your changes** following commit guidelines

6. **Push to your fork**:
   ```bash
   git push origin feature/your-feature-name
   ```

7. **Create a Pull Request** on GitHub with:
   - Clear title describing the change
   - Detailed description of what and why
   - Link to related issues (e.g., "Closes #123")
   - Screenshots for UI changes
   - Checklist of completed items

### PR Checklist

Before submitting, ensure:
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex logic
- [ ] Documentation updated
- [ ] Tests added/updated and passing
- [ ] No new warnings
- [ ] Dependent changes merged and published

### Review Process

- Maintainers will review your PR within 3-5 business days
- Address any requested changes
- Once approved, a maintainer will merge your PR
- Your contribution will be included in the next release!

## Additional Resources

- [README.md](README.md) - Project overview
- [🧠 Knowledge Base](docs/KNOWLEDGE_BASE.md) - Architectural decisions and domain logic
- [📜 Development Guideline](docs/GUIDELINE.md) - Detailed coding and logging standards
- [⚠️ Known Issues](docs/KNOWN_ISSUES.md) - Current bugs and technical limitations
- [API Documentation](http://localhost:8000/docs) - Backend API reference
- [PROJECT_PLAN.md](PROJECT_PLAN.md) - Detailed project plan
- [DEPLOYMENT.md](DEPLOYMENT.md) - Deployment guide

## Questions?

- Open a [Discussion](https://github.com/bejranonda/Nutri-Vision-AI/discussions)
- Create an [Issue](https://github.com/bejranonda/Nutri-Vision-AI/issues)
- Email: support@nutrivision.app
- Thai support: support.th@nutrivision.app

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

**Thank you for contributing to NutriVision AI!** 🙏

*"ร่วมมือกันสร้างสุขภาพที่ดีให้คนไทย" - Together building better health for Thai people*
