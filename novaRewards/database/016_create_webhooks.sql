-- Migration 016: Webhook registration and delivery tracking

CREATE TABLE IF NOT EXISTS webhooks (
  id           SERIAL PRIMARY KEY,
  merchant_id  INTEGER       NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  url          TEXT          NOT NULL,
  secret       VARCHAR(64)   NOT NULL,                          -- HMAC-SHA256 signing secret
  events       TEXT[]        NOT NULL DEFAULT '{}',             -- subscribed event types
  is_active    BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhooks_merchant ON webhooks (merchant_id);
CREATE INDEX IF NOT EXISTS idx_webhooks_active   ON webhooks (is_active) WHERE is_active = TRUE;

-- Delivery attempt log
CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id            SERIAL PRIMARY KEY,
  webhook_id    INTEGER       NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
  event_type    VARCHAR(60)   NOT NULL,
  payload       JSONB         NOT NULL,
  status        VARCHAR(20)   NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending', 'success', 'failed')),
  http_status   INTEGER,
  response_body TEXT,
  attempt       SMALLINT      NOT NULL DEFAULT 1,
  next_retry_at TIMESTAMPTZ,
  delivered_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wd_webhook    ON webhook_deliveries (webhook_id);
CREATE INDEX IF NOT EXISTS idx_wd_status     ON webhook_deliveries (status);
CREATE INDEX IF NOT EXISTS idx_wd_retry      ON webhook_deliveries (next_retry_at)
  WHERE status = 'failed' AND next_retry_at IS NOT NULL;
