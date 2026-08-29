# PostgreSQL Lock Behavior Analysis - Zero Downtime Migration Risks

## Executive Summary

This document provides a detailed analysis of PostgreSQL lock behavior and downtime risks identified in the Nova-Rewards migration audit. Understanding these lock patterns is critical for implementing zero-downtime deployments in production environments.

## PostgreSQL Lock Modes Overview

PostgreSQL uses Multi-Version Concurrency Control (MVCC) with various lock levels that determine concurrent access patterns:

### Lock Hierarchy (Least to Most Restrictive)

| Lock Mode | Abbreviation | Blocks | Allows | Use Case |
|-----------|--------------|--------|--------|-----------|
| **ACCESS SHARE** | AS | None | All reads/writes | SELECT queries |
| **ROW SHARE** | RS | ACCESS EXCLUSIVE | Most operations | SELECT FOR UPDATE |
| **ROW EXCLUSIVE** | RX | SHARE, SHARE ROW EXCLUSIVE, EXCLUSIVE, ACCESS EXCLUSIVE | SELECT, INSERT, UPDATE, DELETE | DML operations |
| **SHARE UPDATE EXCLUSIVE** | SUE | SHARE UPDATE EXCLUSIVE, SHARE, SHARE ROW EXCLUSIVE, EXCLUSIVE, ACCESS EXCLUSIVE | SELECT, INSERT, UPDATE, DELETE | VACUUM, CREATE INDEX CONCURRENTLY |
| **SHARE** | S | ROW EXCLUSIVE, SHARE UPDATE EXCLUSIVE, SHARE ROW EXCLUSIVE, EXCLUSIVE, ACCESS EXCLUSIVE | SELECT | CREATE INDEX |
| **SHARE ROW EXCLUSIVE** | SRE | ROW EXCLUSIVE, SHARE UPDATE EXCLUSIVE, SHARE, SHARE ROW EXCLUSIVE, EXCLUSIVE, ACCESS EXCLUSIVE | SELECT | Some ALTER TABLE operations |
| **EXCLUSIVE** | E | ROW EXCLUSIVE, SHARE UPDATE EXCLUSIVE, SHARE, SHARE ROW EXCLUSIVE, EXCLUSIVE, ACCESS EXCLUSIVE | SELECT | Some DDL operations |
| **ACCESS EXCLUSIVE** | AE | **ALL OTHER LOCKS** | **NOTHING** | Most DDL operations |

## Critical Risk: ACCESS EXCLUSIVE Locks

**Impact:** Blocks ALL concurrent operations (reads and writes)
**Duration:** Until transaction commits or rolls back
**Production Risk:** Complete application downtime

### Operations That Acquire ACCESS EXCLUSIVE Locks

1. **ALTER TABLE ADD COLUMN with DEFAULT**
   - Requires rewriting entire table to set default values
   - Lock duration proportional to table size
   - **Estimated downtime:** 1-10 seconds per million rows

2. **ALTER TABLE ALTER COLUMN TYPE**
   - Triggers complete table rewrite
   - **Most dangerous operation** in our audit
   - **Estimated downtime:** 10-300 seconds for large tables

3. **CREATE INDEX (without CONCURRENTLY)**
   - Scans entire table to build index
   - **32 migrations affected** in our audit
   - **Estimated downtime:** 5-60 seconds per index

4. **ALTER TABLE ADD CONSTRAINT**
   - Must verify constraint across entire table
   - Lock duration depends on validation complexity

5. **CREATE TRIGGER**
   - Requires exclusive access to modify table metadata
   - Usually fast but blocks all access

## Detailed Risk Analysis by Migration

### HIGH RISK: Table Rewrite Operations

#### `011_point_transactions_secure_schema.sql`
```sql
-- CRITICAL: Causes complete table rewrite
ALTER TABLE point_transactions DROP COLUMN amount;
ALTER TABLE point_transactions RENAME COLUMN amount_int TO amount;
```

**PostgreSQL Behavior:**
- **Lock:** ACCESS EXCLUSIVE for entire operation
- **Process:** 
  1. Creates new table with modified schema
  2. Copies all existing data row-by-row
  3. Rebuilds all indexes
  4. Updates system catalogs
  5. Drops old table
- **Blocking:** All SELECT, INSERT, UPDATE, DELETE operations
- **Duration:** Proportional to table size (could be minutes for large tables)
- **MVCC Impact:** No concurrent transactions can proceed

#### `019_field_level_encryption.sql`
```sql
-- CRITICAL: Column type change triggers rewrite
ALTER TABLE webhooks ALTER COLUMN secret TYPE TEXT;
ALTER TABLE users ALTER COLUMN email TYPE TEXT;
```

**PostgreSQL Behavior:**
- **Lock:** ACCESS EXCLUSIVE
- **Process:** Table rewrite required when changing column type
- **Risk Level:** CRITICAL for users table (core application data)

### HIGH RISK: Multiple Schema Changes

#### `015_transaction_service_lifecycle.sql`
```sql
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_tx_type_check;
ALTER TABLE transactions ALTER COLUMN from_wallet DROP NOT NULL;
ALTER TABLE transactions ALTER COLUMN to_wallet DROP NOT NULL;
ALTER TABLE transactions ALTER COLUMN merchant_id DROP NOT NULL;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id);
-- ... more operations
```

**PostgreSQL Behavior:**
- **Lock:** ACCESS EXCLUSIVE for each operation
- **Accumulation Effect:** Lock time accumulates across multiple operations
- **Risk:** Extended downtime from sequential lock acquisitions

### MEDIUM-HIGH RISK: Index Creation

