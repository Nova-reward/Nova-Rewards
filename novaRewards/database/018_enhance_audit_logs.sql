-- Migration 018: Enhance audit_logs for full audit trail
-- Adds API call tracking, actor type, IP, user agent, HTTP metadata,
-- and compliance-grade indexes.

-- Add new columns (idempotent via IF NOT EXISTS)
ALTER TABLE audit_logs
  ADD COLUMN IF NOT EXISTS actor_type    VARCHAR(20)  DEFAULT 'user',
  ADD COLUMN IF NOT EXISTS ip_address    INET,
  ADD COLUMN IF NOT EXISTS user_agent    TEXT,
  ADD COLUMN IF NOT EXISTS http_method   VARCHAR(10),
  ADD COLUMN IF NOT EXISTS endpoint      VARCHAR(500),
  ADD COLUMN IF NOT EXISTS status_code   SMALLINT,
  ADD COLUMN IF NOT EXISTS duration_ms   INTEGER,
  ADD COLUMN IF NOT EXISTS merchant_id   INTEGER REFERENCES merchants(id) ON DELETE SET NULL;

-- actor_type: 'user' | 'admin' | 'merchant' | 'system'
ALTER TABLE audit_logs
  ADD CONSTRAINT IF NOT EXISTS chk_audit_actor_type
    CHECK (actor_type IN ('user', 'admin', 'merchant', 'system'));

-- Composite index for compliance date-range queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_actor
  ON audit_logs (created_at DESC, actor_type);

-- Index for filtering by action type
CREATE INDEX IF NOT EXISTS idx_audit_logs_action
  ON audit_logs (action);

-- Index for merchant-scoped queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_merchant_id
  ON audit_logs (merchant_id)
  WHERE merchant_id IS NOT NULL;

-- Index for HTTP status filtering (e.g. find all 4xx/5xx)
CREATE INDEX IF NOT EXISTS idx_audit_logs_status_code
  ON audit_logs (status_code)
  WHERE status_code IS NOT NULL;

COMMENT ON TABLE audit_logs IS
  'Immutable audit trail for all user, admin, merchant, and system actions.';
COMMENT ON COLUMN audit_logs.actor_type IS
  'Who performed the action: user | admin | merchant | system';
COMMENT ON COLUMN audit_logs.ip_address IS
  'Client IP address at time of request';
COMMENT ON COLUMN audit_logs.endpoint IS
  'HTTP method + path, e.g. POST /api/auth/login';
COMMENT ON COLUMN audit_logs.status_code IS
  'HTTP response status code';
COMMENT ON COLUMN audit_logs.duration_ms IS
  'Request processing time in milliseconds';
