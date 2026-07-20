-- Migration 019: Add campaign_id to redemptions table
-- Requirements: #587 (Redemption Processing API)

ALTER TABLE redemptions
  ADD COLUMN IF NOT EXISTS campaign_id INTEGER REFERENCES campaigns(id);

CREATE INDEX IF NOT EXISTS idx_redemptions_campaign_id ON redemptions (campaign_id);
