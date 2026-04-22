-- Rollback 005: Remove updated_at trigger, function, and column from campaigns
DROP TRIGGER IF EXISTS campaigns_set_updated_at ON campaigns;
DROP FUNCTION IF EXISTS set_updated_at();
ALTER TABLE campaigns DROP COLUMN IF EXISTS updated_at;
