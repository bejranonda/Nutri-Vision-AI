/**
 * /admin/promo — promo code table with "create new" + "toggle active".
 *
 * Existing codes come from `lib/promo-codes.ts` seeding; anything
 * created here is stored in D1 and takes effect immediately for new
 * redemptions.
 */
import { desc } from 'drizzle-orm';
import { requireAdmin } from '@/lib/admin-auth';
import { getEnvSafe } from '@/lib/cloudflare';
import { getDb } from '@/db';
import { promoCodes } from '@/db/schema';
import AdminPromoCreateForm from '@/components/admin/AdminPromoCreateForm';
import AdminPromoToggleButton from '@/components/admin/AdminPromoToggleButton';

export const dynamic = 'force-dynamic';

interface PromoRow {
  id: string;
  code: string;
  type: string | null;
  grantTier: string | null;
  trialDays: number | null;
  usageCount: number | null;
  usageLimit: number | null;
  isActive: boolean | null;
  expiresAt: Date | null;
}

async function loadPromoCodes(): Promise<PromoRow[]> {
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
      grantTier: promoCodes.grantTier,
      trialDays: promoCodes.trialDays,
      usageCount: promoCodes.usageCount,
      usageLimit: promoCodes.usageLimit,
      isActive: promoCodes.isActive,
      expiresAt: promoCodes.expiresAt,
    })
    .from(promoCodes)
    .orderBy(desc(promoCodes.createdAt))
    .limit(100);
  return rows as PromoRow[];
}

function formatDate(d: Date | null): string {
  if (!d) return '—';
  return d.toISOString().slice(0, 10);
}

export default async function AdminPromoPage({
  params: { locale },
}: {
  params: { locale: string };
}) {
  await requireAdmin(locale);
  const rows = await loadPromoCodes();

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-black text-slate-900">Promo codes</h1>
        <p className="text-xs text-slate-500">{rows.length} code(s)</p>
      </div>

      <details className="rounded-xl ring-1 ring-slate-200 bg-white p-4">
        <summary className="cursor-pointer font-semibold text-sm text-slate-800">
          + Create new promo code
        </summary>
        <div className="mt-3">
          <AdminPromoCreateForm />
        </div>
      </details>

      <div className="overflow-x-auto rounded-xl ring-1 ring-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="text-left px-4 py-2 font-medium">Code</th>
              <th className="text-left px-4 py-2 font-medium">Type</th>
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
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500 text-sm">
                  No promo codes yet.
                </td>
              </tr>
            )}
            {rows.map((p) => {
              const limit = p.usageLimit ?? 0;
              const used = p.usageCount ?? 0;
              return (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2 font-mono font-semibold text-slate-900">{p.code}</td>
                  <td className="px-4 py-2 text-slate-700">{p.type ?? '—'}</td>
                  <td className="px-4 py-2 text-slate-700">
                    {p.grantTier ?? 'premium'}
                    {p.trialDays ? <span className="text-slate-500"> · {p.trialDays}d trial</span> : null}
                  </td>
                  <td className="px-4 py-2 text-slate-700">
                    {used}<span className="text-slate-400"> / {limit || '∞'}</span>
                  </td>
                  <td className="px-4 py-2 text-slate-600">{formatDate(p.expiresAt)}</td>
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
