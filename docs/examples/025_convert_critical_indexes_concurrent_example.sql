-- Migration 025: Convert critical indexes to CONCURRENTLY (EXAMPLE)
-- Zero-downtime index recreation for core tables
-- Requirements: Address Issue #1140 - Safe index creation patterns

-- NOTE: This migration demonstrates the pattern for converting existing indexes
-- to CONCURRENTLY. In production, this should be run during low-traffic periods
-- and monitored closely.

-- IMPORTANT: CREATE INDEX CONCURRENTLY cannot be run inside transaction blocks
-- Each statement executes as a separate transaction

-- ============================================================================
-- USERS TABLE - Critical for authentication and user management
-- ============================================================================

-- Convert users.email index to concurrent
DROP INDEX IF EXISTS idx_users_email;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email_concurrent 
  ON users (email) WHERE email IS NOT NULL;

-- Convert users.referred_by index to concurrent  
DROP INDEX IF EXISTS idx_users_referred_by;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_referred_by_concurrent
  ON users (referred_by) WHERE referred_by IS NOT NULL;

-- Convert users role and delete status indexes
DROP INDEX IF EXISTS idx_users_is_deleted;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_is_deleted_concurrent
  ON users (is_deleted) WHERE is_deleted = true;

DROP INDEX IF EXISTS idx_users_role;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_role_concurrent
  ON users (role);

-- ============================================================================
-- TRANSACTIONS TABLE - Critical for payment processing  
-- ============================================================================

-- Convert wallet address indexes to concurrent
DROP INDEX IF EXISTS idx_transactions_from_wallet;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_from_wallet_concurrent
  ON transactions (from_wallet);

DROP INDEX IF EXISTS idx_transactions_to_wallet;  
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_to_wallet_concurrent
  ON transactions (to_wallet);

-- Convert transaction type and status indexes
DROP INDEX IF EXISTS idx_transactions_type;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_type_concurrent
  ON transactions (tx_type);

DROP INDEX IF EXISTS idx_transactions_status;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_status_concurrent  
  ON transactions (status) WHERE status IS NOT NULL;

-- Convert composite indexes for user transaction history
DROP INDEX IF EXISTS idx_transactions_user_created;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_user_created_concurrent
  ON transactions (user_id, created_at DESC) WHERE user_id IS NOT NULL;

-- ============================================================================  
-- CAMPAIGNS TABLE - Critical for business logic
-- ============================================================================

-- Convert merchant relationship index
DROP INDEX IF EXISTS idx_campaigns_merchant_id;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_campaigns_merchant_id_concurrent
  ON campaigns (merchant_id);

-- Convert on-chain status index
DROP INDEX IF EXISTS idx_campaigns_on_chain_status;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_campaigns_on_chain_status_concurrent
  ON campaigns (on_chain_status);

-- ============================================================================
-- POINT_TRANSACTIONS TABLE - Critical for reward accounting
-- ============================================================================

-- Convert user points lookup index
DROP INDEX IF EXISTS idx_point_transactions_user_id;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_point_transactions_user_id_concurrent
  ON point_transactions (user_id);

-- Convert transaction type index  
DROP INDEX IF EXISTS idx_point_transactions_type;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_point_transactions_type_concurrent
  ON point_transactions (type);

-- Convert chronological index
DROP INDEX IF EXISTS idx_point_transactions_created_at;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_point_transactions_created_at_concurrent
  ON point_transactions (created_at);

-- Convert composite user/date index for efficient queries
DROP INDEX IF EXISTS idx_pt_user_created;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pt_user_created_concurrent
  ON point_transactions (user_id, created_at);

-- ============================================================================
-- AUDIT_LOGS TABLE - Critical for compliance and security
-- ============================================================================

-- Convert entity lookup index
DROP INDEX IF EXISTS idx_audit_logs_entity;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_entity_concurrent
  ON audit_logs (entity_type, entity_id);

-- Convert actor lookup index
DROP INDEX IF EXISTS idx_audit_logs_performed_by;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_performed_by_concurrent
  ON audit_logs (performed_by) WHERE performed_by IS NOT NULL;

-- Convert chronological index for compliance queries
DROP INDEX IF EXISTS idx_audit_logs_created_at;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_created_at_concurrent
  ON audit_logs (created_at);

-- ============================================================================
-- CLEANUP AND VERIFICATION
-- ============================================================================

-- After successful creation, we could optionally rename indexes to clean names
-- This would be done in a separate migration after verifying the concurrent 
-- versions are working correctly:

-- Example cleanup (commented out - should be separate migration):
-- DROP INDEX IF EXISTS idx_users_email_concurrent;
-- ALTER INDEX IF EXISTS idx_users_email_concurrent RENAME TO idx_users_email;

-- Verification queries to ensure indexes exist and are valid:
DO $$
DECLARE
  invalid_count INTEGER;
  missing_count INTEGER;
BEGIN
  -- Check for any invalid indexes created by this migration
  SELECT COUNT(*) INTO invalid_count
  FROM pg_index i
  JOIN pg_class c ON i.indexrelid = c.oid  
  WHERE c.relname LIKE '%_concurrent'
  AND NOT i.indisvalid;
  
  IF invalid_count > 0 THEN
    RAISE WARNING 'Found % invalid concurrent indexes - manual cleanup required', invalid_count;
  ELSE
    RAISE NOTICE 'All concurrent indexes created successfully';
  END IF;
  
  -- Log completion
  RAISE NOTICE 'Index conversion migration completed. Monitor application performance and query plans.';
END $$;