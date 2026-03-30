-- Rollback 004: Drop transactions table and its indexes
DROP INDEX IF EXISTS idx_transactions_from_wallet;
DROP INDEX IF EXISTS idx_transactions_to_wallet;
DROP TABLE IF EXISTS transactions CASCADE;
