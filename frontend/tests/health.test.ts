/**
 * Tests for /api/health.
 *
 * The route is a thin reflection of `getEnvSafe()` output plus a few
 * derived fields — there's little branching to cover. What this suite
 * pins is the **response shape contract**, because /api/health is used
 * by CI smoke checks, deploy verification, and the README's
 * "is this deploy fresh?" curl recipe. A silent rename of a field
 * (e.g. `deployment.sha` → `deployment.commit`) would break those
 * consumers without any compiler signal.
 *
 * We assert against the committed source rather than executing the
 * route — Next.js + OpenNext server bindings make a clean
 * route-as-handler import expensive in a Vitest run, and the static
 * assertions are sufficient to lock the contract.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const HEALTH_ROUTE = resolve(__dirname, '../src/app/api/health/route.ts');

describe('/api/health response shape contract', () => {
  const source = readFileSync(HEALTH_ROUTE, 'utf8');

  it('exposes the deployment metadata block', () => {
    // Bug-hunt May 2026: deployment freshness was previously only
    // verifiable via behavioural probes. The README + GUIDELINE +
    // ITERATION_PROCESS docs now point operators at the
    // `deployment.shaShort` field for the "is this the deploy I
    // think it is?" check. A future contributor renaming or removing
    // any of these keys must update those docs in lockstep — this
    // test forces the breakage to be loud, not silent.
    expect(source).toMatch(/deployment\s*:\s*\{/);
    expect(source).toContain('sha,');
    expect(source).toContain('shaShort');
    expect(source).toContain('branch,');
    expect(source).toContain('pagesUrl,');
  });

  it('reads the deployment metadata from the CF Pages env bindings', () => {
    // CF Pages exposes CF_PAGES_COMMIT_SHA / CF_PAGES_BRANCH / CF_PAGES_URL
    // as env vars at build time. Surfaced through `getEnvSafe()` like
    // any other binding.
    expect(source).toContain('CF_PAGES_COMMIT_SHA');
    expect(source).toContain('CF_PAGES_BRANCH');
    expect(source).toContain('CF_PAGES_URL');
  });

  it('produces a 7-character short SHA derived from the full SHA', () => {
    // `shaShort` lets the README's quick-verify recipe show a SHA
    // that fits inline (e.g. "9e74084"). Forcing the slice length to
    // 7 here keeps the docs and code aligned.
    expect(source).toMatch(/String\(sha\)\.slice\(0,\s*7\)/);
  });

  it('treats unset deployment vars as null (local-dev sentinel)', () => {
    // Local Next.js dev doesn't set CF_PAGES_*; the route MUST NOT
    // emit a partial / fake SHA. `null` is the agreed sentinel.
    expect(source).toMatch(/sha\s*\?\s*String\(sha\)\.slice\(0,\s*7\)\s*:\s*null/);
  });

  it('still surfaces a `status` field at the top level (no breaking change)', () => {
    // CI smoke checks key on this field; renaming would silently
    // break them.
    expect(source).toMatch(/\bstatus\s*:\s*status\b/);
  });
});
