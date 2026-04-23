-- Prevent double-redemption of a promo code by the same user.
--
-- Background: /api/promo/redeem previously did a check-then-insert
-- pattern that was vulnerable to a concurrent-request race window
-- (two simultaneous POSTs from the same user could both pass the
-- "already redeemed" check and insert two rows). See CHANGELOG [Unreleased].
--
-- This index + the insert-catch path in the route close that race at
-- the DB level.
CREATE UNIQUE INDEX IF NOT EXISTS `code_redemptions_user_code_unique`
  ON `code_redemptions` (`user_id`, `code_id`);
