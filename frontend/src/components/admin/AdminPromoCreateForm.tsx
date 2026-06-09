'use client';

/**
 * Create-voucher form. Two paths through the same form depending on
 * `defaultScope`:
 *
 *   - 'registration' — sign-up gating voucher. Default kind = Personal
 *     (usageLimit = 1) since these are typically issued to a named
 *     pilot user; admin can flip to Organization for cohort vouchers.
 *
 *   - 'upgrade' — classic promo-code path; default kind = Organization
 *     since these are typically launch promos for a wider audience.
 *
 * "Personal" and "Organization" are UI affordances, not separate
 * fields in the DB — both compile to the existing `usageLimit` column
 * (Personal = 1, Organization = N). Keeping a single source of truth
 * means admin queries don't need a join.
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Type = 'TRIAL' | 'DISCOUNT' | 'FANCLUB' | 'REFERRAL';
type Tier = 'premium' | 'family';
type Kind = 'personal' | 'organization';

function generateRandomCode(prefix = 'CODE'): string {
  // 6 random base32-ish characters (no I/L/O/0/1 — avoid mis-reads).
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let suffix = '';
  for (let i = 0; i < 6; i++) {
    suffix += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `${prefix}-${suffix}`;
}

export default function AdminPromoCreateForm({
  defaultScope = 'registration',
}: {
  defaultScope?: 'registration' | 'upgrade';
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [kind, setKind] = useState<Kind>(defaultScope === 'registration' ? 'personal' : 'organization');
  const [usageLimit, setUsageLimit] = useState<number>(defaultScope === 'registration' ? 1 : 100);

  function onKindChange(next: Kind) {
    setKind(next);
    if (next === 'personal') setUsageLimit(1);
    else if (usageLimit === 1) setUsageLimit(50);
  }

  async function onSubmit(formData: FormData) {
    setErr(null);
    setOk(null);
    setSubmitting(true);
    try {
      const body = {
        code: String(formData.get('code') || '').trim().toUpperCase(),
        type: String(formData.get('type') || 'TRIAL') as Type,
        scope: String(formData.get('scope') || defaultScope) as 'registration' | 'upgrade',
        grantTier: String(formData.get('grantTier') || 'premium') as Tier,
        trialDays: Number(formData.get('trialDays') || 0) || undefined,
        // Force Personal = 1 server-side too even if the user fiddles
        // with the number input while the kind is Personal.
        usageLimit: kind === 'personal' ? 1 : Number(formData.get('usageLimit') || 0) || undefined,
        notes: String(formData.get('notes') || '').trim() || undefined,
        expiresAt: String(formData.get('expiresAt') || '').trim() || undefined,
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
      setCode('');
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  const codePrefix = defaultScope === 'registration' ? 'PILOT' : 'PROMO';
  return (
    <form action={onSubmit} className="space-y-3 text-sm">
      <input type="hidden" name="scope" value={defaultScope} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <label className="flex flex-col gap-1 md:col-span-2">
          <span className="text-xs text-slate-600">Code</span>
          <div className="flex gap-2">
            <input
              name="code"
              required
              maxLength={64}
              pattern="[A-Za-z0-9_-]+"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ''))}
              placeholder="PILOT-CHULA-01"
              className="flex-1 border border-slate-300 rounded-md px-2 py-1 font-mono uppercase"
            />
            <button
              type="button"
              onClick={() => setCode(generateRandomCode(codePrefix))}
              className="text-xs px-2 py-1 border border-slate-300 rounded-md hover:bg-slate-100 text-slate-700 whitespace-nowrap"
              title="Insert a random 6-char suffix"
            >
              Random
            </button>
          </div>
          <span className="text-[11px] text-slate-500">A-Z, 0-9, dash, underscore. Operator-readable; visible to anyone with the code.</span>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-slate-600">Kind</span>
          <div className="flex border border-slate-300 rounded-md overflow-hidden">
            {(['personal', 'organization'] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => onKindChange(k)}
                className={`flex-1 px-2 py-1 text-xs font-semibold ${
                  kind === k ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {k === 'personal' ? 'Personal' : 'Organization'}
              </button>
            ))}
          </div>
        </label>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-slate-600">Type</span>
          <select name="type" className="border border-slate-300 rounded-md px-2 py-1 bg-white">
            <option value="TRIAL">TRIAL</option>
            <option value="DISCOUNT">DISCOUNT</option>
            <option value="FANCLUB">FANCLUB</option>
            <option value="REFERRAL">REFERRAL</option>
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-slate-600">Grants tier</span>
          <select name="grantTier" defaultValue="premium" className="border border-slate-300 rounded-md px-2 py-1 bg-white">
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
            min={1}
            max={1000000}
            value={usageLimit}
            onChange={(e) => setUsageLimit(Number(e.target.value))}
            disabled={kind === 'personal'}
            className="border border-slate-300 rounded-md px-2 py-1 disabled:bg-slate-100 disabled:text-slate-500"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-slate-600">Expires</span>
          <input
            name="expiresAt"
            type="date"
            className="border border-slate-300 rounded-md px-2 py-1"
            placeholder="Optional"
          />
        </label>
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-xs text-slate-600">Notes (admin-only)</span>
        <input
          name="notes"
          maxLength={500}
          placeholder="e.g. Summer pilot — 50 seats for Chula nutrition dept"
          className="border border-slate-300 rounded-md px-2 py-1"
        />
      </label>

      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={submitting}
          className="px-3 py-1.5 bg-rose-600 text-white font-semibold text-sm rounded-md hover:bg-rose-700 disabled:opacity-50"
        >
          {submitting ? 'Creating…' : 'Create voucher'}
        </button>
        {err && <span className="text-sm text-rose-600" role="alert">{err}</span>}
        {ok && <span className="text-sm text-green-600">{ok}</span>}
      </div>
    </form>
  );
}
