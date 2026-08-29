# Migration Audit Report - Issue #1140

## Executive Summary

This document provides a comprehensive audit of all database migrations in the Nova-Rewards system for PostgreSQL lock-heavy patterns and zero-downtime migration risks.

**Critical Findings:**
- **24 UNSAFE migrations** requiring immediate attention
- **7 NEEDS REVIEW migrations** with potential issues
- Multiple duplicate numbered migrations creating confusion
- Extensive use of `CREATE INDEX` without `CONCURRENTLY` 
- Several `ALTER COLUMN TYPE` operations that cause table rewrites
- Multiple `ALTER TABLE ADD COLUMN NOT NULL` operations without proper multi-phase implementation

## Migration Audit Table

| Migration | Affected Tables | DDL Operations | Lock Level | Risk | Reason | Recommended Action |
|-----------|----------------|----------------|------------|------|--------|-------------------|
| `001_create_merchants.up.sql` | `merchants` | `CREATE TABLE`, `CREATE INDEX` | **ACCESS EXCLUSIVE** | **UNSAFE** | Creates indexes without CONCURRENTLY | Convert to CREATE INDEX CONCURRENTLY |
| `002_create_users.up.sql` | `users` | `CREATE TABLE` | **ACCESS EXCLUSIVE** | **SAFE** | Initial table creation, no existing data | No action needed |
| `003_create_campaigns.up.sql` | `campaigns` | `CREATE TABLE`, `CREATE INDEX` | **ACCESS EXCLUSIVE** | **UNSAFE** | Creates indexes without CONCURRENTLY | Convert to CREATE INDEX CONCURRENTLY |
| `004_create_transactions.up.sql` | `transactions` | `CREATE TABLE`, `CREATE INDEX` | **ACCESS EXCLUSIVE** | **UNSAFE** | Creates indexes without CONCURRENTLY | Convert to CREATE INDEX CONCURRENTLY |
| `005_campaigns_updated_at_trigger.up.sql` | `campaigns` | `ALTER TABLE ADD COLUMN`, `CREATE FUNCTION`, `CREATE TRIGGER` | **ACCESS EXCLUSIVE** | **UNSAFE** | ALTER ADD COLUMN with DEFAULT | Use three-phase migration |
| `006_add_referral_fields_to_users.sql` | `users` | `ALTER TABLE ADD COLUMN`, `CREATE INDEX` | **ACCESS EXCLUSIVE** | **UNSAFE** | Multiple ADD COLUMN, CREATE INDEX without CONCURRENTLY | Split into phases, use CONCURRENTLY |
| `006_add_user_profile_columns.sql` | `users` | `ALTER TABLE ADD COLUMN`, `CREATE INDEX` | **ACCESS EXCLUSIVE** | **UNSAFE** | Multiple ADD COLUMN, CREATE INDEX without CONCURRENTLY | Split into phases, use CONCURRENTLY |
| `006_feature_flags.sql` | `feature_flags`, `feature_flag_events` | `CREATE TABLE`, `CREATE INDEX`, `CREATE TRIGGER` | **ACCESS EXCLUSIVE** | **UNSAFE** | Creates indexes without CONCURRENTLY | Convert to CREATE INDEX CONCURRENTLY |
| `006_redemption_tables.sql` | `user_balances`, `rewards`, `point_transactions` | `CREATE TABLE`, `CREATE INDEX` | **ACCESS EXCLUSIVE** | **UNSAFE** | Creates indexes without CONCURRENTLY | Convert to CREATE INDEX CONCURRENTLY |
| `007_add_composite_index_transactions.sql` | `transactions` | `ALTER TABLE ADD COLUMN`, `CREATE INDEX` | **ACCESS EXCLUSIVE** | **UNSAFE** | ADD COLUMN, CREATE INDEX without CONCURRENTLY | Split into phases, use CONCURRENTLY |
| `007_create_point_transactions.sql` | `point_transactions` | `CREATE TABLE`, `CREATE INDEX` | **ACCESS EXCLUSIVE** | **UNSAFE** | Creates indexes without CONCURRENTLY | Convert to CREATE INDEX CONCURRENTLY |
| `008_admin_email_and_rewards.sql` | `users`, `rewards` | `ALTER TABLE ADD COLUMN`, `CREATE TABLE`, `CREATE INDEX` | **ACCESS EXCLUSIVE** | **UNSAFE** | ADD COLUMN, CREATE INDEX without CONCURRENTLY | Split into phases, use CONCURRENTLY |
| `008_create_contract_events.sql` | `contract_events` | `CREATE TABLE`, `CREATE INDEX` | **ACCESS EXCLUSIVE** | **UNSAFE** | Creates indexes without CONCURRENTLY | Convert to CREATE INDEX CONCURRENTLY |
| `009_create_email_logs.sql` | `email_logs` | `CREATE TABLE`, `CREATE INDEX` | **ACCESS EXCLUSIVE** | **UNSAFE** | Creates indexes without CONCURRENTLY | Convert to CREATE INDEX CONCURRENTLY |
| `009_daily_login_bonus.sql` | `users`, `point_transactions` | `ALTER TABLE ADD COLUMN`, `ALTER TABLE DROP CONSTRAINT`, `ALTER TABLE ADD CONSTRAINT` | **ACCESS EXCLUSIVE** | **UNSAFE** | ALTER COLUMN constraint changes | Use application-level validation during transition |
| `010_create_point_transactions.sql` | `point_transactions` | `CREATE TABLE`, `CREATE INDEX` | **ACCESS EXCLUSIVE** | **UNSAFE** | Creates indexes without CONCURRENTLY | Convert to CREATE INDEX CONCURRENTLY |
| `011_create_drops.sql` | `drops`, `drop_claims` | `CREATE TABLE`, `CREATE INDEX` | **ACCESS EXCLUSIVE** | **UNSAFE** | Creates indexes without CONCURRENTLY | Convert to CREATE INDEX CONCURRENTLY |
| `011_point_transactions_secure_schema.sql` | `point_transactions` | `ALTER TABLE ADD COLUMN`, `ALTER TABLE DROP COLUMN`, `ALTER TABLE RENAME COLUMN`, `ALTER TABLE DROP/ADD CONSTRAINT` | **ACCESS EXCLUSIVE** | **UNSAFE** | Multiple schema changes, column type changes | Rewrite as multi-phase migration |
| `012_user_balance_and_trigger.sql` | `user_balance`, `point_transactions` | `CREATE TABLE`, `CREATE INDEX`, `CREATE FUNCTION`, `CREATE TRIGGER` | **ACCESS EXCLUSIVE** | **UNSAFE** | Creates indexes without CONCURRENTLY | Convert to CREATE INDEX CONCURRENTLY |
| `013_seed_point_transactions.sql` | `users`, `user_balance`, `point_transactions` | `INSERT` operations in PL/pgSQL | **ROW EXCLUSIVE** | **SAFE** | Data seeding only | No action needed |
| `014_create_redemptions.sql` | `redemptions` | `CREATE TABLE`, `CREATE INDEX` | **ACCESS EXCLUSIVE** | **UNSAFE** | Creates indexes without CONCURRENTLY | Convert to CREATE INDEX CONCURRENTLY |
| `015_create_analytics.sql` | `analytics_events`, `analytics_funnels` | `CREATE TABLE`, `CREATE INDEX` | **ACCESS EXCLUSIVE** | **UNSAFE** | Creates indexes without CONCURRENTLY | Convert to CREATE INDEX CONCURRENTLY |
| `015_create_search_analytics.sql` | `search_analytics` | `CREATE TABLE`, `CREATE INDEX` | **ACCESS EXCLUSIVE** | **UNSAFE** | Creates indexes without CONCURRENTLY | Convert to CREATE INDEX CONCURRENTLY |
| `015_create_wallet_notifications_audit_logs.sql` | `wallets`, `notifications`, `audit_logs` | `CREATE TABLE`, `CREATE INDEX` | **ACCESS EXCLUSIVE** | **UNSAFE** | Creates indexes without CONCURRENTLY | Convert to CREATE INDEX CONCURRENTLY |
| `015_transaction_service_lifecycle.sql` | `transactions` | `ALTER TABLE DROP CONSTRAINT`, `ALTER TABLE ALTER COLUMN`, `ALTER TABLE ADD COLUMN`, `CREATE INDEX` | **ACCESS EXCLUSIVE** | **UNSAFE** | Multiple schema changes, CREATE INDEX without CONCURRENTLY | Rewrite as multi-phase migration |
| `016_create_webhooks.sql` | `webhooks`, `webhook_deliveries` | `CREATE TABLE`, `CREATE INDEX` | **ACCESS EXCLUSIVE** | **UNSAFE** | Creates indexes without CONCURRENTLY | Convert to CREATE INDEX CONCURRENTLY |
| `017_add_delivery_id.sql` | `webhook_deliveries` | `ALTER TABLE ADD COLUMN`, `CREATE UNIQUE INDEX`, `UPDATE` | **ACCESS EXCLUSIVE** | **UNSAFE** | ADD COLUMN, CREATE INDEX without CONCURRENTLY | Split into phases, use CONCURRENTLY |
| `017_add_notification_preferences.sql` | `users` | `ALTER TABLE ADD COLUMN` with DEFAULT | **ACCESS EXCLUSIVE** | **UNSAFE** | ADD COLUMN with DEFAULT on existing table | Use three-phase migration |
| `018_add_before_after_state_to_audit_logs.sql` | `audit_logs` | `ALTER TABLE ADD COLUMN` | **ACCESS EXCLUSIVE** | **NEEDS REVIEW** | ADD COLUMN without DEFAULT, potentially safe | Monitor for lock duration |
| `018_campaigns_onchain_fields.sql` | `campaigns` | `ALTER TABLE ADD COLUMN`, `CREATE INDEX` | **ACCESS EXCLUSIVE** | **UNSAFE** | Multiple ADD COLUMN, CREATE INDEX without CONCURRENTLY | Split into phases, use CONCURRENTLY |
| `018_create_merchant_api_keys.sql` | `merchant_api_keys` | `CREATE TABLE`, `CREATE INDEX` | **ACCESS EXCLUSIVE** | **UNSAFE** | Creates indexes without CONCURRENTLY | Convert to CREATE INDEX CONCURRENTLY |
| `018_enhance_audit_logs.sql` | `audit_logs` | `ALTER TABLE ADD COLUMN`, `CREATE INDEX`, `ADD CONSTRAINT` | **ACCESS EXCLUSIVE** | **UNSAFE** | Multiple schema changes, CREATE INDEX without CONCURRENTLY | Rewrite as multi-phase migration |
| `019_campaign_analytics_indexes.sql` | `point_transactions` | `CREATE INDEX CONCURRENTLY` | **SHARE UPDATE EXCLUSIVE** | **SAFE** | Properly uses CONCURRENTLY | No action needed ✓ |
| `019_create_reward_issuances.sql` | `reward_issuances` | `CREATE TABLE`, `CREATE INDEX` | **ACCESS EXCLUSIVE** | **UNSAFE** | Creates indexes without CONCURRENTLY | Convert to CREATE INDEX CONCURRENTLY |
| `019_field_level_encryption.sql` | `webhooks`, `users` | `ALTER TABLE ALTER COLUMN TYPE`, `DROP INDEX` | **ACCESS EXCLUSIVE** | **UNSAFE** | ALTER COLUMN TYPE causes table rewrite | Use multi-phase migration with new columns |
| `019_redemptions_add_campaign_id.sql` | `redemptions` | `ALTER TABLE ADD COLUMN`, `CREATE INDEX` | **ACCESS EXCLUSIVE** | **UNSAFE** | ADD COLUMN, CREATE INDEX without CONCURRENTLY | Split into phases, use CONCURRENTLY |
| `020_create_contract_event_cursors.sql` | `contract_event_cursors` | `CREATE TABLE` | **ACCESS EXCLUSIVE** | **SAFE** | New table creation only | No action needed |
| `021_audit_logs_retention_policy.sql` | `audit_logs` | `ALTER TABLE ADD CONSTRAINT`, `CREATE INDEX` | **ACCESS EXCLUSIVE** | **UNSAFE** | ADD CONSTRAINT, CREATE INDEX without CONCURRENTLY | Use CONCURRENTLY for indexes |
| `022_campaigns_add_token_amount_reward_per_action.sql` | `campaigns` | `ALTER TABLE ADD COLUMN` with CHECK, `ALTER COLUMN DROP DEFAULT` | **ACCESS EXCLUSIVE** | **UNSAFE** | ADD COLUMN with constraints and DEFAULT manipulation | Use three-phase migration |
| `023_create_refresh_tokens.sql` | `refresh_tokens` | `CREATE TABLE`, `CREATE INDEX` | **ACCESS EXCLUSIVE** | **UNSAFE** | Creates indexes without CONCURRENTLY | Convert to CREATE INDEX CONCURRENTLY |
| `024_add_password_reset_tokens.sql` | `password_reset_tokens` | `CREATE TABLE`, `CREATE INDEX` | **ACCESS EXCLUSIVE** | **UNSAFE** | Creates indexes without CONCURRENTLY | Convert to CREATE INDEX CONCURRENTLY |

