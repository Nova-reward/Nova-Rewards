-- Migration 009: Create email_logs table for tracking email delivery
-- Requirements: #184

CREATE TABLE IF NOT EXISTS email_logs (
  id              SERIAL PRIMARY KEY,
  recipient_email VARCHAR(255) NOT NULL,
  email_type      VARCHAR(50)  NOT NULL CHECK (email_type IN ('redemption_confirmation', 'milestone_achieved', 'welcome', 'password_reset')),
  subject         VARCHAR(500) NOT NULL,
  status          VARCHAR(20)  NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'delivered', 'failed')),
  error_message   TEXT,
  sent_at         TIMESTAMPTZ,
  delivered_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_email_logs_recipient ON email_logs (recipient_email);
CREATE INDEX IF NOT EXISTS idx_email_logs_type ON email_logs (email_type);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON email_logs (status);
CREATE INDEX IF NOT EXISTS idx_email_logs_created_at ON email_logs (created_at);
