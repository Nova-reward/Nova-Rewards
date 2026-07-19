-- Migration 024: password_reset_tokens table
-- Closes #348

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT        NOT NULL,          -- bcrypt hash of the raw token
  expires_at TIMESTAMPTZ NOT NULL,
  used_at    TIMESTAMPTZ,                   -- set when token is consumed
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prt_user_id    ON password_reset_tokens (user_id);
CREATE INDEX IF NOT EXISTS idx_prt_expires_at ON password_reset_tokens (expires_at);
