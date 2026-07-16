-- Migration 022: Add token_amount and reward_per_action to campaigns table
-- Closes #868

ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS token_amount      NUMERIC(18, 7) NOT NULL DEFAULT 0 CHECK (token_amount > 0),
  ADD COLUMN IF NOT EXISTS reward_per_action NUMERIC(18, 7) NOT NULL DEFAULT 0 CHECK (reward_per_action > 0);

-- Remove placeholder defaults after adding (columns already populated for existing rows)
ALTER TABLE campaigns
  ALTER COLUMN token_amount      DROP DEFAULT,
  ALTER COLUMN reward_per_action DROP DEFAULT;
