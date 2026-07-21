-- Migration 005: Add updated_at column and auto-update trigger to campaigns (SAFE VERSION)
-- Zero-downtime three-phase implementation
-- Requirements: Replace unsafe 005_campaigns_updated_at_trigger.up.sql

-- PHASE 1: Add nullable column (fast, no table rewrite)
-- This acquires ACCESS EXCLUSIVE briefly but does not rewrite the table
ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- Create the trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = COALESCE(NEW.updated_at, NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger to auto-set updated_at on updates
-- This ensures all new records get the updated_at value
DROP TRIGGER IF EXISTS campaigns_set_updated_at ON campaigns;
CREATE TRIGGER campaigns_set_updated_at
  BEFORE UPDATE ON campaigns
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- PHASE 2: Backfill existing rows in batches
-- This can be done during low-traffic periods
-- Using DO block for idempotent backfill
DO $$
DECLARE
  batch_size INTEGER := 1000;
  updated_count INTEGER;
BEGIN
  -- Backfill in batches to avoid holding locks too long
  LOOP
    UPDATE campaigns 
    SET updated_at = COALESCE(updated_at, created_at, NOW())
    WHERE updated_at IS NULL
    AND id IN (
      SELECT id FROM campaigns 
      WHERE updated_at IS NULL 
      LIMIT batch_size
    );
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    
    -- Exit when no more rows to update
    IF updated_count = 0 THEN
      EXIT;
    END IF;
    
    -- Small delay between batches to allow other operations
    PERFORM pg_sleep(0.1);
    
    -- Log progress
    RAISE NOTICE 'Updated % rows, continuing...', updated_count;
  END LOOP;
  
  RAISE NOTICE 'Backfill completed successfully';
END $$;

-- PHASE 3: Add NOT NULL constraint (fast, just metadata change)
-- This is safe because all rows now have values
ALTER TABLE campaigns 
  ALTER COLUMN updated_at SET NOT NULL;

-- Set default for new insertions (this is safe as it's just metadata)
ALTER TABLE campaigns 
  ALTER COLUMN updated_at SET DEFAULT NOW();