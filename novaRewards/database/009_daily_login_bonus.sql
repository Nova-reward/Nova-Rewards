-- Migration 009: Add login tracking columns and extend point_transactions type
-- Requirements: #189

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS last_login_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS daily_bonus_granted_at TIMESTAMPTZ;

-- Extend the type check to include 'bonus'
ALTER TABLE point_transactions
  DROP CONSTRAINT IF EXISTS point_transactions_type_check;

ALTER TABLE point_transactions
  ADD CONSTRAINT point_transactions_type_check
    CHECK (type IN ('earned', 'redeemed', 'expired', 'bonus'));
