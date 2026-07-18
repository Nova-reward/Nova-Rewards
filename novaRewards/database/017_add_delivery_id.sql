-- Migration 017: Add stable delivery_id to webhook_deliveries

-- Add a UUID column for stable per-delivery-attempt identification
ALTER TABLE webhook_deliveries
  ADD COLUMN IF NOT EXISTS delivery_id UUID NOT NULL DEFAULT gen_random_uuid();

-- Ensure uniqueness so the same delivery attempt always has the same ID
CREATE UNIQUE INDEX IF NOT EXISTS idx_wd_delivery_id ON webhook_deliveries (delivery_id);

-- Backfill any existing rows that might have been created before this migration
-- (unlikely in normal operation, but safe to have)
UPDATE webhook_deliveries
  SET delivery_id = gen_random_uuid()
  WHERE delivery_id IS NULL;