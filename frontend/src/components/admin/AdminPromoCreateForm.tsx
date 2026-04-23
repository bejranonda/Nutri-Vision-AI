'use client';

/**
 * Create a new promo code. Minimal form — the most common shape is
 * TRIAL + grant premium for N days + cap to M redemptions.
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Type = 'TRIAL' | 'DISCOUNT' | 'FANCLUB' | 'REFERRAL';
type Tier = 'premium' | 'family';

export default function AdminPromoCreateForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  async function onSubmit(formData: FormData) {
    setErr(null);
    setOk(null);
    setSubmitting(true);
    try {
      const body = {
        code: String(formData.get('code') || '').trim().toUpperCase(),
        type: String(formData.get('type') || 'TRIAL') as Type,
        grantTier: String(formData.get('grantTier') || 'premium') as Tier,
        trialDays: Number(formData.get('trialDays') || 0) || undefined,
        usageLimit: Number(formData.get('usageLimit') || 0) || undefined,
      };
      const res = await fetch('/api/admin/promo/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        setErr(b.error || `HTTP ${res.status}`);
        return;
      }
      setOk(`Created ${body.code}`);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      action={onSubmit}
      className="grid grid-cols-1 md:grid-cols-5 gap-2 items-end text-sm"
    >
      <label className="flex flex-col gap-1">
        <span className="text-xs text-slate-600">Code</span>
        <input
          name="code"
          required
          maxLength={64}
          pattern="[A-Za-z0-9_-]+"
          placeholder="SUMMER2026"
          className="border border-slate-300 rounded-md px-2 py-1 font-mono uppercase"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-slate-600">Type</span>
        <select name="type" className="border border-slate-300 rounded-md px-2 py-1">
          <option value="TRIAL">TRIAL</option>
          <option value="DISCOUNT">DISCOUNT</option>
          <option value="FANCLUB">FANCLUB</option>
          <option value="REFERRAL">REFERRAL</option>
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-slate-600">Grants tier</span>
        <select name="grantTier" className="border border-slate-300 rounded-md px-2 py-1">
          <option value="premium">premium</option>
          <option value="family">family</option>
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-slate-600">Trial days</span>
        <input
          name="trialDays"
          type="number"
          min={0}
          max={365}
          defaultValue={30}
          className="border border-slate-300 rounded-md px-2 py-1"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-slate-600">Usage limit</span>
        <input
          name="usageLimit"
          type="number"
          min={0}
          defaultValue={100}
          className="border border-slate-300 rounded-md px-2 py-1"
        />
      </label>
      <div className="md:col-span-5 flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={submitting}
          className="px-3 py-1.5 bg-rose-600 text-white font-semibold text-sm rounded-md hover:bg-rose-700 disabled:opacity-50"
        >
          {submitting ? 'Creating…' : 'Create'}
        </button>
        {err && <span className="text-sm text-rose-600" role="alert">{err}</span>}
        {ok && <span className="text-sm text-green-600">{ok}</span>}
      </div>
    </form>
  );
}
