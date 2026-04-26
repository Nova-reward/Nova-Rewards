/**
 * Migration 015: Create Analytics Tables
 * Requirements: #362 Analytics Service
 */

-- Table to store generic events
CREATE TABLE IF NOT EXISTS analytics_events (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    name VARCHAR(255) NOT NULL, -- e.g. 'login', 'page_view', 'cta_click'
    category VARCHAR(255) NOT NULL, -- e.g. 'auth', 'navigation', 'reward'
    label VARCHAR(255), -- optional extra label
    value NUMERIC(10, 2), -- optional numeric value (revenue, points, etc.)
    properties JSONB, -- dynamic properties
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for querying by user
CREATE INDEX IF NOT EXISTS idx_analytics_user ON analytics_events(user_id);

-- Index for querying by event name/category
CREATE INDEX IF NOT EXISTS idx_analytics_name ON analytics_events(name);
CREATE INDEX IF NOT EXISTS idx_analytics_category ON analytics_events(category);

-- Table for funnel tracking (optional but useful for #362)
CREATE TABLE IF NOT EXISTS analytics_funnels (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    steps JSONB NOT NULL, -- [{"name": "visit"}, {"name": "register"}, {"name": "first_reward"}]
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
