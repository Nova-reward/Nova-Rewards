-- Migration 011: Harden point_transactions schema
-- Adds UUID, balance tracking columns, and DB-level constraints.
-- Requirements: #190

-- 1. Add uuid extension if not already present
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Add uuid column (populated for existing rows, then set as default)
ALTER TABLE point_transactions
  ADD COLUMN IF NOT EXISTS uuid UUID NOT NULL DEFAULT gen_random_uuid();

-- 3. Add balance tracking columns
ALTER TABLE point_transactions
  ADD COLUMN IF NOT EXISTS balance_before INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS balance_after  INTEGER NOT NULL DEFAULT 0;

-- 4. Change amount to INTEGER (points are whole numbers; drop old numeric column and re-add)
--    We do this safely: add new int column, copy cast values, drop old, rename.
ALTER TABLE point_transactions
  ADD COLUMN IF NOT EXISTS amount_int INTEGER;

UPDATE point_transactions SET amount_int = amount::INTEGER WHERE amount_int IS NULL;

ALTER TABLE point_transactions
  DROP COLUMN amount;

ALTER TABLE point_transactions
  RENAME COLUMN amount_int TO amount;

-- 5. Fix the type enum to include 'expired' and 'referral' (align all migrations)
ALTER TABLE point_transactions
  DROP CONSTRAINT IF EXISTS point_transactions_type_check;

ALTER TABLE point_transactions
  ADD CONSTRAINT point_transactions_type_check
    CHECK (type IN ('earned', 'redeemed', 'expired', 'bonus', 'referral'));

-- 6. amount must be non-zero
ALTER TABLE point_transactions
  DROP CONSTRAINT IF EXISTS point_transactions_amount_nonzero;

ALTER TABLE point_transactions
  ADD CONSTRAINT point_transactions_amount_nonzero
    CHECK (amount <> 0);

-- 7. balanceAfter must be >= 0
ALTER TABLE point_transactions
  DROP CONSTRAINT IF EXISTS point_transactions_balance_after_nonneg;

ALTER TABLE point_transactions
  ADD CONSTRAINT point_transactions_balance_after_nonneg
    CHECK (balance_after >= 0);

-- 8. Unique index on uuid
CREATE UNIQUE INDEX IF NOT EXISTS idx_point_transactions_uuid
  ON point_transactions (uuid);
