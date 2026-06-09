/**
 * /admin/health — pretty rendering of /api/health?verbose=1 output.
 *
 * /api/health is already publicly readable and returns non-secret
 * diagnostic data. The verbose flag additionally returns env-var keys
 * (values stay hidden). Admin-gating this view is mostly a matter of
 * UX — we surface it inside the admin console so operators have a
 * "is the AI binding alive?" button in one click.
 */
import { requireAdmin } from '@/lib/admin-auth';
import { getEnvSafe } from '@/lib/cloudflare';

export const dynamic = 'force-dynamic';

interface HealthData {
  status: string;
  timestamp: string;
  latencyMs: number;
  services: {
    ai?: { cloudflare?: string; google?: string; canAnalyze?: boolean };
    database?: string;
    runtime?: string;
  };
  version?: string;
  debug?: { envKeys?: string[]; nodeVersion?: string };
}

async function loadHealth(): Promise<HealthData | { error: string }> {
  // Call getEnvSafe directly from this server component so we don't
  // depend on an HTTP fetch loop back to the same worker. Mirrors the
  // body of /api/health with the verbose view always on for admins.
  let env: any;
  try {
    env = await getEnvSafe();
  } catch (e: any) {
    return { error: e?.message ?? 'env unavailable' };
  }

  const hasAI = !!env?.AI;
  const hasDB = !!env?.DB;
  const hasGoogleKey = !!(env?.GOOGLE_AI_API_KEY || env?.GEMINI_API_KEY);
  const isCloudflareRuntime = env !== (process.env as unknown);

  const sensitivePatterns = ['TOKEN', 'SECRET', 'PASSWORD', 'KEY', 'CREDENTIAL', 'AUTH', 'APIKEY', 'API_KEY'];
  const safeKeys = Object.keys(env || {}).filter(
    (k) => !sensitivePatterns.some((p) => k.toUpperCase().includes(p)),
  );

  const status = hasAI || hasGoogleKey ? 'healthy' : 'degraded';

  return {
    status,
    timestamp: new Date().toISOString(),
    latencyMs: 0,
    services: {
      ai: {
        cloudflare: hasAI ? 'available' : 'unavailable',
        google: hasGoogleKey ? 'configured' : 'unconfigured',
        canAnalyze: hasAI || hasGoogleKey,
      },
      database: hasDB ? 'binding_ok' : 'unconfigured',
      runtime: isCloudflareRuntime ? 'cloudflare' : 'node',
    },
    debug: { envKeys: safeKeys, nodeVersion: process.version },
  };
}

function Row({
  label,
  value,
  good,
}: {
  label: string;
  value: React.ReactNode;
  good?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
      <span className="text-sm text-slate-600">{label}</span>
      <span
        className={`text-sm font-mono ${
          good === true ? 'text-green-700' : good === false ? 'text-rose-700' : 'text-slate-700'
        }`}
      >
        {value}
      </span>
    </div>
  );
}

export default async function AdminHealthPage({
  params: { locale },
}: {
  params: { locale: string };
}) {
  await requireAdmin(locale);
  const h = await loadHealth();

  if ('error' in h) {
    return (
      <div className="rounded-xl bg-rose-50 ring-1 ring-rose-200 p-4 text-sm text-rose-900">
        Health check failed: {h.error}
      </div>
    );
  }

  const overallGood = h.status === 'healthy';
  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-black text-slate-900">Health</h1>
        <span
          className={`text-xs font-bold uppercase tracking-wider px-2 py-1 rounded-md ${
            overallGood ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-800'
          }`}
        >
          {h.status}
        </span>
      </div>

      <div className="rounded-xl ring-1 ring-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-2">
          Services
        </h2>
        <Row
          label="Cloudflare Workers AI"
          value={h.services.ai?.cloudflare ?? '—'}
          good={h.services.ai?.cloudflare === 'available'}
        />
        <Row
          label="Google Gemini key"
          value={h.services.ai?.google ?? '—'}
          good={h.services.ai?.google === 'configured'}
        />
        <Row
          label="D1 database binding"
          value={h.services.database ?? '—'}
          good={h.services.database === 'binding_ok'}
        />
        <Row label="Runtime" value={h.services.runtime ?? '—'} />
      </div>

      {h.debug?.envKeys && (
        <details className="rounded-xl ring-1 ring-slate-200 bg-white p-4">
          <summary className="cursor-pointer text-sm font-semibold text-slate-700">
            Non-sensitive env keys ({h.debug.envKeys.length})
          </summary>
          <pre className="mt-2 text-xs text-slate-700 overflow-x-auto bg-slate-50 p-2 rounded">
            {h.debug.envKeys.sort().join('\n')}
          </pre>
          <p className="text-xs text-slate-500 mt-2">
            Secret-pattern keys (TOKEN / SECRET / PASSWORD / KEY / AUTH) are
            hidden from this list server-side. Actual values are never
            returned.
          </p>
        </details>
      )}
    </div>
  );
}
