-- Migration 015: Create search_analytics table
-- Tracks every search query for ranking signals and analytics dashboards.

CREATE TABLE IF NOT EXISTS search_analytics (
  id           SERIAL PRIMARY KEY,
  user_id      INTEGER      REFERENCES users(id) ON DELETE SET NULL,
  query        TEXT         NOT NULL,
  entity_type  VARCHAR(30)  NOT NULL DEFAULT 'all',  -- 'rewards', 'campaigns', 'users', 'all'
  result_count INTEGER      NOT NULL DEFAULT 0,
  clicked_id   INTEGER,                               -- entity id the user clicked (nullable)
  clicked_type VARCHAR(30),                           -- entity type of the clicked result
  duration_ms  INTEGER,                               -- ES query latency
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sa_query       ON search_analytics (query);
CREATE INDEX IF NOT EXISTS idx_sa_user        ON search_analytics (user_id);
CREATE INDEX IF NOT EXISTS idx_sa_created_at  ON search_analytics (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sa_entity_type ON search_analytics (entity_type);
