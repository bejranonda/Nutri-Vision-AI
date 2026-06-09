-- Voucher-gated registration prerequisites.
--
-- Adds two columns to promo_codes:
--
--   scope  — 'registration' | 'upgrade'. Controls whether a code is usable
--            at sign-up (blocks account creation unless present) or by an
--            already-logged-in user to upgrade their tier. Every existing
--            row defaults to 'upgrade' so the current /api/promo/redeem
--            flow is unchanged.
--
--   notes  — admin-only free-text label ("Summer pilot cohort — 50 seats
--            for Chula nutrition dept."). Never rendered to end users.
--            Helps the operator identify a code's purpose months later.
--
-- Both ADDs are non-destructive and idempotent via IF NOT EXISTS where
-- SQLite syntax allows; for ADD COLUMN, re-running is guarded by the
-- wrangler migration tracker in drizzle/meta/_journal.json.

ALTER TABLE `promo_codes`
  ADD COLUMN `scope` TEXT NOT NULL DEFAULT 'upgrade';

ALTER TABLE `promo_codes`
  ADD COLUMN `notes` TEXT;
