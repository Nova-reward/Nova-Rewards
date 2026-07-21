# CREATE INDEX CONCURRENTLY Conversion Guide

## Overview

This document provides guidance for converting unsafe `CREATE INDEX` statements to `CREATE INDEX CONCURRENTLY` to achieve zero-downtime migrations.

## Problem Analysis

From the audit, **80+ CREATE INDEX statements** across **32 migration files** use the unsafe pattern:

```sql
-- UNSAFE: Acquires ACCESS EXCLUSIVE lock
CREATE INDEX IF NOT EXISTS idx_name ON table (column);
```

## Safe Pattern

```sql
-- SAFE: Uses SHARE UPDATE EXCLUSIVE lock (allows reads and writes)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_name ON table (column);
```

## PostgreSQL Lock Comparison

| Pattern | Lock Mode | Blocks Reads | Blocks Writes | Duration | Production Safe |
|---------|-----------|--------------|---------------|----------|-----------------|
| `CREATE INDEX` | ACCESS EXCLUSIVE | ✓ YES | ✓ YES | Table scan time | ❌ NO |
| `CREATE INDEX CONCURRENTLY` | SHARE UPDATE EXCLUSIVE | ❌ NO | ❌ NO | 2-3x table scan | ✅ YES |

## CONCURRENTLY Limitations

1. **Cannot be used inside transaction blocks**
   ```sql
   -- This will fail:
   BEGIN;
   CREATE INDEX CONCURRENTLY idx_name ON table (column);
   COMMIT;
   ```

2. **Requires more disk space** (temporary index structure)

3. **Takes longer to complete** (2-3x normal index creation time)

4. **Can fail and leave invalid indexes** (requires cleanup)

## Migration Files Requiring Conversion

Based on the audit, the following files need index conversion:

### High Priority (Core Tables)

1. **Users Table Indexes**
   - `006_add_referral_fields_to_users.sql`
   - `006_add_user_profile_columns.sql` 
   - `008_admin_email_and_rewards.sql`

2. **Transactions Table Indexes**
   - `004_create_transactions.sql`
   - `007_add_composite_index_transactions.sql`
   - `015_transaction_service_lifecycle.sql`

3. **Point Transactions Table Indexes**
   - `007_create_point_transactions.sql`
   - `010_create_point_transactions.sql`

4. **Campaigns Table Indexes**
   - `003_create_campaigns.sql`
   - `018_campaigns_onchain_fields.sql`

### Medium Priority (Supporting Tables)

5. **Audit and Logging**
   - `008_create_contract_events.sql`
   - `015_create_wallet_notifications_audit_logs.sql`
   - `018_enhance_audit_logs.sql`
   - `021_audit_logs_retention_policy.sql`

6. **Feature Tables**
   - `006_feature_flags.sql`
   - `009_create_email_logs.sql`
   - `014_create_redemptions.sql`
   - `016_create_webhooks.sql`

### Lower Priority (New Tables)

7. **Analytics and Reporting**
   - `015_create_analytics.sql`
   - `015_create_search_analytics.sql`
   - `019_create_reward_issuances.sql`

8. **Authentication and Security**
   - `018_create_merchant_api_keys.sql`
   - `023_create_refresh_tokens.sql`
   - `024_add_password_reset_tokens.sql`

## Conversion Examples

### Simple Index Conversion
```sql
-- BEFORE (unsafe)
CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);

-- AFTER (safe)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email ON users (email);
```

### Partial Index Conversion
```sql
-- BEFORE (unsafe)
CREATE INDEX IF NOT EXISTS idx_webhooks_active ON webhooks (is_active) WHERE is_active = TRUE;

-- AFTER (safe)  
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_webhooks_active ON webhooks (is_active) WHERE is_active = TRUE;
```

### Composite Index Conversion
```sql
-- BEFORE (unsafe)
CREATE INDEX IF NOT EXISTS idx_transactions_user_created ON transactions (user_id, created_at DESC);

-- AFTER (safe)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_user_created ON transactions (user_id, created_at DESC);
```

### Unique Index Conversion
```sql
-- BEFORE (unsafe)
CREATE UNIQUE INDEX IF NOT EXISTS uq_redemptions_idempotency_key ON redemptions (idempotency_key);

-- AFTER (safe)
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS uq_redemptions_idempotency_key ON redemptions (idempotency_key);
```

## Migration Strategy

### Option 1: New Concurrent Index Migrations

Create new migration files with CONCURRENTLY versions:

```sql
-- File: 025_convert_indexes_to_concurrent_batch_1.sql
-- Drop and recreate critical indexes with CONCURRENTLY

-- Users table indexes
DROP INDEX IF EXISTS idx_users_email;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email ON users (email);

DROP INDEX IF EXISTS idx_users_referred_by;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_referred_by ON users (referred_by);

-- Add more indexes...
```

### Option 2: Runtime Index Recreation

For production systems, create a maintenance script:

```sql
-- Script: scripts/recreate-indexes-concurrent.sql
DO $$
DECLARE
    index_record RECORD;
    index_name TEXT;
    table_name TEXT;
    index_def TEXT;
BEGIN
    -- Iterate through non-concurrent indexes on critical tables
    FOR index_record IN 
        SELECT 
            i.indexname,
            i.tablename,
            i.indexdef
        FROM pg_indexes i
        WHERE i.tablename IN ('users', 'transactions', 'point_transactions', 'campaigns')
        AND i.indexname NOT LIKE '%_pkey'  -- Skip primary keys
        AND i.indexname NOT LIKE '%concurrent%'  -- Skip already converted
    LOOP
        index_name := index_record.indexname;
        table_name := index_record.tablename;
        index_def := replace(index_record.indexdef, 'CREATE INDEX', 'CREATE INDEX CONCURRENTLY');
        
        -- Log what we're doing
        RAISE NOTICE 'Converting index: %', index_name;
        
        -- Drop the old index
        EXECUTE 'DROP INDEX IF EXISTS ' || index_name;
        
        -- Create concurrent version
        EXECUTE index_def;
        
        -- Small delay between operations
        PERFORM pg_sleep(1);
    END LOOP;
END $$;
```

## Error Handling and Recovery

### Invalid Index Cleanup

CONCURRENTLY can fail and leave invalid indexes:

```sql
-- Check for invalid indexes
SELECT indexname, tablename 
FROM pg_indexes i
JOIN pg_index x ON i.indexname = x.indexname
WHERE NOT x.indisvalid;

-- Clean up invalid indexes
DROP INDEX CONCURRENTLY invalid_index_name;
```

### Monitoring Progress

```sql
-- Monitor concurrent index creation progress
SELECT 
    pid,
    now() - pg_stat_activity.query_start AS duration,
    query 
FROM pg_stat_activity 
WHERE query LIKE '%CREATE INDEX CONCURRENTLY%';
```

## Implementation Checklist

- [ ] Identify all CREATE INDEX statements without CONCURRENTLY
- [ ] Prioritize by table criticality (users, transactions, campaigns first)
- [ ] Create new migrations with CONCURRENTLY versions
- [ ] Test in staging environment
- [ ] Monitor index creation performance
- [ ] Validate index usage after creation
- [ ] Update application deployment procedures
- [ ] Document rollback procedures

## Performance Impact

### Benefits
- Zero application downtime during index creation
- No blocking of critical read/write operations
- Safe for production deployment

### Costs  
- 2-3x longer index creation time
- Additional disk space during creation
- More complex error handling required

## Conclusion

Converting to `CREATE INDEX CONCURRENTLY` is essential for zero-downtime deployments. While it requires more careful planning and monitoring, it eliminates the production risk of blocking all database operations during index creation.