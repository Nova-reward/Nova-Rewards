# Zero-Downtime Migration Guide

## Purpose

This guide provides maintainers with production-grade patterns and procedures for implementing database migrations without application downtime. All techniques have been audited for the Nova-Rewards PostgreSQL environment and follow established zero-downtime practices.

## Zero-Downtime Principles

### Core Concept
**Zero-downtime migrations** ensure that database schema changes can be applied while the application continues serving users without interruption. This requires understanding PostgreSQL's locking behavior and MVCC (Multi-Version Concurrency Control) system.

### Key Requirements
1. **Never acquire ACCESS EXCLUSIVE locks** during high-traffic periods
2. **Minimize lock duration** through batched operations
3. **Maintain backward compatibility** during transition periods  
4. **Provide rollback capabilities** for all changes
5. **Monitor and alert** on lock waits and query performance

## PostgreSQL Lock Overview

### Lock Hierarchy (Risk Level)
```
ACCESS SHARE       ← SAFE (SELECT queries)
ROW SHARE          ← SAFE (SELECT FOR UPDATE)
ROW EXCLUSIVE      ← SAFE (INSERT, UPDATE, DELETE)
SHARE UPDATE EXCLUSIVE  ← SAFE (VACUUM, CREATE INDEX CONCURRENTLY)
SHARE              ← CAUTION (CREATE INDEX)
SHARE ROW EXCLUSIVE     ← DANGER (Some ALTER TABLE operations)
EXCLUSIVE          ← DANGER (Some DDL)
ACCESS EXCLUSIVE   ← CRITICAL (Most DDL, blocks everything)
```

### Production Impact
- **ACCESS EXCLUSIVE**: Blocks ALL operations (reads and writes)
- **SHARE/EXCLUSIVE**: Blocks writes, allows reads
- **ROW EXCLUSIVE and below**: Safe for production use

## Safe Migration Checklist

Before creating any migration, verify:

- [ ] No `CREATE INDEX` without `CONCURRENTLY`
- [ ] No `ALTER COLUMN TYPE` (use new column approach)
- [ ] No `ALTER TABLE ADD COLUMN ... NOT NULL` (use three-phase)
- [ ] No `REINDEX` (use drop + CREATE INDEX CONCURRENTLY)
- [ ] All constraint additions use `NOT VALID` initially
- [ ] Batched data migrations with delay between batches
- [ ] Tested on staging with production-like data volume
- [ ] Rollback procedure documented and tested

## Safe Migration Patterns

### 1. Three-Phase NOT NULL Migration

**Problem**: `ALTER TABLE ADD COLUMN ... NOT NULL` rewrites the entire table

**Solution**: Split into three phases
```sql
-- PHASE 1: Add nullable column (fast)
ALTER TABLE campaigns 
  ADD COLUMN updated_at TIMESTAMPTZ;

-- PHASE 2: Backfill in batches (safe)
DO $$
DECLARE
  batch_size INTEGER := 1000;
  updated_count INTEGER;
BEGIN
  LOOP
    UPDATE campaigns 
    SET updated_at = COALESCE(updated_at, created_at, NOW())
    WHERE updated_at IS NULL
    AND id IN (SELECT id FROM campaigns WHERE updated_at IS NULL LIMIT batch_size);
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    IF updated_count = 0 THEN EXIT; END IF;
    
    PERFORM pg_sleep(0.1);  -- Allow other operations
  END LOOP;
END $$;

-- PHASE 3: Add constraint (fast, metadata-only)
ALTER TABLE campaigns 
  ALTER COLUMN updated_at SET NOT NULL;
```

### 2. Safe Index Creation

**Problem**: `CREATE INDEX` blocks all table access

**Solution**: Use CONCURRENTLY
```sql
-- UNSAFE: Blocks reads and writes
CREATE INDEX idx_users_email ON users (email);

-- SAFE: Allows concurrent operations
CREATE INDEX CONCURRENTLY idx_users_email ON users (email);
```

**Important**: CONCURRENTLY cannot be used inside transaction blocks

