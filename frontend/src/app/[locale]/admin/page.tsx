/**
 * /admin — landing page. Quick-glance operational stats.
 *
 * Stats we compute here are intentionally lightweight (COUNT queries
 * on small-to-medium tables). If `food_scans` grows into the millions
 * this will need an indexed "last 24h" filter or a cached aggregate.
 */
import Link from 'next/link';
import { and, eq, gt, sql } from 'drizzle-orm';
import { requireAdmin } from '@/lib/admin-auth';
import { getEnvSafe } from '@/lib/cloudflare';
import { getDb } from '@/db';
import { users, foodScans, promoCodes, sessions } from '@/db/schema';

export const dynamic = 'force-dynamic';

interface Stats {
  totalUsers: number;
  adminCount: number;
  activeSessions: number;
  scansLast24h: number;
  scanErrorsLast24h: number;
  activePromoCodes: number;
}

async function loadStats(): Promise<Stats | null> {
  let env;
  try {
    env = await getEnvSafe();
  } catch {
    return null;
  }
  const db = getDb(env);
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // COUNT(*) in Drizzle: cast to sql.as<number> for typed return.
  const countAs = <T extends string>(alias: T) =>
    sql<number>`count(*)`.as(alias);

  const [usersRow] = await db
    .select({ n: countAs('n') })
    .from(users);

  const [adminsRow] = await db
    .select({ n: countAs('n') })
    .from(users)
    .where(eq(users.isAdmin, true));

  const [sessionsRow] = await db
    .select({ n: countAs('n') })
    .from(sessions)
    .where(gt(sessions.expiresAt, now));

  const [scansRow] = await db
    .select({ n: countAs('n') })
    .from(foodScans)
    .where(gt(foodScans.createdAt, oneDayAgo));

  const [scanErrorsRow] = await db
    .select({ n: countAs('n') })
    .from(foodScans)
    .where(
      and(
        gt(foodScans.createdAt, oneDayAgo),
        // errorClass !== null means the scan failed somewhere.
        sql`${foodScans.errorClass} IS NOT NULL`,
      ),
    );

  const [promosRow] = await db
    .select({ n: countAs('n') })
    .from(promoCodes)
    .where(eq(promoCodes.isActive, true));

  return {
    totalUsers: Number(usersRow?.n ?? 0),
    adminCount: Number(adminsRow?.n ?? 0),
    activeSessions: Number(sessionsRow?.n ?? 0),
    scansLast24h: Number(scansRow?.n ?? 0),
    scanErrorsLast24h: Number(scanErrorsRow?.n ?? 0),
    activePromoCodes: Number(promosRow?.n ?? 0),
  };
}

function StatCard({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: 'default' | 'warn';
}) {
  const ring =
    tone === 'warn'
      ? 'ring-rose-200 bg-rose-50'
      : 'ring-slate-200 bg-white';
  return (
    <div className={`rounded-xl ring-1 ${ring} p-4 shadow-sm`}>
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="text-3xl font-black text-slate-900 mt-1">{value}</div>
      {hint && <div className="text-xs text-slate-500 mt-1">{hint}</div>}
    </div>
  );
}

export default async function AdminHome({
  params: { locale },
}: {
  params: { locale: string };
}) {
  // Defence-in-depth: the layout already calls requireAdmin, but every
  // page re-runs it so no page can be reached without the gate even if
  // the layout chain ever changes. Cheap — the session query is a
  // single indexed lookup.
  const admin = await requireAdmin(locale);
  const stats = await loadStats();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900">Operational overview</h1>
        <p className="text-sm text-slate-600">
          Read-only dashboard. Actions (toggle admin, flip tier, toggle
          promo) live in the sub-pages below.
        </p>
      </div>

      {!stats && (
        <div className="rounded-xl bg-amber-50 ring-1 ring-amber-200 p-4 text-sm text-amber-900">
          Couldn&apos;t load stats — the D1 binding is unavailable. This
          usually means you&apos;re running locally without{' '}
          <code className="font-mono">--remote</code>. The admin page
          itself works; the counts below will appear once the DB is
          reachable.
        </div>
      )}

      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCard label="Registered users" value={stats.totalUsers} />
          <StatCard
            label="Admins"
            value={stats.adminCount}
            hint={stats.adminCount === 0 ? 'None yet — bootstrap one via wrangler' : undefined}
          />
          <StatCard
            label="Active sessions"
            value={stats.activeSessions}
            hint="Non-expired tokens in the sessions table"
          />
          <StatCard label="Scans (last 24h)" value={stats.scansLast24h} />
          <StatCard
            label="Scan errors (24h)"
            value={stats.scanErrorsLast24h}
            tone={stats.scanErrorsLast24h > 0 ? 'warn' : 'default'}
            hint="Rows with errorClass IS NOT NULL"
          />
          <StatCard label="Active promo codes" value={stats.activePromoCodes} />
        </div>
      )}

      <div className="rounded-xl ring-1 ring-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-2">
          Shortcuts
        </h2>
        <ul className="text-sm text-slate-700 space-y-1">
          <li>
            <Link href={`/${locale}/admin/users`} className="text-rose-600 hover:underline">
              Users →
            </Link>{' '}
            promote/demote admins, flip subscription tier
          </li>
          <li>
            <Link href={`/${locale}/admin/promo`} className="text-rose-600 hover:underline">
              Promo codes →
            </Link>{' '}
            create, toggle active, inspect usage
          </li>
          <li>
            <Link href={`/${locale}/admin/health`} className="text-rose-600 hover:underline">
              Health →
            </Link>{' '}
            live binding status (AI, DB, Google API key)
          </li>
        </ul>
      </div>

      <div className="text-xs text-slate-400">
        You are logged in as <span className="font-mono">{admin.email}</span>
        &nbsp;· admin ID <span className="font-mono">{admin.id.substring(0, 8)}…</span>
      </div>
    </div>
  );
}
