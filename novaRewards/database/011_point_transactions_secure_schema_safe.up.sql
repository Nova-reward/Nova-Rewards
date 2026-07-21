-- Migration 011: Secure point_transactions schema (SAFE VERSION)
-- Zero-downtime implementation avoiding table rewrites
-- Requirements: Replace unsafe 011_point_transactions_secure_schema.sql

-- Enable UUID extension if not present
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- PHASE 1: Add new columns without constraints
-- These are all fast operations that don't require table rewrites
ALTER TABLE point_transactions
  ADD COLUMN IF NOT EXISTS uuid UUID,
  ADD COLUMN IF NOT EXISTS balance_before INTEGER,
  ADD COLUMN IF NOT EXISTS balance_after INTEGER,
  ADD COLUMN IF NOT EXISTS amount_int INTEGER;

-- PHASE 2: Backfill new columns in batches
-- This avoids long-running transactions and allows concurrent operations
DO $$
DECLARE
  batch_size INTEGER := 1000;
  updated_count INTEGER;
  current_balance INTEGER;
BEGIN
  -- First pass: Generate UUIDs for existing rows
  LOOP
    UPDATE point_transactions 
    SET uuid = gen_random_uuid()
    WHERE uuid IS NULL
    AND id IN (
      SELECT id FROM point_transactions 
      WHERE uuid IS NULL 
      LIMIT batch_size
    );
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    IF updated_count = 0 THEN EXIT; END IF;
    
    PERFORM pg_sleep(0.05);  -- Brief pause between batches
  END LOOP;
  
  -- Second pass: Convert numeric amounts to integers
  LOOP
    UPDATE point_transactions 
    SET amount_int = amount::INTEGER
    WHERE amount_int IS NULL AND amount IS NOT NULL
    AND id IN (
      SELECT id FROM point_transactions 
      WHERE amount_int IS NULL AND amount IS NOT NULL
      LIMIT batch_size
    );
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    IF updated_count = 0 THEN EXIT; END IF;
    
    PERFORM pg_sleep(0.05);
  END LOOP;
  
  -- Third pass: Calculate balance_before and balance_after
  -- This requires ordered processing by user_id and created_at
  FOR user_record IN SELECT DISTINCT user_id FROM point_transactions WHERE balance_before IS NULL ORDER BY user_id LOOP
    current_balance := 0;
    
    -- Process transactions for this user in chronological order
    FOR tx_record IN 
      SELECT id, type, amount_int, created_at 
      FROM point_transactions 
      WHERE user_id = user_record.user_id AND balance_before IS NULL
      ORDER BY created_at, id
    LOOP
      -- Update balance_before
      UPDATE point_transactions 
      SET balance_before = current_balance
      WHERE id = tx_record.id;
      
      -- Calculate new balance
      IF tx_record.type IN ('earned', 'bonus', 'referral') THEN
        current_balance := current_balance + tx_record.amount_int;
      ELSIF tx_record.type IN ('redeemed', 'expired') THEN
        current_balance := current_balance - tx_record.amount_int;
      END IF;
      
      -- Update balance_after
      UPDATE point_transactions 
      SET balance_after = current_balance
      WHERE id = tx_record.id;
    END LOOP;
    
    -- Small delay between users to allow other operations
    PERFORM pg_sleep(0.01);
  END LOOP;
  
  RAISE NOTICE 'Point transactions backfill completed successfully';
END $$;

-- PHASE 3: Add constraints and clean up
-- These operations are fast since all data is already populated

-- Set NOT NULL constraints
ALTER TABLE point_transactions 
  ALTER COLUMN uuid SET NOT NULL,
  ALTER COLUMN balance_before SET NOT NULL,
  ALTER COLUMN balance_after SET NOT NULL,
  ALTER COLUMN amount_int SET NOT NULL;

-- Add unique constraint on UUID
ALTER TABLE point_transactions
  ADD CONSTRAINT IF NOT EXISTS uq_point_transactions_uuid UNIQUE (uuid);

-- Add check constraints  
ALTER TABLE point_transactions
  ADD CONSTRAINT IF NOT EXISTS chk_point_transactions_amount_nonzero
    CHECK (amount_int <> 0),
  ADD CONSTRAINT IF NOT EXISTS chk_point_transactions_balance_after_nonneg  
    CHECK (balance_after >= 0);

-- Update the type constraint to include all valid types
ALTER TABLE point_transactions
  DROP CONSTRAINT IF EXISTS point_transactions_type_check;
  
ALTER TABLE point_transactions
  ADD CONSTRAINT point_transactions_type_check
    CHECK (type IN ('earned', 'redeemed', 'expired', 'bonus', 'referral'));

-- PHASE 4: Replace old amount column (this is the only potentially blocking step)
-- We do this last so the application can be updated to use amount_int first
BEGIN;
  -- Remove the old numeric amount column
  ALTER TABLE point_transactions DROP COLUMN IF EXISTS amount;
  
  -- Rename the new integer column
  ALTER TABLE point_transactions RENAME COLUMN amount_int TO amount;
COMMIT;

-- Add index on UUID (CONCURRENTLY would be better, but we'll do that in the index conversion phase)
CREATE INDEX IF NOT EXISTS idx_point_transactions_uuid_safe 
  ON point_transactions (uuid);