-- Migration 012: Create user_balance table and sync trigger
-- Keeps a running balance per user, updated atomically on every point_transaction insert.
-- Requirements: #190

CREATE TABLE IF NOT EXISTS user_balance (
  user_id     INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  balance     INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast balance lookups (PK covers it, but explicit for clarity)
CREATE INDEX IF NOT EXISTS idx_user_balance_user_id ON user_balance (user_id);

-- -----------------------------------------------------------------------
-- Trigger function: upsert user_balance on every point_transaction insert
-- -----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sync_user_balance()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_balance (user_id, balance, updated_at)
    VALUES (NEW.user_id, NEW.balance_after, NOW())
  ON CONFLICT (user_id)
    DO UPDATE SET
      balance    = NEW.balance_after,
      updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger to point_transactions (fires after each INSERT)
DROP TRIGGER IF EXISTS trg_sync_user_balance ON point_transactions;

CREATE TRIGGER trg_sync_user_balance
  AFTER INSERT ON point_transactions
  FOR EACH ROW
  EXECUTE FUNCTION sync_user_balance();

-- Seed user_balance from existing point_transactions (idempotent)
INSERT INTO user_balance (user_id, balance)
  SELECT
    user_id,
    GREATEST(0, SUM(
      CASE
        WHEN type IN ('earned', 'bonus', 'referral') THEN amount
        WHEN type IN ('redeemed', 'expired')         THEN -amount
        ELSE 0
      END
    ))
  FROM point_transactions
  GROUP BY user_id
ON CONFLICT (user_id) DO UPDATE
  SET balance    = EXCLUDED.balance,
      updated_at = NOW();
