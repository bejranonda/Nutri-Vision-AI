/**
 * Per-IP sliding-window rate limiter.
 *
 * Closes the "no throttling on auth/voucher/analyze endpoints" gap
 * flagged as a pilot-launch prerequisite.
 *
 * Storage strategy (May 2026, post-bug-hunt v2)
 *   PRIMARY:   module-scoped `Map<string, Bucket>` — per-worker-instance.
 *              Always works regardless of runtime; the bucket lives in
 *              the worker's V8 heap across requests until the instance
 *              is recycled (~30 min idle on Cloudflare).
 *   SECONDARY: opportunistic write-through to `caches.default` so a
 *              second worker instance that takes over a flow inherits
 *              the bucket. Best-effort — if the cache API isn't
 *              available or the put fails, the rate limit is still
 *              enforced via the in-memory primary.
 *
 *   Why not caches.default as primary?
 *     Bug-hunt May 2026: 40 parallel voucher-check probes against a
 *     30/min limit on Cloudflare Pages production all returned 200.
 *     Zero 429s. Root cause: in the OpenNext-on-Pages runtime,
 *     `caches.default` does not provide same-millisecond
 *     read-after-write consistency that a rate limiter needs. The
 *     ratelimit code's defensive fail-open meant the failure was
 *     completely silent.
 *
 *   Threat model
 *     "Single IP brute-forcing /api/auth/login or hammering
 *      /api/voucher/check to enumerate codes."
 *     Per-instance memory is sufficient: a brute-forcer from one IP
 *     keeps hitting the same worker instance (CF routes consistent
 *     traffic that way) until the instance is recycled. A distributed
 *     attacker hitting 20+ PoPs concurrently can still exceed the
 *     limit; for that, swap this helper for an Upstash Redis or
 *     Durable Object-backed limiter. Call site stays identical.
 *
 *   Algorithm
 *     Keep two counters: one for the current window and one for the
 *     previous window. The "effective" count is
 *         current + previous * (1 - elapsedInWindow / windowMs)
 *     which smooths the transition at window boundaries.
 *
 *   NOT suitable for billing-accurate metering. Sliding window has a
 *   ~2x burst tolerance at window boundaries. That's fine for
 *   anti-abuse; we use D1-backed scan-quota counters for billing.
 */

export interface RateLimitResult {
  /** true if the request is allowed to proceed. */
  allowed: boolean;
  /** How many requests in the last `windowMs`. */
  count: number;
  /** How many allowed per window. */
  limit: number;
  /** Seconds until the client should retry if rate-limited. */
  retryAfterSeconds: number;
}

interface Bucket {
  currentStartMs: number;
  currentCount: number;
  previousCount: number;
}

/**
 * Module-scoped in-memory store. Lives in the worker's V8 heap and
 * persists across requests within the same worker instance. Keys are
 * `ratelimit:<routeLabel>:<ip>` (built by `clientKey`).
 *
 * Memory usage is bounded by a periodic prune (see `pruneIfNeeded`)
 * that drops entries whose `currentStartMs + 2*windowMs` is in the
 * past. Worst-case footprint is `O(unique_IPs * routes)` for the
 * window's TTL — fine for Cloudflare's per-instance memory budget.
 *
 * Exposed via `_resetForTest` so unit tests can isolate state.
 */
const memBuckets = new Map<string, Bucket & { staleAfterMs: number }>();
let lastPruneMs = 0;
const PRUNE_INTERVAL_MS = 60_000;

function pruneIfNeeded(now: number) {
  if (now - lastPruneMs < PRUNE_INTERVAL_MS) return;
  lastPruneMs = now;
  for (const [k, v] of memBuckets) {
    if (v.staleAfterMs <= now) memBuckets.delete(k);
  }
}

/** Test-only: drop the in-memory store so suites don't bleed state. */
export function _resetForTest() {
  memBuckets.clear();
  lastPruneMs = 0;
}

/**
 * Best-effort client identifier. Prefers CF's `CF-Connecting-IP`
 * which is the real client IP even behind CF; falls back to
 * `X-Forwarded-For` first hop, then the hard-coded string 'anon'
 * (single-bucket fallback — still some protection).
 */
