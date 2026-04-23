-- Add admin-role flag to users.
--
-- Stored as INTEGER (0/1) per SQLite convention. Drizzle's
-- { mode: 'boolean' } maps it to a TS boolean at the application layer.
--
-- Defaults to 0 so every existing user is automatically a non-admin.
-- The first admin is bootstrapped manually via wrangler — see the
-- session log / KNOWN_ISSUES for the procedure.
ALTER TABLE `users`
  ADD COLUMN `is_admin` INTEGER NOT NULL DEFAULT 0;