### 3. Column Type Changes

**Problem**: `ALTER COLUMN TYPE` rewrites entire table

**Solution**: New column approach
```sql
-- STEP 1: Add new column
ALTER TABLE users ADD COLUMN email_new TEXT;

-- STEP 2: Migrate data in batches
DO $$
DECLARE
  batch_size INTEGER := 1000;
BEGIN
  LOOP
    UPDATE users 
    SET email_new = email::TEXT 
    WHERE email_new IS NULL AND email IS NOT NULL
    AND id IN (SELECT id FROM users WHERE email_new IS NULL LIMIT batch_size);
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    IF updated_count = 0 THEN EXIT; END IF;
    
    PERFORM pg_sleep(0.05);
  END LOOP;
END $$;

-- STEP 3: Application deployment to use new column

-- STEP 4: Drop old column (separate migration after app deployment)
ALTER TABLE users DROP COLUMN email;
ALTER TABLE users RENAME COLUMN email_new TO email;
```

### 4. Safe Constraint Addition

**Problem**: `ADD CONSTRAINT` validates entire table

**Solution**: Use NOT VALID initially
```sql
-- STEP 1: Add constraint without validation
ALTER TABLE campaigns 
  ADD CONSTRAINT chk_end_date_after_start 
  CHECK (end_date > start_date) NOT VALID;

-- STEP 2: Validate existing data (can be done later during low traffic)
VALIDATE CONSTRAINT chk_end_date_after_start;
```

## Unsafe Patterns to Avoid

### ❌ CREATE INDEX (without CONCURRENTLY)
```sql
-- DANGEROUS: Blocks all access
CREATE INDEX idx_users_wallet ON users (wallet_address);
```

### ❌ ALTER COLUMN TYPE  
```sql
-- DANGEROUS: Table rewrite
ALTER TABLE webhooks ALTER COLUMN secret TYPE TEXT;
```

### ❌ ADD COLUMN with DEFAULT
```sql  
-- DANGEROUS: Table rewrite
ALTER TABLE users ADD COLUMN preferences JSONB DEFAULT '{}';
```

### ❌ REINDEX
```sql
-- DANGEROUS: Exclusive lock
REINDEX INDEX idx_users_wallet;
```

### ❌ Unbatched large updates
```sql
-- DANGEROUS: Long transaction, blocks other operations
UPDATE point_transactions SET status = 'active' WHERE status IS NULL;
```

## Migration Testing Strategy

### 1. Staging Environment Testing
```bash
# Test with production-like data volume
pg_dump production_db | psql staging_db

# Run migration on staging
node database/migrate.js --audit  # Check for unsafe patterns
node database/migrate.js          # Apply migration

# Measure lock times and performance impact
```

### 2. Lock Monitoring Queries
```sql
-- Monitor active locks during migration
SELECT 
  pid,
  mode,
  locktype,
  relation::regclass,
  granted
FROM pg_locks 
WHERE NOT granted;

-- Monitor waiting queries
SELECT 
  pid,
  wait_event,
  state,
  query
FROM pg_stat_activity 
WHERE wait_event IS NOT NULL;
```

### 3. Performance Validation
```sql
-- Check query performance after migration
EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM users WHERE email = 'test@example.com';

-- Verify index usage
SELECT schemaname, tablename, indexname, idx_tup_read, idx_tup_fetch 
FROM pg_stat_user_indexes 
WHERE schemaname = 'public';
```

## Operational Checklist

### Pre-Migration
- [ ] Backup database (automated backup verified)
- [ ] Test migration on staging with production data volume
- [ ] Verify rollback procedure works
- [ ] Check current system load and active connections
- [ ] Alert team of maintenance window (even for zero-downtime)
- [ ] Set up monitoring for lock waits and query performance

### During Migration
- [ ] Monitor active connections: `SELECT count(*) FROM pg_stat_activity;`
- [ ] Watch for lock waits: `SELECT * FROM pg_locks WHERE NOT granted;`
- [ ] Monitor application error rates
- [ ] Check query performance for degradation
- [ ] Verify migration progress with `\d table_name`

