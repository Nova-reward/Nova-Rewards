-- Migration: 019_create_reward_issuances.sql
-- Tracks every reward issuance attempt with idempotency and status.

CREATE TABLE IF NOT EXISTS reward_issuances (
  id              SERIAL PRIMARY KEY,
  idempotency_key VARCHAR(255) NOT NULL UNIQUE,
  campaign_id     INTEGER      REFERENCES campaigns(id) ON DELETE SET NULL,
  user_id         INTEGER      REFERENCES users(id)     ON DELETE SET NULL,
  wallet_address  VARCHAR(56)  NOT NULL,
  amount          NUMERIC(20, 7) NOT NULL,
  status          VARCHAR(20)  NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'confirmed', 'failed')),
  tx_hash         VARCHAR(255),
  error_message   TEXT,
  attempts        INTEGER      NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reward_issuances_campaign ON reward_issuances(campaign_id);
CREATE INDEX IF NOT EXISTS idx_reward_issuances_user     ON reward_issuances(user_id);
CREATE INDEX IF NOT EXISTS idx_reward_issuances_status   ON reward_issuances(status);
