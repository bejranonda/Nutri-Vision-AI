/**
 * /admin/scans — recent scans across all users (KNOWN_ISSUES 0b).
 *
 * Purpose: spot AI-pipeline regressions from the product side — a spike
 * of `timeout` / `parse_error` rows, or every scan suddenly landing on
 * the Gemini fallback instead of the CF primary, is visible here in one
 * glance without Cloudflare log access.
 *
 * PII posture (the design decision 0b asked for): METADATA ONLY.
 *   - Photos were never stored (`/api/analyze` writes imageUrl: null by
 *     design — no R2 integration), so there is nothing visual to leak.
 *   - No email column. Rows show a truncated userId; cross-reference in
 *     /admin/users if an investigation truly needs the account. Food
 *     names (detectedItems) stay summarised as a count, not listed.
 *
 * Read-only: no actions, no mutations — same "read-mostly" philosophy
 * as /admin/users, with zero rows at risk.
 */
import { desc, eq } from 'drizzle-orm';
import { requireAdmin } from '@/lib/admin-auth';
import { getEnvSafe } from '@/lib/cloudflare';
import { getDb } from '@/db';
import { foodScans } from '@/db/schema';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 50;

type ScanRow = {
  id: string;
  userId: string | null;
  detectedItems: unknown;
  scoreOverall: number | null;
  modelUsed: string | null;
  scanMode: string | null;
  errorClass: string | null;
  createdAt: Date | null;
};

async function loadScans(offset: number, errorClass?: string): Promise<ScanRow[]> {
  let env;
  try {
    env = await getEnvSafe();
  } catch {
    return [];
  }
  const db = getDb(env);
  const base = db
    .select({
      id: foodScans.id,
      userId: foodScans.userId,
      detectedItems: foodScans.detectedItems,
      scoreOverall: foodScans.scoreOverall,
      modelUsed: foodScans.modelUsed,
      scanMode: foodScans.scanMode,
      errorClass: foodScans.errorClass,
      createdAt: foodScans.createdAt,
    })
    .from(foodScans);
  const filtered = errorClass ? base.where(eq(foodScans.errorClass, errorClass)) : base;
  const rows = await filtered
    .orderBy(desc(foodScans.createdAt))
    .limit(PAGE_SIZE + 1)
    .offset(offset);
  return rows as ScanRow[];
}

function formatWhen(d: Date | null): string {
  if (!d) return '—';
  return d.toISOString().slice(0, 16).replace('T', ' ');
}

function itemCount(detectedItems: unknown): number {
  return Array.isArray(detectedItems) ? detectedItems.length : 0;
}

const ERROR_FILTERS = ['timeout', 'parse_error', 'provider_error', 'binding_missing'] as const;

export default async function AdminScansPage({
  params: { locale },
  searchParams,
}: {
  params: { locale: string };
  searchParams?: { page?: string; errorClass?: string };
}) {
  await requireAdmin(locale);

  const page = Math.max(1, Number(searchParams?.page) || 1);
  const offset = (page - 1) * PAGE_SIZE;
  const errorClass = searchParams?.errorClass || undefined;

  const rows = await loadScans(offset, errorClass);
  const hasNext = rows.length > PAGE_SIZE;
  const visible = rows.slice(0, PAGE_SIZE);

  const base = `/${locale}/admin/scans`;

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-black text-slate-900">Scans</h1>
        <p className="text-xs text-slate-500">
          Page {page} · {visible.length} shown{errorClass ? ` · filter: ${errorClass}` : ''}
        </p>
      </div>

      {/* errorClass filter chips */}
      <div className="flex gap-2 flex-wrap text-xs">
        <a
          href={base}
          className={`px-2.5 py-1 rounded-md ring-1 ${!errorClass ? 'bg-slate-900 text-white ring-slate-900' : 'bg-white text-slate-700 ring-slate-200 hover:bg-slate-50'}`}
        >
          all
        </a>
        {ERROR_FILTERS.map((ec) => (
          <a
            key={ec}
            href={`${base}?errorClass=${ec}`}
            className={`px-2.5 py-1 rounded-md ring-1 ${errorClass === ec ? 'bg-rose-600 text-white ring-rose-600' : 'bg-white text-slate-700 ring-slate-200 hover:bg-slate-50'}`}
          >
            {ec}
          </a>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl ring-1 ring-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="text-left px-4 py-2 font-medium">When (UTC)</th>
              <th className="text-left px-4 py-2 font-medium">User</th>
              <th className="text-left px-4 py-2 font-medium">Mode</th>
              <th className="text-left px-4 py-2 font-medium">Items</th>
              <th className="text-left px-4 py-2 font-medium">Score</th>
              <th className="text-left px-4 py-2 font-medium">Model</th>
              <th className="text-left px-4 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visible.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500 text-sm">
                  No scans on this page.
                </td>
              </tr>
            )}
            {visible.map((s) => (
              <tr key={s.id} className="hover:bg-slate-50">
                <td className="px-4 py-2 text-slate-600 whitespace-nowrap font-mono text-xs">{formatWhen(s.createdAt)}</td>
                <td className="px-4 py-2 font-mono text-xs text-slate-500">{s.userId ? s.userId.substring(0, 8) : 'anon'}</td>
                <td className="px-4 py-2 text-slate-700">{s.scanMode ?? '—'}</td>
                <td className="px-4 py-2 text-slate-700">{itemCount(s.detectedItems)}</td>
                <td className="px-4 py-2 text-slate-700">{s.errorClass ? '—' : `${Math.round(s.scoreOverall ?? 0)}/100`}</td>
                <td className="px-4 py-2 text-xs text-slate-600">{s.modelUsed ?? '—'}</td>
                <td className="px-4 py-2">
                  {s.errorClass ? (
                    <span className="text-xs font-bold px-2 py-1 rounded-md bg-rose-100 text-rose-700">{s.errorClass}</span>
                  ) : (
                    <span className="text-xs font-semibold px-2 py-1 rounded-md bg-emerald-100 text-emerald-700">ok</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-sm">
        {page > 1 ? (
          <a className="text-slate-600 hover:text-slate-900 underline" href={`${base}?page=${page - 1}${errorClass ? `&errorClass=${errorClass}` : ''}`}>
            ← Newer
          </a>
        ) : (
          <span />
        )}
        {hasNext && (
          <a className="text-slate-600 hover:text-slate-900 underline" href={`${base}?page=${page + 1}${errorClass ? `&errorClass=${errorClass}` : ''}`}>
            Older →
          </a>
        )}
      </div>
    </div>
  );
}
