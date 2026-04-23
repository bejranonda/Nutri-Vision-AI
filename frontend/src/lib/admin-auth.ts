/**
 * Admin-auth boundary.
 *
 * Every `/admin/*` page and every `/api/admin/*` route goes through one
 * of the helpers below before doing anything. Two invariants:
 *
 *   1. The gate runs SERVER-SIDE only. We never trust client claims of
 *      "I'm an admin" — the lookup always goes through the DB.
 *   2. Auth failures produce a 404-like redirect on pages and a plain
 *      401 on API routes. We deliberately do NOT expose "there is an
 *      admin area but you're not in it" — that's information disclosure.
 *      To a non-admin, `/admin` simply looks like any other locked
 *      route that bounces to /login.
 *
 * The `is_admin` column comes from migration 0002. Columns that reveal
 * admin status must NEVER be returned by any public endpoint.
 */
import { redirect } from 'next/navigation';
import { NextResponse } from 'next/server';
import { eq, and, gt } from 'drizzle-orm';
import { getDb } from '@/db';
import { users, sessions } from '@/db/schema';
import { getSessionToken } from '@/lib/session';
import { getEnvSafe } from '@/lib/cloudflare';
import { logger } from '@/lib/logger';

export interface AdminUser {
  id: string;
  email: string;
  displayName: string | null;
  subscriptionTier: string | null;
  isAdmin: true;
}

/**
 * Resolve the current session to a DB user and assert they're an admin.
 *
 * Returns `null` in every failure case (no cookie, expired session,
 * user not found, user is not an admin). The caller decides how to
 * react — pages redirect, API routes 401. Never throws.
 *
 * Admin-lookup failures are logged under `[ADMIN_GATE]` so you can
 * detect probing attempts in real-time log streams.
 */
export async function getCurrentAdminUser(): Promise<AdminUser | null> {
  const token = await getSessionToken();
  if (!token) return null;

  let env;
  try {
    env = await getEnvSafe();
  } catch {
    return null;
  }

  let db;
  try {
    db = getDb(env);
  } catch {
    return null;
  }

  // Session lookup uses the same token + expiresAt guard as /api/auth/me,
  // so an expired token can't reach any admin page/route. This is the
  // same invariant PR #8 introduced for /api/promo/redeem.
  const now = new Date();
  const active = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.token, token), gt(sessions.expiresAt, now)))
    .limit(1);
  if (active.length === 0) return null;

  const row = await db
    .select()
    .from(users)
    .where(eq(users.id, active[0].userId!))
    .limit(1);
  const user = row[0];
  if (!user) return null;
  if (!user.isAdmin) {
    // Log the miss so suspicious patterns (many hits from one token)
    // become visible in the log stream.
    logger.warn('[ADMIN_GATE] Non-admin attempted admin access', {
      userId: user.id.substring(0, 8),
      email: user.email,
    });
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName ?? null,
    subscriptionTier: user.subscriptionTier ?? null,
    isAdmin: true,
  };
}

/**
 * Page-level gate. Call at the top of any server component under
 * `app/[locale]/admin/`. Non-admin visitors are redirected to /login.
 *
 * Returns a non-null AdminUser only if the caller is authorised — TS
 * narrows so the rest of the page can treat it as guaranteed.
 */
export async function requireAdmin(locale: string): Promise<AdminUser> {
  const user = await getCurrentAdminUser();
  if (!user) {
    // Bounce to /login with no query-param hint. We don't want to
    // tell the visitor "admin required" — that leaks the existence of
    // an admin area.
    redirect(`/${locale}/login`);
  }
  return user;
}

/**
 * API-route gate. Call at the top of any /api/admin/* handler.
 *
 * Returns either { user } on success, or a pre-built `NextResponse`
 * with status 401 that the handler should `return` immediately. Using
 * the discriminated union forces the caller to either use the user or
 * return the error — impossible to forget.
 *
 * @example
 *   export async function POST(req: NextRequest) {
 *     const gate = await requireAdminApi();
 *     if ('response' in gate) return gate.response;
 *     const { user } = gate;
 *     // ... gate.user.id is an admin, authorised and typed
 *   }
 */
export async function requireAdminApi(): Promise<
  { user: AdminUser } | { response: NextResponse }
> {
  const user = await getCurrentAdminUser();
  if (!user) {
    // Intentionally vague: don't tell the caller whether they're
    // unauthenticated vs. authenticated-but-not-admin.
    return {
      response: NextResponse.json(
        { error: 'Not authorised' },
        { status: 401 },
      ),
    };
  }
  return { user };
}
