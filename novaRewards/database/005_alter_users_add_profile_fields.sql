-- Migration 005: Add profile fields to users table

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS role          VARCHAR(20)  NOT NULL DEFAULT 'user',
  ADD COLUMN IF NOT EXISTS is_frozen     BOOLEAN      NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS referral_code VARCHAR(16)  UNIQUE;
