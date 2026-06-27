-- Migration 008: Add email to users and create rewards table
-- Requirements: #186

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);

CREATE TABLE IF NOT EXISTS rewards (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(255)   NOT NULL,
  cost        NUMERIC(18, 2) NOT NULL CHECK (cost > 0),
  stock       INTEGER        NOT NULL DEFAULT 0 CHECK (stock >= 0),
  is_active   BOOLEAN        NOT NULL DEFAULT TRUE,
  is_deleted  BOOLEAN        NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);
