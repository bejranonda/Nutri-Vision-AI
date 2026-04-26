# Admin bootstrap

> ⚠️ **Pick your own email.** Every example in this document uses
> `you@example.com` as a placeholder. Do NOT deploy with the literal
> example address — an attacker who reads the public docs can guess
> the email of your bootstrap admin account, cutting the work needed
> for a credential-stuffing attack in half. Substitute a real address
> you control (a mailbox you can receive password-reset mail at once
> that feature exists) before running any of these commands.

The `users.is_admin` column is `NOT NULL DEFAULT 0`, and the public
`/api/auth/register` endpoint never sets it. So after a fresh deploy:

- Zero admins exist.
- `/admin` redirects every visitor to `/login`.
- Nobody can see the admin console, and nobody can create an admin via
  the UI.

That's intentional — privilege escalation via the public sign-up flow
is impossible. The first admin has to be inserted out-of-band with
`wrangler`, using credentials the operator holds in their own password
manager.

## One-time bootstrap

Run these three commands from your own terminal (where you have
`wrangler` authenticated against the Shinny Cloudflare account). None
of them exist in git, and the password never touches a commit.

### 1. Make sure the `is_admin` column is applied to prod

```bash
cd frontend
npx wrangler d1 migrations apply eatinorder-db --remote
```

Idempotent — safe to re-run. `IF NOT EXISTS` guards every index, and
`ADD COLUMN` is a no-op if the column already exists.

### 2. Insert the admin row

Generate a PBKDF2 hash the app can verify. Easiest path is the
bootstrap script already used by the Claude Code session that created
the first admin — but for a manual run, use any tool that produces the
same `iterations:salt_hex:hash_hex` format that `lib/crypto.ts`
produces. The parameters are:

- Iterations: `100_000`
- Salt: 16 random bytes, hex-encoded
- Hash: PBKDF2-SHA256, 32 bytes output, hex-encoded

One-liner (Node 19+):

```bash
node -e '
import("node:crypto").then(async ({ randomBytes, randomUUID }) => {
  const pw = process.env.PW || randomBytes(18).toString("base64url");
  const salt = new Uint8Array(randomBytes(16));
  const km = await crypto.subtle.importKey("raw", new TextEncoder().encode(pw), "PBKDF2", false, ["deriveBits"]);
  const hb = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: salt.buffer, iterations: 100000, hash: "SHA-256" }, km, 32 * 8);
  const hex = b => Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2,"0")).join("");
  console.log("EMAIL=" + (process.env.EMAIL || "you@example.com"));
  console.log("PASSWORD=" + pw);
  console.log("USER_ID=" + randomUUID());
  console.log("HASH=100000:" + hex(salt.buffer) + ":" + hex(hb));
});
'
```

Capture the output (the password prints once). Then:

```bash
npx wrangler d1 execute eatinorder-db --remote --command "
INSERT INTO users
  (id, email, display_name, hashed_password, subscription_tier,
   language, scans_this_month, streak_days, total_points,
   is_admin, created_at)
VALUES
  ('<USER_ID>', '<EMAIL>', 'Shinny Admin', '<HASH>',
   'family', 'th', 0, 0, 0, 1, strftime('%s','now'));
"
```

### 3. Verify

```bash
npx wrangler d1 execute eatinorder-db --remote --command \
  "SELECT id, email, is_admin, subscription_tier FROM users WHERE is_admin = 1;"
```

You should see exactly one row. Log in to the app with the email/password
you captured, then visit `/admin` — the operator console should render.

## Adding more admins

Once one admin exists, promote others from `/admin/users` by clicking
**Grant admin** on their row. The `/api/admin/users/toggle-admin` endpoint
re-verifies the caller is an admin (via `requireAdminApi()`), prevents
the caller from revoking themselves, and emits an audit log entry.

## Revoking the last admin

There's no UI path to revoke the last admin (the toggle endpoint blocks
self-revocation). If you need to revoke a compromised admin account and
you have zero other admins:

1. Promote another user to admin first, using `wrangler` against `users.is_admin`.
2. Sign in as the new admin.
3. Use `/admin/users` to revoke the compromised account.

## Pilot-mode: turning on voucher-gated registration

Once the admin user exists, the next step for a pilot launch is to **close
public registration**. Set a Cloudflare Pages environment variable:

```bash
echo -n "true" | \
  npx wrangler pages secret put VOUCHER_REQUIRED_FOR_REGISTRATION --project-name=eatinorder
```

While this flag is on:

- `/api/auth/register` rejects requests without a valid voucher (HTTP 400, `{ reason: 'voucher_required' }`).
- The registration UI shows the voucher-code field as required.
- All other paths (login, scan, admin) are unaffected.

The flag is read at request time, so flipping it doesn't require a redeploy.

To distribute pilot codes:

1. Sign in as the admin → `/admin/promo` → "Registration vouchers" tab.
2. **Personal code** for a single named user: kind = Personal (auto-locks `usageLimit` to 1), notes = the recipient's name.
3. **Organization code** for a cohort (e.g. 50 employees of a partner): kind = Organization, set `usageLimit` to the seat count, notes = the org name.
4. Pick an expiry date (or leave blank for no expiry). Click "Random" for a 6-char suffix if you don't want to type one.
5. Copy the code from the table (clipboard button next to each code) and share it with the recipient.

The recipient pastes the code on the registration form. If the code is valid the form's voucher field shows ✓ and an inline message ("Code unlocks family tier for 30 days · 12 seats left"). On submit, the user's account is created, the voucher's `usageCount` is incremented, and a row is added to `code_redemptions` so the voucher trail is auditable.

## Optional: register the admin email as a Cloudflare Pages secret

If you want server code to recognise the bootstrap admin without
hard-coding the email anywhere in git, you can expose it as a Pages
secret:

```bash
echo -n "you@example.com" | \
  npx wrangler pages secret put ADMIN_BOOTSTRAP_EMAIL --project-name=eatinorder
```

Nothing currently reads this secret — it's there in case a future
feature (e.g. "highlight the bootstrap admin in /admin/users") wants a
stable handle that survives email changes.

## Security notes

- The admin password is **only** stored in the `users.hashed_password`
  column as a PBKDF2 hash. Not in git, not in a CF secret, not in any
  file this repo ships.
- `lib/crypto.ts` uses constant-time byte comparison, so login timing
  doesn't leak the hash prefix.
- `/admin/*` pages and `/api/admin/*` routes are both dynamic
  (`force-dynamic`) and both re-verify admin auth on every request —
  no cached "admin HTML" can leak to a non-admin.
- Every admin action emits a `[ADMIN_ACTION]` log entry with actor,
  target, and before/after values. Tail these in the Cloudflare
  dashboard's real-time log stream.
