-- Migration 002: Create users table
-- Wallet address is the primary identity; no passwords stored.

CREATE TABLE IF NOT EXISTS users (
  id             SERIAL PRIMARY KEY,
  wallet_address VARCHAR(56) NOT NULL UNIQUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
