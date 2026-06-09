/**
 * /admin/users — user list + per-row actions.
 *
 * Scope of actions in this version:
 *   - Toggle is_admin (use the dedicated button; double-confirm client-side)
 *   - Change subscriptionTier (select dropdown)
 *
 * Intentionally read-mostly:
 *   - No bulk actions (one mistake = N broken accounts).
 *   - No "delete user" button — data loss would be irreversible on D1.
 *   - No password reset (that flow needs the email transport built first).
 *
 * Pagination is simple offset-based. Cheap on small tables; swap to
 * keyset-pagination once users > 100K.
 */
import { desc } from 'drizzle-orm';
import { requireAdmin } from '@/lib/admin-auth';
import { getEnvSafe } from '@/lib/cloudflare';
import { getDb } from '@/db';
import { users } from '@/db/schema';
import AdminUserRowActions from '@/components/admin/AdminUserRowActions';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 25;

type UserRow = {
  id: string;
  email: string;
  displayName: string | null;
  subscriptionTier: string | null;
  isAdmin: boolean;
  createdAt: Date | null;
  scansThisMonth: number | null;
};

async function loadUsers(offset: number): Promise<UserRow[]> {
  let env;
  try {
    env = await getEnvSafe();
  } catch {
    return [];
  }
  const db = getDb(env);
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
      subscriptionTier: users.subscriptionTier,
      isAdmin: users.isAdmin,
      createdAt: users.createdAt,
      scansThisMonth: users.scansThisMonth,
    })
    .from(users)
    .orderBy(desc(users.createdAt))
    .limit(PAGE_SIZE + 1) // fetch one extra to detect "has next"
    .offset(offset);
  return rows as UserRow[];
}

function formatDate(d: Date | null): string {
  if (!d) return '—';
  return d.toISOString().slice(0, 10);
}

export default async function AdminUsersPage({
  params: { locale },
  searchParams,
}: {
  params: { locale: string };
  searchParams?: { page?: string };
}) {
  await requireAdmin(locale);

  const page = Math.max(1, Number(searchParams?.page) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const rows = await loadUsers(offset);
  const hasNext = rows.length > PAGE_SIZE;
  const visible = rows.slice(0, PAGE_SIZE);

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-black text-slate-900">Users</h1>
        <p className="text-xs text-slate-500">
          Page {page} · {visible.length} shown
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl ring-1 ring-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="text-left px-4 py-2 font-medium">Email</th>
              <th className="text-left px-4 py-2 font-medium">Tier</th>
              <th className="text-left px-4 py-2 font-medium">Admin</th>
              <th className="text-left px-4 py-2 font-medium">Scans / mo</th>
              <th className="text-left px-4 py-2 font-medium">Joined</th>
              <th className="text-right px-4 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visible.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500 text-sm">
                  No users on this page.
                </td>
              </tr>
            )}
            {visible.map((u) => (
              <tr key={u.id} className="hover:bg-slate-50">
                <td className="px-4 py-2">
                  <div className="font-medium text-slate-900">{u.email}</div>
                  <div className="text-xs text-slate-500">
                    {u.displayName ?? '—'} · <span className="font-mono">{u.id.substring(0, 8)}</span>
                  </div>
                </td>
                <td className="px-4 py-2">
                  <span className="text-xs font-semibold px-2 py-1 rounded-md bg-slate-100 text-slate-700">
                    {u.subscriptionTier ?? 'free'}
                  </span>
                </td>
                <td className="px-4 py-2">
                  {u.isAdmin ? (
                    <span className="text-xs font-bold px-2 py-1 rounded-md bg-rose-100 text-rose-700">
                      ADMIN
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400">—</span>
                  )}
                </td>
                <td className="px-4 py-2 text-slate-700">{u.scansThisMonth ?? 0}</td>
                <td className="px-4 py-2 text-slate-600">{formatDate(u.createdAt)}</td>
                <td className="px-4 py-2 text-right">
                  <AdminUserRowActions
                    userId={u.id}
                    email={u.email}
                    isAdmin={u.isAdmin}
                    currentTier={u.subscriptionTier ?? 'free'}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm">
        {page > 1 ? (
          <a
            className="text-rose-600 hover:underline"
            href={`/${locale}/admin/users?page=${page - 1}`}
          >
            ← previous
          </a>
        ) : <span />}
        {hasNext ? (
          <a
            className="text-rose-600 hover:underline"
            href={`/${locale}/admin/users?page=${page + 1}`}
          >
            next →
          </a>
        ) : <span />}
      </div>
    </div>
  );
}
