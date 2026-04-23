/**
 * POST /api/admin/users/toggle-admin
 *
 * Promote a user to admin or revoke admin status. Gated by requireAdminApi;
 * the caller must themselves be an admin.
 *
 * Safety rail: an admin cannot revoke their own admin status. That would
 * instantly lock everyone out of the admin area if they're the only admin.
 * The revoke-self call returns 403 with a specific error.
 */
import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '@/db';
import { users } from '@/db/schema';
import { getEnvSafe } from '@/lib/cloudflare';
import { requireAdminApi } from '@/lib/admin-auth';
import { zodFailure } from '@/lib/schemas';
import { logger } from '@/lib/logger';

const Body = z.object({
  userId: z.string().min(1).max(64),
  makeAdmin: z.boolean(),
});

export async function POST(req: NextRequest) {
  const gate = await requireAdminApi();
  if ('response' in gate) return gate.response;
  const actingAdmin = gate.user;

  const raw = await req.json().catch(() => null);
  const parsed = Body.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(zodFailure(parsed.error), { status: 400 });
  }
  const { userId, makeAdmin } = parsed.data;

  // Can't revoke your own admin. The opposite (self-promote) is also
  // meaningless because you must already be an admin to call this —
  // but toggling off on yourself is the real footgun we must block.
  if (!makeAdmin && userId === actingAdmin.id) {
    return NextResponse.json(
      { error: 'You cannot revoke your own admin status. Ask another admin.' },
      { status: 403 },
    );
  }

  let env;
  try {
    env = await getEnvSafe();
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
  const db = getDb(env);

  const existing = await db.select({ id: users.id, email: users.email })
    .from(users).where(eq(users.id, userId)).limit(1);
  if (existing.length === 0) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  try {
    await db.update(users).set({ isAdmin: makeAdmin }).where(eq(users.id, userId));
    logger.warn('[ADMIN_ACTION] isAdmin toggled', {
      actor: actingAdmin.email,
      target: existing[0].email,
      makeAdmin,
    });
    return NextResponse.json({ ok: true, isAdmin: makeAdmin });
  } catch (e) {
    logger.error('[ADMIN_ACTION] isAdmin toggle failed', { e });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
