-- Rollback 003: Drop campaigns table and its index
DROP INDEX IF EXISTS idx_campaigns_merchant_id;
DROP TABLE IF EXISTS campaigns CASCADE;
