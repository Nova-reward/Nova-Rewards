-- Migration 019: Add indexes to support campaign analytics queries (Issue #588)
--
-- The analytics endpoint aggregates point_transactions filtered by campaign_id
-- and optionally by created_at date range.  Without a composite index the
-- planner falls back to a sequential scan which violates the <500 ms SLA.

-- Primary index: covers WHERE campaign_id = $1 AND created_at BETWEEN ...
-- and the GROUP BY DATE_TRUNC(..., created_at) in the time-series query.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pt_campaign_created
  ON point_transactions (campaign_id, created_at);

-- Partial index for the most common filter: earned transactions per campaign.
-- Speeds up total_issued / avg_reward_value aggregations.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pt_campaign_earned
  ON point_transactions (campaign_id, created_at)
  WHERE type = 'earned';

-- Partial index for redemption-rate calculations.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pt_campaign_redeemed
  ON point_transactions (campaign_id, created_at)
  WHERE type = 'redeemed';
