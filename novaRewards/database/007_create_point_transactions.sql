-- Migration 007: Create point_transactions table for leaderboard aggregation
-- Requirements: #185

CREATE TABLE IF NOT EXISTS point_transactions (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER       NOT NULL REFERENCES users(id),
  points     NUMERIC(18,2) NOT NULL,
  type       VARCHAR(20)   NOT NULL CHECK (type IN ('earned', 'redeemed', 'expired')),
  created_at TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Composite index for efficient GROUP BY aggregation filtered by date range
CREATE INDEX IF NOT EXISTS idx_pt_user_created ON point_transactions (user_id, created_at);
