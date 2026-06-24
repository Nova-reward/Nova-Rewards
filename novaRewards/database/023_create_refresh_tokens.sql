-- Migration 023: refresh_tokens table for DB-backed bcrypt rotation
-- Closes #865

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id           SERIAL PRIMARY KEY,
  user_id      INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash   VARCHAR(72) NOT NULL,          -- bcrypt hash (always 60 chars, padded to 72)
  family_id    UUID        NOT NULL,           -- rotation family; reuse of revoked token revokes whole family
  expires_at   TIMESTAMPTZ NOT NULL,
  revoked_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_family    ON refresh_tokens (family_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id   ON refresh_tokens (user_id);
