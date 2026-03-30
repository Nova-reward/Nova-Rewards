-- Migration 010: Create point_transactions table for tracking point earnings
-- Requirements: #181

CREATE TABLE IF NOT EXISTS point_transactions (
  id              SERIAL PRIMARY KEY,
  user_id         INTEGER       NOT NULL REFERENCES users(id),
  type            VARCHAR(50)   NOT NULL CHECK (type IN ('earned', 'redeemed', 'referral', 'bonus')),
  amount          NUMERIC(18, 7) NOT NULL,
  description     TEXT,
  referred_user_id INTEGER      REFERENCES users(id),
  campaign_id     INTEGER       REFERENCES campaigns(id),
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_point_transactions_user_id ON point_transactions (user_id);
CREATE INDEX IF NOT EXISTS idx_point_transactions_type ON point_transactions (type);
CREATE INDEX IF NOT EXISTS idx_point_transactions_created_at ON point_transactions (created_at);
CREATE INDEX IF NOT EXISTS idx_point_transactions_referred_user ON point_transactions (referred_user_id);
