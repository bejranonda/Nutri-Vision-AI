/**
 * Edge-cache sliding-window rate limiter.
 *
 * Closes the "no throttling on auth/voucher/analyze endpoints" gap
 * flagged as a pilot-launch prerequisite. Built on `caches.default`
 * (Workers Cache API) rather than KV / Durable Objects:
 *
 *   - Zero new deps, zero new bindings to provision.
 *   - Works on CF Pages + Workers + node dev (the cache API is
 *     polyfilled by OpenNext in local dev).
 *   - Per-worker-instance, not globally coordinated — a sophisticated
 *     attacker hitting 20+ PoPs concurrently can exceed the limit,
 *     but for brute-forcing login from a single IP this is plenty.
 *     When we need global coordination, swap this helper for an
 *     Upstash Redis or Durable Object-backed limiter; the call site
 *     stays identical.
 *
 *   - NOT suitable for billing-accurate metering. Sliding window
 *     has a ~2x burst tolerance at window boundaries. That's fine
 *     for anti-abuse; we use our scan-quota counters (which go
 *     through D1) for billing.
 *
 * Algorithm
 *   We keep two counters: one for the current window and one for
 *   the previous window. The "effective" count is
 *       current + previous * (1 - elapsedInWindow / windowMs)
 *   which smooths the transition at window boundaries. Store both
 *   in a cache key keyed by (ip, route) with a TTL of 2×window.
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
 * fail open (return allowed:true) on any unexpected condition. This
 * is safer than failing closed because a broken limiter blocking real
 * users is much worse than briefly weakening abuse protection.
 */
export async function rateLimit(
  req: Request,
  opts: { routeLabel: string; limit: number; windowMs: number },
): Promise<RateLimitResult> {
  // Outer try-catch is the belt: any unforeseen runtime issue
  // (caches API not available in this runtime, Request constructor
  // throwing in some OpenNext context, header lookup failure, etc.)
  // collapses into a fail-open allow rather than crashing the route.
  try {
    return await rateLimitInner(req, opts);
  } catch {
    return { allowed: true, count: 0, limit: opts.limit, retryAfterSeconds: 0 };
  }
}

async function rateLimitInner(
  req: Request,
  opts: { routeLabel: string; limit: number; windowMs: number },
): Promise<RateLimitResult> {
  const { routeLabel, limit, windowMs } = opts;
  const key = clientKey(req, routeLabel);
  // Use a URL for the cache key. `caches.default` keys by Request, so
  // we build a synthetic URL that encodes the bucket identity.
  let cacheKey: Request;
  try {
    cacheKey = new Request(`https://rate-limiter.internal/${encodeURIComponent(key)}`);
  } catch {
    // Some constrained runtimes (e.g. certain OpenNext combos) throw
    // when constructing Requests outside an active fetch context.
    // Skip rate-limit gracefully.
    return { allowed: true, count: 0, limit, retryAfterSeconds: 0 };
  }

  // Silent fallback if the Cache API isn't available (e.g. some test
  // runtimes). Fail OPEN — better to let a legitimate request through
  // than to 429 everyone because the limiter is broken.
  let cache: Cache;
  try {
    cache = (caches as any).default as Cache;
    if (!cache) throw new Error('no-default-cache');
  } catch {
    return { allowed: true, count: 0, limit, retryAfterSeconds: 0 };
  }

  const now = Date.now();

  let bucket: Bucket = { currentStartMs: now, currentCount: 0, previousCount: 0 };
  try {
    const hit = await cache.match(cacheKey);
    if (hit) {
      const stored = (await hit.json()) as Bucket;
      if (stored && typeof stored.currentStartMs === 'number') bucket = stored;
    }
  } catch {
    // Cache read failed — treat as empty bucket.
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
    return {
      allowed: false,
      count: Math.ceil(effective),
      limit,
      retryAfterSeconds: Math.max(1, Math.ceil(windowMs / 1000 - (now - bucket.currentStartMs) / 1000)),
    };
  }

  bucket.currentCount += 1;
  try {
    const res = new Response(JSON.stringify(bucket), {
      headers: {
        'content-type': 'application/json',
        // Cache API respects Cache-Control max-age for expiry.
        'cache-control': `max-age=${Math.ceil((2 * windowMs) / 1000)}`,
      },
    });
    await cache.put(cacheKey, res);
  } catch {
    // Best-effort; if the put fails, we'll just re-count on next hit.
  }

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
        'retry-after': String(result.retryAfterSeconds),
        'x-ratelimit-limit': String(result.limit),
        'x-ratelimit-remaining': '0',
      },
    },
  );
}
