-- Migration 004: Create transactions table
-- Requirements: 3.4, 4.3, 5.4

CREATE TABLE IF NOT EXISTS transactions (
  id             SERIAL PRIMARY KEY,
  tx_hash        VARCHAR(64)   NOT NULL UNIQUE,
  tx_type        VARCHAR(20)   NOT NULL CHECK (tx_type IN ('distribution', 'redemption', 'transfer')),
  amount         NUMERIC(18, 7) NOT NULL,
  from_wallet    VARCHAR(56)   NOT NULL,
  to_wallet      VARCHAR(56)   NOT NULL,
  merchant_id    INTEGER       NOT NULL REFERENCES merchants(id),
  campaign_id    INTEGER       REFERENCES campaigns(id),
  stellar_ledger INTEGER,
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- B-tree indexes on wallet columns to avoid full table scans when querying by address
-- Requirements: 3.4, 4.3
CREATE INDEX IF NOT EXISTS idx_transactions_from_wallet ON transactions (from_wallet);
CREATE INDEX IF NOT EXISTS idx_transactions_to_wallet   ON transactions (to_wallet);
