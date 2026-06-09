/**
 * /admin/promo — voucher and promo-code management.
 *
 * Two scopes are visible: registration vouchers (used at sign-up to
 * unlock account creation during pilot mode) and upgrade promos (used
 * by logged-in users to upgrade tier). Operator selects which tab to
 * view; default is `registration` because that's the pilot focus.
 *
 * Each row shows: code (with copy button), notes, kind (Personal /
 * Organization, derived from usageLimit), usage bar, expiry, active
 * toggle. The create form distinguishes the two scopes and exposes
 * the new voucher fields.
 */
import { desc, eq } from 'drizzle-orm';
import { requireAdmin } from '@/lib/admin-auth';
import { getEnvSafe } from '@/lib/cloudflare';
import { getDb } from '@/db';
import { promoCodes } from '@/db/schema';
import AdminPromoCreateForm from '@/components/admin/AdminPromoCreateForm';
import AdminPromoToggleButton from '@/components/admin/AdminPromoToggleButton';
import AdminCopyButton from '@/components/admin/AdminCopyButton';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

interface PromoRow {
  id: string;
  code: string;
  type: string | null;
  scope: string | null;
  notes: string | null;
  grantTier: string | null;
  trialDays: number | null;
  usageCount: number | null;
  usageLimit: number | null;
  isActive: boolean | null;
  expiresAt: Date | null;
  createdAt: Date | null;
}

async function loadPromoCodes(scope: 'registration' | 'upgrade'): Promise<PromoRow[]> {
  let env;
  try {
    env = await getEnvSafe();
  } catch {
    return [];
  }
  const db = getDb(env);
  const rows = await db
    .select({
      id: promoCodes.id,
      code: promoCodes.code,
      type: promoCodes.type,
      scope: promoCodes.scope,
      notes: promoCodes.notes,
      grantTier: promoCodes.grantTier,
      trialDays: promoCodes.trialDays,
      usageCount: promoCodes.usageCount,
      usageLimit: promoCodes.usageLimit,
      isActive: promoCodes.isActive,
      expiresAt: promoCodes.expiresAt,
      createdAt: promoCodes.createdAt,
    })
    .from(promoCodes)
    .where(eq(promoCodes.scope, scope))
    .orderBy(desc(promoCodes.createdAt))
    .limit(200);
  return rows as PromoRow[];
}

function formatDate(d: Date | null): string {
  if (!d) return '—';
  return d.toISOString().slice(0, 10);
}

function daysUntil(d: Date | null): string {
  if (!d) return 'no expiry';
  const diff = Math.floor((new Date(d).getTime() - Date.now()) / (24 * 3600 * 1000));
  if (diff < 0) return 'expired';
  if (diff === 0) return 'today';
  return `${diff}d`;
}

function kindBadge(usageLimit: number | null) {
  // Personal voucher = exactly one seat. Anything else (or unlimited)
  // shows up as Organization.
  const isPersonal = usageLimit === 1;
  return (
    <span
      className={`text-xs font-semibold px-2 py-0.5 rounded ${
        isPersonal ? 'bg-purple-100 text-purple-700' : 'bg-sky-100 text-sky-700'
      }`}
    >
      {isPersonal ? 'Personal' : 'Organization'}
    </span>
  );
}

function UsageBar({ used, limit }: { used: number; limit: number | null }) {
  if (!limit || limit <= 0) {
    return <span className="text-xs text-slate-600">{used} / ∞</span>;
  }
  const pct = Math.min(100, Math.round((used / limit) * 100));
  const tone =
    pct >= 100 ? 'bg-rose-500' : pct >= 80 ? 'bg-amber-500' : 'bg-green-500';
  return (
    <div className="w-32">
      <div className="text-xs text-slate-600 mb-0.5">{used} / {limit}</div>
      <div className="h-1.5 rounded-full bg-slate-200 overflow-hidden">
        <div className={`h-full ${tone}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default async function AdminPromoPage({
  params: { locale },
  searchParams,
}: {
  params: { locale: string };
  searchParams?: { scope?: string };
}) {
  await requireAdmin(locale);
  const scope: 'registration' | 'upgrade' =
    searchParams?.scope === 'upgrade' ? 'upgrade' : 'registration';
  const rows = await loadPromoCodes(scope);

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-black text-slate-900">Vouchers &amp; promo codes</h1>
        <p className="text-xs text-slate-500">{rows.length} code(s) in this scope</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200">
        <Link
          href={`/${locale}/admin/promo?scope=registration`}
          className={`px-4 py-2 text-sm font-semibold rounded-t-md ${
            scope === 'registration'
              ? 'bg-white border border-slate-200 border-b-white -mb-px text-slate-900'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Registration vouchers
        </Link>
        <Link
          href={`/${locale}/admin/promo?scope=upgrade`}
          className={`px-4 py-2 text-sm font-semibold rounded-t-md ${
            scope === 'upgrade'
              ? 'bg-white border border-slate-200 border-b-white -mb-px text-slate-900'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Upgrade promos
        </Link>
      </div>

      <details className="rounded-xl ring-1 ring-slate-200 bg-white p-4" open={rows.length === 0}>
        <summary className="cursor-pointer font-semibold text-sm text-slate-800">
          + Create new {scope === 'registration' ? 'registration voucher' : 'upgrade promo'}
        </summary>
        <div className="mt-3">
          <AdminPromoCreateForm defaultScope={scope} />
        </div>
      </details>

      <div className="overflow-x-auto rounded-xl ring-1 ring-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="text-left px-4 py-2 font-medium">Code</th>
              <th className="text-left px-4 py-2 font-medium">Kind</th>
              <th className="text-left px-4 py-2 font-medium">Notes</th>
              <th className="text-left px-4 py-2 font-medium">Grants</th>
              <th className="text-left px-4 py-2 font-medium">Usage</th>
              <th className="text-left px-4 py-2 font-medium">Expires</th>
              <th className="text-left px-4 py-2 font-medium">Status</th>
              <th className="text-right px-4 py-2 font-medium">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-500 text-sm">
                  No {scope} codes yet — create your first one above.
                </td>
              </tr>
            )}
            {rows.map((p) => {
              const used = p.usageCount ?? 0;
              return (
                <tr key={p.id} className="hover:bg-slate-50 align-top">
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold text-slate-900">{p.code}</span>
                      <AdminCopyButton text={p.code} />
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">{p.type ?? '—'}</div>
                  </td>
                  <td className="px-4 py-2">{kindBadge(p.usageLimit)}</td>
                  <td className="px-4 py-2 text-slate-600 max-w-xs">
                    {p.notes ? (
                      <span title={p.notes} className="block truncate">
                        {p.notes}
                      </span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-slate-700">
                    {p.grantTier ?? 'premium'}
                    {p.trialDays ? <span className="text-slate-500"> · {p.trialDays}d</span> : null}
                  </td>
                  <td className="px-4 py-2">
                    <UsageBar used={used} limit={p.usageLimit ?? null} />
                  </td>
                  <td className="px-4 py-2 text-slate-600">
                    <div>{formatDate(p.expiresAt)}</div>
                    <div className="text-xs text-slate-400">{daysUntil(p.expiresAt)}</div>
                  </td>
                  <td className="px-4 py-2">
                    {p.isActive ? (
                      <span className="text-xs font-bold px-2 py-1 rounded-md bg-green-100 text-green-700">ACTIVE</span>
                    ) : (
                      <span className="text-xs text-slate-400">inactive</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <AdminPromoToggleButton id={p.id} code={p.code} isActive={!!p.isActive} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
