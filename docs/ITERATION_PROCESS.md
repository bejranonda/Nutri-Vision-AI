# Iteration Process — Zero-Error Navigation

This document defines how changes land on `main` for Nutri-Vision AI /
Shinny Guide. It exists so any contributor can independently verify a PR
is safe to merge without waiting for a reviewer to rediscover the checks
from scratch.

**Goal**: every landed change preserves the invariant that a user
traveling Home → Scan → Results → Back → Dashboard encounters no broken
links, no literal `ns.key` translation strings, no console errors, and
no silent "Coming Soon" dead-ends where the previous build had content.

---

## 0. Philosophical anchor — stay true to the concept

Every PR must preserve the product's core identity:

1. **"Delicious in Order" (อร่อย ตาม ลำดับ)** — the app *always* recommends
   **Veggies → Protein → Carbs → Sweets**. Any change to scoring, prompts,
   or UI copy must not contradict this sequence.
2. **Shinny persona** — friendly, empathetic, never prohibitive. Copy
   that sounds scolding or clinical ("you must not eat X") is a bug.
3. **Bilingual-first, Thai priority** — no feature is complete until all
   four locales (th / en / de / da) have native strings. Romanized
   transliteration in parens (`ซุปปลา (Soup Pla)`) is explicitly forbidden
   in Thai output — native users read it as noise.
4. **Freemium integrity** — tier gates (`free` / `premium` / `family`)
   live in `lib/tier-config.ts`. Don't inline tier logic in components.

Disagreements with the anchor are fine — raise them in an issue first,
don't sneak a deviation into a feature PR.

---

## 1. Per-commit local loop

Run in `frontend/`:

```bash
npm run check:all
```

That runs, in order:

1. `npm run type-check` — `tsc --noEmit`, strict mode.
2. `npm run check:i18n` — every `t('key')` call site exists in all four locales.
3. `npm test` — Vitest unit tests (crypto, ai-prompt validators, zod schemas).

If you touched backend (Python):

```bash
cd backend && pytest -q
```

A commit that breaks any of these doesn't get pushed. No exceptions.

---

## 2. Per-PR remote loop (CI-gated)

When the PR branch is pushed:

| Check | Must pass? | Purpose |
|-------|-----------|---------|
| **Cloudflare Pages** | ✅ yes | Produces the actual deploy preview. Fails on any Next.js build error or ESLint error. |
| **GitGuardian** | ✅ yes | Secrets scan. Never commit API keys / `.env` contents. |
| **CodeRabbit review** | ⚠ advisory | Reads the diff; comments on smells and reach-across-files concerns. Not a gate, but every critical/major comment must be addressed or explicitly dismissed with a reply. |

The Cloudflare preview URL (commented by the CF bot on the PR) is the
**manual smoke surface** — see §4.

---

## 3. Pre-merge manual verification

Before clicking "Merge", the author must do all of these on the CF preview:

1. **Home → Scan happy path** (desktop + mobile viewport):
   - Upload a **real food photo** (a known-good one — `research/test-image/buymeacoffee-food-6940159_640.jpg` is the canonical fixture).
   - Scan completes within ~20s.
   - A `DishCard` renders with a score and a sequence.
   - **A 200 response with `isFood:false` does NOT count.** A non-food image only proves the rejection branch works; it does not prove the success path round-trips through the AI cascade. Three "fixed" PRs went out for the same Gemini-cascade bug in Apr–May 2026 because each round's validation stopped here.
2. **Multi-photo flow**:
   - Upload 2+ photos in meal mode.
   - Overview shows `dishCount === photoCount`.
   - Each `DishCard` shows a thumbnail matching its tile position.
3. **Language switch**:
   - Change locale to Thai.
   - No `scan.*` / `brand.*` etc. strings render as literal keys.
   - No parenthetical English / romanization appears in AI output.
4. **Auth round-trip**:
   - Register a throwaway account → logout → login with the same creds.
   - The dashboard greets the user by name.
5. **Console / network**:
   - 0 red errors in DevTools Console.
   - 0 4xx/5xx responses on the happy path.

For PRs that touch `/api/analyze`, `lib/ai-providers.ts`, `GEMINI_VISION_MODELS`, or related pipeline code, also run the **headless probe** documented in `GUIDELINE.md → Before declaring an AI-pipeline fix "shipped"`. Record the `modelUsed` value the cascade landed on in the PR description.

For PRs that touch `lib/rate-limit.ts` or wire new routes into `rateLimit()`, run a **sequential** burst against the configured limit + 5:

```bash
for i in $(seq 1 35); do
  curl -sS -o /dev/null -w "%{http_code}\n" \
    "https://shinnyguide.autobahn.bot/api/voucher/check?code=SEQ$i"
done
```