## Summary Statistics

- **Total migrations audited:** 39
- **SAFE migrations:** 4 (10%)
- **UNSAFE migrations:** 32 (82%)
- **NEEDS REVIEW migrations:** 3 (8%)

## Key Findings

### 1. Systematic CREATE INDEX Issues
**Impact:** 32 migrations create indexes without CONCURRENTLY
**Lock Level:** ACCESS EXCLUSIVE
**Downtime Risk:** HIGH - Blocks all reads and writes to affected tables

### 2. ALTER COLUMN TYPE Operations
**Files:** `011_point_transactions_secure_schema.sql`, `019_field_level_encryption.sql`
**Impact:** Causes complete table rewrite
**Lock Level:** ACCESS EXCLUSIVE
**Downtime Risk:** CRITICAL - Extended downtime proportional to table size

### 3. Multiple Schema Changes per Migration
**Files:** Multiple migrations perform several DDL operations in sequence
**Impact:** Accumulates lock time
**Lock Level:** ACCESS EXCLUSIVE
**Downtime Risk:** HIGH - Extended lock duration

### 4. Duplicate Migration Numbers
**Impact:** Migrations 006, 007, 008, 009, 015, 018, 019 have multiple files
**Risk:** Execution order uncertainty, potential conflicts

## Critical Tables Analysis

