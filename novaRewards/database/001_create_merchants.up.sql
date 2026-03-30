-- Migration 001: Create merchants table
-- Requirements: 7.1

CREATE TABLE IF NOT EXISTS merchants (
  id                SERIAL PRIMARY KEY,
  name              VARCHAR(255) NOT NULL,
  wallet_address    VARCHAR(56)  NOT NULL UNIQUE,
  business_category VARCHAR(100),
  api_key           VARCHAR(64)  NOT NULL UNIQUE,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