#### Pattern: `CREATE INDEX` (without CONCURRENTLY)
Found in 32 migrations, examples:
```sql
-- UNSAFE: Acquires ACCESS EXCLUSIVE lock
CREATE INDEX IF NOT EXISTS idx_campaigns_merchant_id ON campaigns (merchant_id);
CREATE INDEX IF NOT EXISTS idx_transactions_from_wallet ON transactions (from_wallet);
```

**PostgreSQL Behavior:**
- **Lock:** ACCESS EXCLUSIVE
- **Process:**
  1. Scans entire table to build index
  2. Sorts key values
  3. Writes index pages to disk
  4. Updates system catalogs
- **Duration:** Proportional to table size and index complexity
- **Blocking:** All table access during creation

**Safe Alternative:**
```sql
-- SAFE: Uses SHARE UPDATE EXCLUSIVE lock
CREATE INDEX CONCURRENTLY idx_campaigns_merchant_id ON campaigns (merchant_id);
```

### MEDIUM RISK: ADD COLUMN with DEFAULT

#### Pattern: `ALTER TABLE ADD COLUMN ... DEFAULT`
Examples from multiple migrations:
```sql
-- UNSAFE: Rewrites entire table
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_preferences JSONB NOT NULL DEFAULT '{"rewards":true}';
```

**PostgreSQL Behavior:**
- **Lock:** ACCESS EXCLUSIVE
- **Process:** 
  1. Adds column metadata
  2. **Rewrites entire table** to populate default values
  3. Rebuilds all indexes that don't explicitly exclude the column
- **MVCC Impact:** All existing snapshots become invalid

**Safe Alternative (Three-Phase Pattern):**
```sql
-- Phase 1: Add nullable column (fast)
ALTER TABLE campaigns ADD COLUMN updated_at TIMESTAMPTZ;

-- Phase 2: Backfill in batches (can be done during low traffic)
UPDATE campaigns SET updated_at = NOW() WHERE updated_at IS NULL;

-- Phase 3: Add NOT NULL constraint (fast)
ALTER TABLE campaigns ALTER COLUMN updated_at SET NOT NULL;
```

## Lock Contention Scenarios

### Scenario 1: User Login During Migration
**Migration:** `019_field_level_encryption.sql` modifies users table
**Application Query:** `SELECT * FROM users WHERE wallet_address = $1`
**Result:** Query blocks until migration completes (potentially minutes)
**User Impact:** Login timeout, session failures

### Scenario 2: Transaction Processing During Index Creation
**Migration:** Creating index on transactions table
**Application Query:** `INSERT INTO transactions (...) VALUES (...)`
**Result:** Transaction processing halts completely
**Business Impact:** Payment processing downtime

### Scenario 3: Campaign Updates During Schema Change
**Migration:** Adding columns to campaigns table
**Application Query:** `UPDATE campaigns SET is_active = false WHERE id = $1`
**Result:** Campaign management interface freezes
**Admin Impact:** Cannot manage active campaigns

## MVCC Implications

### Snapshot Isolation Impact

PostgreSQL's MVCC system creates transaction snapshots, but ACCESS EXCLUSIVE locks break this isolation:

1. **Active Transactions:** Any transaction that started before the migration will block
2. **New Transactions:** Cannot start until lock is released
3. **Connection Pooling:** Pool exhaustion as connections wait for locks
4. **Cascading Failures:** Backend services timeout waiting for database responses

### Deadlock Scenarios

Migrations that acquire multiple locks can create deadlock opportunities:
```sql
-- Migration acquires lock on table A, then table B
-- Application transaction holds lock on table B, needs table A
-- Result: Deadlock, one transaction must be killed
```

## Safe Migration Patterns

### 1. CREATE INDEX CONCURRENTLY
```sql
-- Instead of: CREATE INDEX idx_name ON table (column);
CREATE INDEX CONCURRENTLY idx_name ON table (column);
```
**Lock:** SHARE UPDATE EXCLUSIVE (allows reads and writes)
**Limitation:** Cannot be used inside transaction blocks

### 2. Three-Phase NOT NULL Migration
```sql
-- Phase 1: Add nullable column
ALTER TABLE table ADD COLUMN new_col TYPE;

-- Phase 2: Backfill (batched updates during low traffic)
UPDATE table SET new_col = default_value WHERE new_col IS NULL;

-- Phase 3: Add constraint
ALTER TABLE table ALTER COLUMN new_col SET NOT NULL;
```

### 3. Column Type Changes
```sql
-- Instead of: ALTER TABLE table ALTER COLUMN col TYPE new_type;
-- Use: Add new column, migrate data, drop old column
ALTER TABLE table ADD COLUMN col_new new_type;
UPDATE table SET col_new = col::new_type;  -- batched
ALTER TABLE table DROP COLUMN col;
ALTER TABLE table RENAME COLUMN col_new TO col;
```

## Monitoring and Alerting

### Essential Metrics During Migration

1. **Active Connections:** `SELECT count(*) FROM pg_stat_activity`
2. **Waiting Queries:** `SELECT * FROM pg_stat_activity WHERE waiting = true`
3. **Lock Waits:** `SELECT * FROM pg_locks WHERE NOT granted`
4. **Transaction Age:** Check for long-running transactions that could block migrations

### Lock Timeout Configuration

```sql
-- Set statement timeout to prevent indefinite waits
SET statement_timeout = '30s';
SET lock_timeout = '10s';
```

## Conclusion

The current migration set poses significant production risks due to:

1. **Systematic use of ACCESS EXCLUSIVE operations** (32 migrations)
2. **Table rewrite operations** that could cause minutes of downtime
3. **Multiple schema changes** that accumulate lock time
4. **Critical table modifications** (users, transactions) without safe patterns

Implementing the recommended three-phase patterns and CONCURRENTLY options is essential for zero-downtime deployments.