### Post-Migration  
- [ ] Verify application functionality
- [ ] Check query plans for performance regressions
- [ ] Monitor error logs for migration-related issues
- [ ] Update application deployment if needed
- [ ] Document any issues and lessons learned

## Rollback Procedures

### For Schema Changes
```sql
-- Most schema changes can be rolled back using down migrations
node database/migrate.js --rollback
```

### For Data Migrations
```sql
-- For data changes, maintain original values
UPDATE table SET column = old_value WHERE changed_condition;
```

### For Index Changes
```sql
-- Safe to drop and recreate indexes
DROP INDEX CONCURRENTLY IF EXISTS idx_name;
CREATE INDEX CONCURRENTLY idx_name_original ON table (original_columns);
```

## Backfill Strategies

### Small Tables (< 100K rows)
```sql
-- Simple update acceptable
UPDATE small_table SET new_column = calculated_value WHERE new_column IS NULL;
```

### Medium Tables (100K - 10M rows)
```sql
-- Batched updates with progress tracking
DO $$
DECLARE
  batch_size INTEGER := 5000;
  updated_count INTEGER;
  total_updated INTEGER := 0;
BEGIN
  LOOP
    UPDATE medium_table 
    SET new_column = calculated_value 
    WHERE new_column IS NULL 
    AND id IN (SELECT id FROM medium_table WHERE new_column IS NULL LIMIT batch_size);
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    total_updated := total_updated + updated_count;
    
    IF updated_count = 0 THEN EXIT; END IF;
    
    RAISE NOTICE 'Updated % rows (total: %)', updated_count, total_updated;
    PERFORM pg_sleep(0.1);
  END LOOP;
END $$;
```

### Large Tables (> 10M rows)
```sql
-- Partition-based approach or separate background job
-- Consider using a dedicated worker process outside of migration
```

## Examples from Nova-Rewards

### Safe Migration Examples
See the following files for production-ready examples:

1. **Three-Phase NOT NULL**: `005_campaigns_updated_at_trigger_safe.up.sql`
2. **JSON Column Addition**: `017_add_notification_preferences_safe.up.sql`  
3. **Column Type Change**: `019_field_level_encryption_safe.up.sql`
4. **Complex Schema**: `011_point_transactions_secure_schema_safe.up.sql`

### Index Conversion Examples
See: `docs/examples/025_convert_critical_indexes_concurrent_example.sql`

## Future Contributor Guidelines

### When Creating New Migrations

1. **Always run audit first**:
   ```bash
   node database/migrate.js --audit
   ```

2. **Use the safe patterns** documented in this guide

3. **Test on staging** with production-like data

4. **Document any special considerations** in migration comments

### Code Review Checklist

- [ ] Migration uses safe patterns only
- [ ] Large data changes are batched
- [ ] Indexes use CONCURRENTLY where possible
- [ ] NOT NULL columns use three-phase approach
- [ ] Column type changes use new column approach
- [ ] Rollback procedure is documented
- [ ] Performance impact is assessed

### Emergency Procedures

If a migration causes production issues:

1. **Stop the migration** if still running
2. **Check for blocking locks**: `SELECT * FROM pg_locks WHERE NOT granted;`
3. **Kill blocking queries** if necessary: `SELECT pg_terminate_backend(pid);`
4. **Rollback if possible**: `node database/migrate.js --rollback`
5. **Communicate status** to the team
6. **Document the incident** for future prevention

## Conclusion

Zero-downtime migrations require careful planning and understanding of PostgreSQL internals. By following these patterns and procedures, the Nova-Rewards system can maintain high availability while evolving the database schema.

For questions or clarifications, refer to:
- `docs/ops/postgresql-lock-analysis.md` - Detailed lock behavior analysis  
- `docs/ops/migration-audit.md` - Complete migration audit results
- `docs/ops/concurrent-index-conversion-guide.md` - Index conversion guide