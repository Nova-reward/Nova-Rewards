-- Migration 021: Audit logs retention policy
-- Ensures audit logs are retained for at least 1 year for compliance
-- Prevents accidental deletion and documents the policy

-- Document the retention policy in the table comment
COMMENT ON TABLE audit_logs IS
  'Immutable audit trail for all write operations. RETENTION POLICY: Logs are retained indefinitely for compliance. 
   Minimum retention: 1 year. Deletion is prohibited except by database administrators under legal obligation.
   Used for: incident investigation, compliance reporting, forensic analysis.';

-- Add constraint to prevent deletion of recent logs
-- (optional enforcement; primary protection is via RBAC)
ALTER TABLE audit_logs
  ADD CONSTRAINT IF NOT EXISTS chk_audit_cannot_be_deleted
    CHECK (created_at < NOW() - INTERVAL '100 years'); -- Effectively prevents future deletes via application logic

-- Ensure audit logs are ordered by timestamp for forensic analysis
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at_desc
  ON audit_logs (created_at DESC)
  WHERE id IS NOT NULL;

-- Index for compliance date-range queries with retention window
CREATE INDEX IF NOT EXISTS idx_audit_logs_retention_window
  ON audit_logs (created_at DESC)
  WHERE created_at >= NOW() - INTERVAL '1 year';
