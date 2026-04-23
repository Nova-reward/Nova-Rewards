-- Feature flags table
CREATE TABLE IF NOT EXISTS feature_flags (
  id            SERIAL PRIMARY KEY,
  key           VARCHAR(100) NOT NULL UNIQUE,
  enabled       BOOLEAN NOT NULL DEFAULT FALSE,
  rollout_pct   SMALLINT NOT NULL DEFAULT 0 CHECK (rollout_pct BETWEEN 0 AND 100),
  variants      JSONB,          -- e.g. [{"name":"control","weight":50},{"name":"treatment","weight":50}]
  metadata      JSONB,          -- arbitrary context (owner, ticket, etc.)
  expires_at    TIMESTAMPTZ,    -- NULL = never expires
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feature_flags_key ON feature_flags(key);
CREATE INDEX IF NOT EXISTS idx_feature_flags_expires_at ON feature_flags(expires_at) WHERE expires_at IS NOT NULL;

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION set_feature_flag_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_feature_flags_updated_at ON feature_flags;
CREATE TRIGGER trg_feature_flags_updated_at
  BEFORE UPDATE ON feature_flags
  FOR EACH ROW EXECUTE FUNCTION set_feature_flag_updated_at();

-- Analytics: flag evaluation events
CREATE TABLE IF NOT EXISTS feature_flag_events (
  id         BIGSERIAL PRIMARY KEY,
  flag_key   VARCHAR(100) NOT NULL,
  user_id    INTEGER,
  result     BOOLEAN NOT NULL,
  variant    VARCHAR(50),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ffe_flag_key ON feature_flag_events(flag_key);
CREATE INDEX IF NOT EXISTS idx_ffe_created_at ON feature_flag_events(created_at);
