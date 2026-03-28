-- Migration 011: Create drops and drop_claims tables
-- Supports tokenized claim drops with eligibility criteria and Merkle proof verification.

CREATE TABLE IF NOT EXISTS drops (
  id                   SERIAL PRIMARY KEY,
  name                 VARCHAR(255)   NOT NULL,
  token_amount         NUMERIC(18, 7) NOT NULL,
  expires_at           TIMESTAMPTZ    NOT NULL,
  max_claims_per_user  INTEGER        NOT NULL DEFAULT 1,
  eligibility_criteria JSONB          NOT NULL DEFAULT '{}',
  merkle_root          VARCHAR(64),
  is_active            BOOLEAN        NOT NULL DEFAULT TRUE,
  created_at           TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS drop_claims (
  id         SERIAL PRIMARY KEY,
  drop_id    INTEGER     NOT NULL REFERENCES drops(id),
  user_id    INTEGER     NOT NULL REFERENCES users(id),
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_drop_claims_drop_user ON drop_claims (drop_id, user_id);
