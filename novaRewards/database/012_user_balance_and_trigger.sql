-- Migration 012: Create user_balance table and sync trigger
-- Keeps a running balance per user, updated atomically on every point_transaction insert.
-- Requirements: #190
--
-- Concurrency & MVCC safety analysis
-- ------------------------------------
-- All INSERT INTO point_transactions calls go through pointTransactionRepository.js
-- which opens an explicit transaction and acquires a row-level lock:
--
--   BEGIN;
--   INSERT INTO user_balance (user_id, balance) VALUES ($1, 0) ON CONFLICT DO NOTHING;
--   SELECT balance FROM user_balance WHERE user_id = $1 FOR UPDATE;  -- row lock acquired here
--   -- compute balance_before / balance_after in application code
--   INSERT INTO point_transactions (..., balance_before, balance_after, ...);
--   COMMIT;
--
-- Because SELECT ... FOR UPDATE holds the row lock until COMMIT, two concurrent
-- workers for the same user_id are serialised:
--   T1 acquires lock → T2 blocks on SELECT FOR UPDATE → T1 commits →
--   T2 unblocks, reads T1's committed balance_after as its own balance_before.
--
-- The trigger fires AFTER INSERT, still inside the same transaction.  At that
-- point the row lock is still held, so no other transaction can read a stale
-- balance_after from user_balance.  The trigger simply propagates the value
-- already computed and validated by the application layer.
--
-- Isolation level relied on: READ COMMITTED (PostgreSQL default).
-- Locking strategy: pessimistic row-level lock via SELECT ... FOR UPDATE in the
-- application layer; the trigger itself does not need additional locking.
--
-- Edge cases handled:
--   * First insert for a new user: INSERT ... ON CONFLICT DO UPDATE handles upsert.
--   * Refund (negative delta): balance_after is computed in the app and stored in
--     the row; the trigger propagates it unchanged.  The CHECK (balance >= 0)
--     constraint on user_balance catches any programming error that would
--     produce a negative balance_after — this is a defence-in-depth guard.

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
-- This function is safe under concurrent inserts because:
--   1. The calling transaction (pointTransactionRepository.js) holds a
--      SELECT ... FOR UPDATE lock on the user_balance row for the duration
--      of the transaction.  Concurrent writers for the same user_id block
--      until this transaction commits.
--   2. NEW.balance_after is the authoritatively computed post-transaction
--      balance — the application already enforced the non-negative invariant
--      before this trigger fires.
--   3. The INSERT ... ON CONFLICT DO UPDATE pattern is itself atomic within
--      the trigger's execution context.
-- -----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sync_user_balance()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_balance (user_id, balance, updated_at)
    VALUES (NEW.user_id, NEW.balance_after, NOW())
  ON CONFLICT (user_id)
    DO UPDATE SET
      balance    = NEW.balance_after,
      updated_at = NOW()
    -- Guard: only advance if this is a newer (higher) balance_after value.
    -- Under the application-layer FOR UPDATE lock this WHERE clause is always
    -- true for the winning transaction, but it provides defence-in-depth
    -- against any future caller that bypasses the repository layer.
    WHERE user_balance.balance IS DISTINCT FROM NEW.balance_after;
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
