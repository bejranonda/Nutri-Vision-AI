'use client';

import { useState } from 'react';

/**
 * Tiny copy-to-clipboard button. Used next to voucher codes in the
 * admin table so the operator can grab a code with one click instead
 * of selecting and copying. Shows a 1.5-second "Copied" state for
 * feedback. Falls back silently to a `select+execCommand` path if
 * `navigator.clipboard` isn't available (older browsers, or local
 * dev over plain http).
 */
export default function AdminCopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        // Fallback: legacy execCommand. Hidden textarea trick — works
        // even where the modern API is unavailable.
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Refusing the API call (permission, missing) — drop silently.
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="text-xs text-slate-500 hover:text-slate-900 px-1.5 py-0.5 rounded border border-slate-200 hover:bg-slate-50"
      aria-label={`Copy ${text} to clipboard`}
    >
      {copied ? '✓ Copied' : label}
    </button>
  );
}
