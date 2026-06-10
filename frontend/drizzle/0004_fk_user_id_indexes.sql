-- 0004: secondary indexes on hot FK columns (KNOWN_ISSUES "Ongoing
-- Follow-ups #4", shipped Round 14).
--
-- "All rows for user X" queries on these tables full-scanned because
-- only the PKs / unique constraints were indexed. All four statements
-- are additive and idempotent (IF NOT EXISTS) — safe to apply to the
-- live D1 at any time, no data movement, no app coordination needed.
--
-- Apply (merger, per ITERATION_PROCESS §7):
--   cd frontend && npx wrangler d1 migrations apply eatinorder-db --remote
CREATE INDEX IF NOT EXISTS `sessions_user_id_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `code_redemptions_user_id_idx` ON `code_redemptions` (`user_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `food_scans_user_id_idx` ON `food_scans` (`user_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `chat_messages_user_id_idx` ON `chat_messages` (`user_id`);
