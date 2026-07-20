-- Migration 015: Create wallets, notifications, and audit_logs tables
-- Requirements: #357

CREATE TABLE IF NOT EXISTS wallets (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  address    VARCHAR(56) NOT NULL UNIQUE,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON wallets (user_id);
CREATE INDEX IF NOT EXISTS idx_wallets_address ON wallets (address);
CREATE INDEX IF NOT EXISTS idx_wallets_is_active ON wallets (is_active);

CREATE TABLE IF NOT EXISTS notifications (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       VARCHAR(50) NOT NULL,
  title      VARCHAR(255) NOT NULL,
  message    TEXT NOT NULL,
  payload    JSONB,
  is_read    BOOLEAN NOT NULL DEFAULT FALSE,
  sent_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications (user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications (is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications (created_at);

CREATE TABLE IF NOT EXISTS audit_logs (
  id            SERIAL PRIMARY KEY,
  entity_type   VARCHAR(50) NOT NULL,
  entity_id     INTEGER,
  action        VARCHAR(100) NOT NULL,
  performed_by  INTEGER REFERENCES users(id),
  details       JSONB,
  source        VARCHAR(255),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity on audit_logs (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_performed_by ON audit_logs (performed_by);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs (created_at);