Expect the first N (≈ limit) to return 200, then 429s. **Parallel bursts with `&` give false negatives** — concurrent requests scatter across multiple worker instances and each sees its own per-instance bucket. Bug-hunt May 2026 (PR #28) caught this: 40 parallel voucher probes against a 30/min limit all returned 200 while a sequential 35-probe burst from the same machine correctly tripped at request 27. Sequential matches the actual single-IP brute-force threat model.

If any of these fails, the PR goes back to review — no override.

---

## 4. Merge method

Use **Merge** (not Squash) when merging via the GitHub UI or MCP.

**Why**: we hit a silent bug on PR #6 where a `squash` request fell back
to a two-parent merge that dropped the last two commits from the PR
branch (they had landed on the branch *after* GitHub's internal PR
snapshot). Regular merge preserves every commit on the branch, which
is what we want — each commit on a feature branch is deliberately
self-contained and PR-level atomicity isn't the goal.

If squash is ever used (e.g. to collapse noisy WIP commits), **verify
after merge** that every expected commit SHA appears in `git log main`.
PR #7 shipped solely to recover from this silent drop.

---

## 5. Post-merge verification (zero-error navigation)

Within 5 minutes of the merge commit landing on `main`, Cloudflare
Pages will deploy production at <https://shinnyguide.autobahn.bot/>.
The merger must:

1. **Verify the deploy SHA matches the merge commit** — single curl,
   no behavioural inference needed:
   ```bash
   git rev-parse --short main
   # → 9e74084
   curl -s https://shinnyguide.autobahn.bot/api/health | jq -r .deployment.shaShort
   # → 9e74084   ← must match within ~5 min of the merge
   ```
   If the production SHA doesn't move within 10 minutes, check the
   Cloudflare Pages dashboard for a stuck build before retrying §3
   checks (you'd otherwise be validating *old* code and conclude
   "fix didn't work").
2. Click through the same 5 checks from §3 on production.

If any production check fails:
1. File a revert PR *within 15 minutes* (keep the rollback window tight).
2. Open a corresponding entry in `docs/KNOWN_ISSUES.md` under "Open Bugs".
3. If the failure is user-impacting (broken navigation, crashed scan),
   post a short update in the project channel.

---

## 6. Iterate until zero-error

The checks above are the *minimum*. When a user reports a bug not
caught by the current checks, the fix PR must:

1. Add the missing regression test (in `frontend/tests/` or
   `backend/tests/`) that would have caught the bug.
2. If the bug was a class of thing (not a one-off typo), extend the
   automated check suite — either the i18n checker, the prompt
   validator, the zod schemas, or Vitest — so the whole class is
   prevented going forward.

This is the feedback loop. Each iteration adds one more gate. After
enough iterations the "zero-error navigation" goal stops being
aspirational and becomes a default you can't break without noticing.

### What "zero-error navigation" means, concretely

A build is "zero-error" when:
- Every route (`/`, `/scan`, `/dashboard`, `/login`, `/pricing`, `/demo`, `/recipes`) renders without a console error.
- Every visible string is localized in all 4 locales — no literal `ns.key` escapes.
- Every user-facing action either completes successfully or returns a localized, branded error (Shinny voice).
- Every form endpoint is zod-validated and returns a predictable 400/401/403/409/500 shape.
- Every destructive path (register, redeem, logout) is idempotent or race-safe at the DB level.

Not yet fully met (see `docs/KNOWN_ISSUES.md` → "Ongoing Follow-ups"):
- Empirical prompt evaluation in CI.
- Secondary indexes on FK columns.
- Cross-instance rate-limit coordination (current per-instance Map is sufficient for sequential-from-one-IP brute force; distributed multi-PoP attackers can still evade).

---

## 7. Schema migrations as part of the merge

When a PR adds a new migration under `frontend/drizzle/`, the merger must also apply it to the **remote** D1 before declaring the deploy verified:

```bash
cd frontend
npx wrangler d1 migrations list  eatinorder-db --remote   # expect "No migrations to apply!" once applied
npx wrangler d1 migrations apply eatinorder-db --remote
```

Prerequisites (all in `frontend/.env.local`, never in shell env — see
`GUIDELINE.md → Cloudflare / wrangler env`):

- `CLOUDFLARE_API_TOKEN` with `D1:Edit`, `Workers Scripts:Edit`, `Pages:Edit`, `User Details:Read`, **`Memberships:Read`**.
- `CLOUDFLARE_ACCOUNT_ID` pinned to this project's Cloudflare account (mandatory when the token has access to >1 account).

The Cloudflare Pages CI **does not** run D1 migrations as part of `npm run pages:build` — Pages only builds and uploads the bundle. Forgetting the manual `migrations apply` is the most common way a "successful" deploy can ship a schema-broken production. Treat it as part of §3 / §5, not §2.

## 8. Appendix — when you need to add a new check

The project has four layers of static validation:

| Layer | Lives in | Add a new rule by |
|-------|----------|-------------------|
| TypeScript types | `tsconfig.json` | Tighten compiler options; add specific types to replace `any`. |
| i18n keys | `frontend/scripts/check-i18n-keys.mjs` | Extend the regex or add a post-extract validator (e.g. check that `mascot.*` keys are RichText). |
| Unit tests | `frontend/tests/` | One file per module, colocated by domain. |
| Request bodies | `frontend/src/lib/schemas.ts` | Add a `z.object({...})` export + import into the route. |

New checks should be wired into `npm run check:all` so they run as part
of the per-commit loop, not just CI.
