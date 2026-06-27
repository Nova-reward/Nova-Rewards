-- Migration 007: Add composite index on transactions for user history queries
-- Requirements: #180

-- Add user_id column to transactions if it doesn't exist
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id);

-- Composite index for fast user transaction history queries
CREATE INDEX IF NOT EXISTS idx_transactions_user_created 
  ON transactions (user_id, created_at DESC);

-- Index for filtering by transaction type
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions (tx_type);

-- Index for date range queries
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions (created_at);
