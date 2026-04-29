-- Migration 015: Extend transactions for lifecycle management
-- Requirements: #352

ALTER TABLE transactions
  DROP CONSTRAINT IF EXISTS transactions_tx_type_check;

ALTER TABLE transactions
  ALTER COLUMN from_wallet DROP NOT NULL,
  ALTER COLUMN to_wallet DROP NOT NULL,
  ALTER COLUMN merchant_id DROP NOT NULL;

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'completed',
  ADD COLUMN IF NOT EXISTS reference_tx_hash VARCHAR(64),
  ADD COLUMN IF NOT EXISTS refund_reason TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS reconciled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE transactions
  DROP CONSTRAINT IF EXISTS transactions_status_check;

ALTER TABLE transactions
  ADD CONSTRAINT transactions_tx_type_check
    CHECK (tx_type IN ('distribution', 'redemption', 'transfer', 'refund'));

ALTER TABLE transactions
  ADD CONSTRAINT transactions_status_check
    CHECK (status IN ('pending', 'completed', 'failed', 'refunded', 'reconciled'));

CREATE INDEX IF NOT EXISTS idx_transactions_status
  ON transactions (status);

CREATE INDEX IF NOT EXISTS idx_transactions_reference_tx_hash
  ON transactions (reference_tx_hash);

CREATE INDEX IF NOT EXISTS idx_transactions_merchant_status_created
  ON transactions (merchant_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_transactions_user_status_created
  ON transactions (user_id, status, created_at DESC);
