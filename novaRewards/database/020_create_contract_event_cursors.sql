-- Migration 020: Create contract_event_cursors table for Horizon stream cursor persistence
-- Requirements: #657

CREATE TABLE IF NOT EXISTS contract_event_cursors (
  contract_id  VARCHAR(64) PRIMARY KEY,
  cursor       TEXT        NOT NULL,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
