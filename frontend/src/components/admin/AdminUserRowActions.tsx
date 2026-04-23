'use client';

/**
 * Per-row admin actions: toggle is_admin + change subscriptionTier.
 *
 * Minimal on purpose — no modals, no toast library, no optimistic UI.
 * Each action hits a server API, shows a native confirm() for
 * destructive flips (promoting a non-admin to admin, demoting an
 * admin), and refreshes the server component when it succeeds.
 *
 * The API endpoints re-verify admin auth via requireAdminApi — this
 * client component never trusts its own state.
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';

const TIERS = ['free', 'premium', 'family'] as const;

export default function AdminUserRowActions({
  userId,
  email,
  isAdmin,
  currentTier,
}: {
  userId: string;
  email: string;
  isAdmin: boolean;
  currentTier: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<null | 'admin' | 'tier'>(null);
  const [err, setErr] = useState<string | null>(null);

  async function toggleAdmin() {
    const verb = isAdmin ? 'REVOKE admin from' : 'GRANT admin to';
    // Native confirm keeps the dependency footprint at zero and is
    // sufficient for a two-person admin console.
    if (!confirm(`${verb} ${email}?`)) return;
    setErr(null);
    setBusy('admin');
    try {
      const res = await fetch('/api/admin/users/toggle-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, makeAdmin: !isAdmin }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setErr(body.error || `HTTP ${res.status}`);
        return;
      }
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function changeTier(newTier: string) {
    if (newTier === currentTier) return;
    setErr(null);
    setBusy('tier');
    try {
      const res = await fetch('/api/admin/users/update-tier', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, tier: newTier }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setErr(body.error || `HTTP ${res.status}`);
        return;
      }
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex items-center gap-2 justify-end">
      <select
        defaultValue={currentTier}
        disabled={busy !== null}
        onChange={(e) => changeTier(e.target.value)}
        className="text-xs border border-slate-300 rounded-md px-2 py-1 bg-white disabled:opacity-50"
        aria-label={`Subscription tier for ${email}`}
      >
        {TIERS.map((t) => (
          <option key={t} value={t}>{t}</option>
        ))}
      </select>
      <button
        type="button"
        onClick={toggleAdmin}
        disabled={busy !== null}
        className={`text-xs font-semibold px-2 py-1 rounded-md border disabled:opacity-50 ${
          isAdmin
            ? 'border-rose-300 text-rose-700 hover:bg-rose-50'
            : 'border-slate-300 text-slate-700 hover:bg-slate-100'
        }`}
      >
        {busy === 'admin' ? '…' : isAdmin ? 'Revoke admin' : 'Grant admin'}
      </button>
      {err && <span className="text-xs text-rose-600" role="alert">{err}</span>}
    </div>
  );
}
