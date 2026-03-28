-- Migration 006: Add referral fields to users table
-- Requirements: #181

ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by INTEGER REFERENCES users(id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_bonus_claimed BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_at TIMESTAMPTZ;

-- Index for finding referred users
CREATE INDEX IF NOT EXISTS idx_users_referred_by ON users (referred_by);
