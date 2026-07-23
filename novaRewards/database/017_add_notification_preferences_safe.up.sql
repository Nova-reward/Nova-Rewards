-- Migration 017: Add notification_preferences to users table (SAFE VERSION)
-- Zero-downtime three-phase implementation
-- Requirements: Replace unsafe 017_add_notification_preferences.sql

-- PHASE 1: Add nullable column (fast, no table rewrite)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS notification_preferences JSONB;

-- PHASE 2: Backfill existing rows with default preferences
-- Using batched updates to minimize lock time
DO $$
DECLARE
  batch_size INTEGER := 1000;
  updated_count INTEGER;
  default_prefs JSONB := '{"rewards":true,"redemptions":true,"campaigns":false,"referrals":true,"system":false}';
BEGIN
  -- Backfill in batches
  LOOP
    UPDATE users 
    SET notification_preferences = default_prefs
    WHERE notification_preferences IS NULL
    AND id IN (
      SELECT id FROM users 
      WHERE notification_preferences IS NULL 
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
    RAISE NOTICE 'Updated % users with notification preferences', updated_count;
  END LOOP;
  
  RAISE NOTICE 'Notification preferences backfill completed';
END $$;

-- PHASE 3: Add NOT NULL constraint (safe since all rows now have values)
ALTER TABLE users 
  ALTER COLUMN notification_preferences SET NOT NULL;

-- Set default for new users
ALTER TABLE users 
  ALTER COLUMN notification_preferences SET DEFAULT '{"rewards":true,"redemptions":true,"campaigns":false,"referrals":true,"system":false}';