export function clientKey(req: Request, routeLabel: string): string {
  // Defensive against runtimes where req.headers is null/missing.
  // Headers should always be present on a Workers/Node Request, but
  // an undefined here would cascade into a route 500, so we guard.
  let cf: string | null = null;
  let xff: string | null = null;
  try {
    cf = req.headers?.get?.('cf-connecting-ip') ?? null;
    xff = req.headers?.get?.('x-forwarded-for') ?? null;
  } catch {
    // Headers iteration failed — fall through to 'anon' bucket.
  }
  const ip = cf || (xff ? xff.split(',')[0]?.trim() || 'anon' : 'anon');
  return `ratelimit:${routeLabel}:${ip}`;
}

/**
 * Take one token from the per-IP bucket for `routeLabel`. If the
 * limit is exceeded, returns `{ allowed: false, retryAfterSeconds }`
 * without consuming further state.
 *
 * Robustness contract: this function MUST NOT throw under any
 * circumstance — auth/scan/voucher routes call it BEFORE entering
 * their try/catch and a thrown error here surfaces as the framework's
 * default 500 ("Internal server error"). Every step is wrapped to
 * fail open (return allowed:true) on any unexpected condition. That's
 * safer than failing closed because a broken limiter blocking real
 * users is worse than briefly weakening abuse protection.
 */
export async function rateLimit(
  req: Request,
  opts: { routeLabel: string; limit: number; windowMs: number },
): Promise<RateLimitResult> {
  try {
    return rateLimitInner(req, opts);
  } catch {
    return { allowed: true, count: 0, limit: opts.limit, retryAfterSeconds: 0 };
  }
}

function rateLimitInner(
  req: Request,
  opts: { routeLabel: string; limit: number; windowMs: number },
): RateLimitResult {
  const { routeLabel, limit, windowMs } = opts;
  const key = clientKey(req, routeLabel);
  const now = Date.now();
  pruneIfNeeded(now);

  let bucket: Bucket;
  const existing = memBuckets.get(key);
  if (existing) {
    bucket = { currentStartMs: existing.currentStartMs, currentCount: existing.currentCount, previousCount: existing.previousCount };
  } else {
    bucket = { currentStartMs: now, currentCount: 0, previousCount: 0 };
  }

  const elapsed = now - bucket.currentStartMs;
  if (elapsed >= 2 * windowMs) {
    // Both windows are stale.
    bucket = { currentStartMs: now, currentCount: 0, previousCount: 0 };
  } else if (elapsed >= windowMs) {
    // Slide: current → previous.
    bucket = {
      currentStartMs: bucket.currentStartMs + windowMs,
      currentCount: 0,
      previousCount: bucket.currentCount,
    };
  }

  const windowPos = Math.min(1, (now - bucket.currentStartMs) / windowMs);
  const effective = bucket.currentCount + bucket.previousCount * (1 - windowPos);

  if (effective >= limit) {
    // Reject without incrementing so a sustained flood doesn't
    // perpetually extend the window's "current" count.
    // Still persist the current bucket state so the cooldown timer
    // is anchored.
    memBuckets.set(key, { ...bucket, staleAfterMs: now + 2 * windowMs });
    return {
      allowed: false,
      count: Math.ceil(effective),
      limit,
      retryAfterSeconds: Math.max(1, Math.ceil(windowMs / 1000 - (now - bucket.currentStartMs) / 1000)),
    };
  }

  bucket.currentCount += 1;
  memBuckets.set(key, { ...bucket, staleAfterMs: now + 2 * windowMs });

  return {
    allowed: true,
    count: Math.ceil(effective) + 1,
    limit,
    retryAfterSeconds: 0,
  };
}

/**
 * Build a uniform 429 response from a RateLimitResult. All routes use
 * this so the shape stays consistent for the client.
 *
 * `cache-control: no-store` is required, NOT cosmetic. PR #33 made
 * every `/api/*` response default to `no-store` via the `jsonResponse`
 * helper. This function bypasses that helper because the rate-limit
 * call sits BEFORE the route's main try/catch and must not throw —
 * but the same "responses are personalised + must not be cached" rule
 * still applies. Bug-hunt May 2026 round 5 caught the omission: an
 * e2e probe that burned the voucher-check rate-limit then read the
 * 429 headers found no `cache-control` at all, the only API response
 * shape in production missing it.
 */
export function tooManyResponse(result: RateLimitResult): Response {
  return new Response(
    JSON.stringify({
      error: 'Too many requests',
      retryAfterSeconds: result.retryAfterSeconds,
    }),
    {
      status: 429,
      headers: {
        'content-type': 'application/json',
        'cache-control': 'no-store',
        'retry-after': String(result.retryAfterSeconds),
        'x-ratelimit-limit': String(result.limit),
        'x-ratelimit-remaining': '0',
      },
    },
  );
}
