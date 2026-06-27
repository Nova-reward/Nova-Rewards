-- Migration 018: Merchant API key management
-- Supports multiple keys per merchant, hashed storage, and revocation.

CREATE TABLE IF NOT EXISTS merchant_api_keys (
  id          SERIAL PRIMARY KEY,
  merchant_id INTEGER      NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  key_hash    VARCHAR(64)  NOT NULL UNIQUE,   -- SHA-256 hex of the plaintext key
  label       VARCHAR(100),
  is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  revoked_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_mak_merchant ON merchant_api_keys (merchant_id);
CREATE INDEX IF NOT EXISTS idx_mak_hash     ON merchant_api_keys (key_hash) WHERE is_active = TRUE;
