-- Migration 008: Create contract_events table for audit logging
-- Requirements: #182

CREATE TABLE IF NOT EXISTS contract_events (
  id              SERIAL PRIMARY KEY,
  contract_id     VARCHAR(64)   NOT NULL,
  event_type      VARCHAR(50)   NOT NULL CHECK (event_type IN ('mint', 'claim', 'stake', 'unstake')),
  event_data      JSONB         NOT NULL,
  transaction_hash VARCHAR(64),
  ledger_sequence INTEGER,
  processed_at    TIMESTAMPTZ,
  retry_count     INTEGER       DEFAULT 0,
  status          VARCHAR(20)   DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'failed')),
  error_message   TEXT,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_contract_events_contract_id ON contract_events (contract_id);
CREATE INDEX IF NOT EXISTS idx_contract_events_type ON contract_events (event_type);
CREATE INDEX IF NOT EXISTS idx_contract_events_status ON contract_events (status);
CREATE INDEX IF NOT EXISTS idx_contract_events_created_at ON contract_events (created_at);
CREATE INDEX IF NOT EXISTS idx_contract_events_processed_at ON contract_events (processed_at);
