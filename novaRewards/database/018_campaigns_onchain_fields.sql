-- Migration 018: Add on-chain tracking fields to campaigns table
-- Requirements: on-chain sync for campaign CRUD

ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS contract_campaign_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS tx_hash             VARCHAR(255),
  ADD COLUMN IF NOT EXISTS on_chain_status     VARCHAR(50) NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS deleted_at          TIMESTAMPTZ;

-- on_chain_status values: pending | confirmed | failed
CREATE INDEX IF NOT EXISTS idx_campaigns_on_chain_status ON campaigns (on_chain_status);
