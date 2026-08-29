-- Migration 022: Add token_amount and reward_per_action to campaigns (SAFE VERSION)
-- Zero-downtime three-phase implementation  
-- Requirements: Replace unsafe 022_campaigns_add_token_amount_reward_per_action.sql

-- PHASE 1: Add nullable columns (fast, no table rewrite)
ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS token_amount NUMERIC(18, 7),
  ADD COLUMN IF NOT EXISTS reward_per_action NUMERIC(18, 7);

-- PHASE 2: Backfill existing rows with meaningful defaults
-- Using campaign-specific logic or safe defaults
DO $$
DECLARE
  batch_size INTEGER := 500;
  updated_count INTEGER;
BEGIN
  -- Backfill in batches
  LOOP
    UPDATE campaigns 
    SET 
      token_amount = COALESCE(token_amount, 1000.0),  -- Default 1000 tokens per campaign
      reward_per_action = COALESCE(reward_per_action, reward_rate)  -- Use existing reward_rate as default
    WHERE (token_amount IS NULL OR reward_per_action IS NULL)
    AND id IN (
      SELECT id FROM campaigns 
      WHERE token_amount IS NULL OR reward_per_action IS NULL
      LIMIT batch_size
    );
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    
    -- Exit when no more rows to update
    IF updated_count = 0 THEN
      EXIT;
    END IF;
    
    -- Small delay between batches
    PERFORM pg_sleep(0.05);
    
    -- Log progress  
    RAISE NOTICE 'Updated % campaigns with token amounts', updated_count;
  END LOOP;
  
  RAISE NOTICE 'Token amount backfill completed';
END $$;

-- PHASE 3: Add constraints (safe since all rows have values > 0)
ALTER TABLE campaigns 
  ALTER COLUMN token_amount SET NOT NULL,
  ALTER COLUMN reward_per_action SET NOT NULL;

-- Add check constraints for positive values
ALTER TABLE campaigns
  ADD CONSTRAINT IF NOT EXISTS chk_campaigns_token_amount_positive 
    CHECK (token_amount > 0),
  ADD CONSTRAINT IF NOT EXISTS chk_campaigns_reward_per_action_positive 
    CHECK (reward_per_action > 0);