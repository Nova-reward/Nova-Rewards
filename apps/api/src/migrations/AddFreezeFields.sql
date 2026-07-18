-- Add isFrozen field to users table
ALTER TABLE users ADD COLUMN is_frozen BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN frozen_reason TEXT;
ALTER TABLE users ADD COLUMN frozen_by UUID;
ALTER TABLE users ADD COLUMN frozen_at TIMESTAMP;
ALTER TABLE users ADD COLUMN unfrozen_at TIMESTAMP;

-- Create audit_logs table
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action VARCHAR(255) NOT NULL,
  user_id UUID NOT NULL,
  admin_id UUID NOT NULL,
  reason TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for performance
CREATE INDEX idx_users_is_frozen ON users(is_frozen);
CREATE INDEX idx_audit_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_admin_id ON audit_logs(admin_id);