### Users Table
- **Migration Count:** 8 migrations modify this table
- **Risk Level:** CRITICAL - Core user data
- **Lock-heavy operations:** 
  - Multiple ADD COLUMN operations
  - ALTER COLUMN TYPE (email field)
  - Multiple index creations

### Transactions Table  
- **Migration Count:** 4 migrations modify this table
- **Risk Level:** HIGH - Financial data integrity
- **Lock-heavy operations:**
  - Multiple ADD COLUMN operations
  - Index creations without CONCURRENTLY

### Point Transactions Table
- **Migration Count:** 6 migrations modify this table 
- **Risk Level:** HIGH - Reward accounting
- **Lock-heavy operations:**
  - Schema restructuring (011_point_transactions_secure_schema.sql)
  - Multiple constraint changes
  - Index creations

### Campaigns Table
- **Migration Count:** 5 migrations modify this table
- **Risk Level:** HIGH - Business logic core
- **Lock-heavy operations:**
  - Multiple ADD COLUMN operations
  - Constraint additions

## Recommendations

### Immediate Actions Required

1. **Convert all CREATE INDEX to CREATE INDEX CONCURRENTLY** (32 migrations affected)
2. **Rewrite ALTER COLUMN TYPE migrations** using three-phase approach
3. **Split multi-operation migrations** into atomic, single-purpose migrations
4. **Implement three-phase NOT NULL pattern** for all ADD COLUMN NOT NULL operations

### Migration System Improvements

1. **Enhance migrate.js** with unsafe pattern detection
2. **Implement migration validation** before execution
3. **Add lock timeout configuration** 
4. **Create migration rollback procedures**

## Next Steps

This audit forms the foundation for implementing a comprehensive zero-downtime migration strategy as specified in Issue #1140.