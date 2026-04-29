ALTER TABLE users
  ADD COLUMN IF NOT EXISTS notification_preferences JSONB NOT NULL DEFAULT '{"rewards":true,"redemptions":true,"campaigns":false,"referrals":true,"system":false}';
