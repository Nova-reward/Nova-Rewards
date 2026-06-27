-- Migration 006: Add user profile columns
-- Adds profile fields and soft-delete support for users table

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS first_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS last_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS bio TEXT,
  ADD COLUMN IF NOT EXISTS stellar_public_key VARCHAR(56),
  ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'user';

-- Create index for soft-delete queries
CREATE INDEX IF NOT EXISTS idx_users_is_deleted ON users(is_deleted);

-- Create index for role-based queries
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
