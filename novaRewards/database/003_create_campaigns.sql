-- Migration 003: Create campaigns table
-- Requirements: 7.2, 7.3

CREATE TABLE IF NOT EXISTS campaigns (
  id          SERIAL PRIMARY KEY,
  merchant_id INTEGER     NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  name        VARCHAR(255) NOT NULL,
  reward_rate NUMERIC(18, 7) NOT NULL CHECK (reward_rate > 0),
  start_date  DATE        NOT NULL,
  end_date    DATE        NOT NULL CHECK (end_date > start_date),
  is_active   BOOLEAN     DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campaigns_merchant_id ON campaigns (merchant_id);
