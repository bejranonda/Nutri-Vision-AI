'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminPromoToggleButton({
  id,
  code,
  isActive,
}: {
  id: string;
  code: string;
  isActive: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onClick() {
    const verb = isActive ? 'DEACTIVATE' : 'reactivate';
    if (!confirm(`${verb} ${code}?`)) return;
    setErr(null);
    setBusy(true);
    try {
      const res = await fetch('/api/admin/promo/toggle-active', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, isActive: !isActive }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        setErr(b.error || `HTTP ${res.status}`);
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2 justify-end">
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        className={`text-xs font-semibold px-2 py-1 rounded-md border disabled:opacity-50 ${
          isActive
            ? 'border-rose-300 text-rose-700 hover:bg-rose-50'
            : 'border-green-300 text-green-700 hover:bg-green-50'
        }`}
      >
        {busy ? '…' : isActive ? 'Deactivate' : 'Reactivate'}
      </button>
      {err && <span className="text-xs text-rose-600" role="alert">{err}</span>}
    </div>
  );
}
