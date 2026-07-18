-- Migration 014: Create redemptions table and idempotency keys table
-- Requirements: #190 (redemption logic)

-- Redemptions table: permanent audit log of every successful redemption
CREATE TABLE IF NOT EXISTS redemptions (
  id              SERIAL        PRIMARY KEY,
  user_id         INTEGER       NOT NULL REFERENCES users(id),
  reward_id       INTEGER       NOT NULL REFERENCES rewards(id),
  points_spent    INTEGER       NOT NULL CHECK (points_spent > 0),
  idempotency_key VARCHAR(255)  NOT NULL UNIQUE,
  status          VARCHAR(20)   NOT NULL DEFAULT 'completed'
                                CHECK (status IN ('completed', 'refunded')),
  point_tx_id     INTEGER       REFERENCES point_transactions(id),
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_redemptions_user_id    ON redemptions (user_id);
CREATE INDEX IF NOT EXISTS idx_redemptions_reward_id  ON redemptions (reward_id);
CREATE INDEX IF NOT EXISTS idx_redemptions_idem_key   ON redemptions (idempotency_key);
CREATE INDEX IF NOT EXISTS idx_redemptions_created_at ON redemptions (created_at);
