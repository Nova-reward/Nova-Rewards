-- Migration 006: Redemption tables for Issue #190 (Duplicate Redemption Fix)
-- Adds user_balances, rewards inventory, and point_transactions with idempotency support.

CREATE TABLE IF NOT EXISTS user_balances (
  id         SERIAL PRIMARY KEY,
  user_id    VARCHAR(56) NOT NULL UNIQUE,  -- Stellar wallet address
  points     NUMERIC(18, 7) NOT NULL DEFAULT 0 CHECK (points >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rewards (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(255) NOT NULL,
  points_cost NUMERIC(18, 7) NOT NULL CHECK (points_cost > 0),
  inventory   INTEGER NOT NULL DEFAULT 0 CHECK (inventory >= 0),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS point_transactions (
  id               SERIAL PRIMARY KEY,
  user_id          VARCHAR(56) NOT NULL,
  reward_id        INTEGER NOT NULL REFERENCES rewards(id),
  points_spent     NUMERIC(18, 7) NOT NULL,
  idempotency_key  VARCHAR(255) NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_point_transactions_idempotency_key UNIQUE (idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_point_transactions_user_id ON point_transactions (user_id);
