-- Run once as the RDS master user after the instance is provisioned.
-- Creates nova_app (runtime) and nova_migrate (migrations) with least-privilege grants.
-- Passwords are supplied via psql variables:
--   psql ... -v app_password="$APP_PASS" -v migrate_password="$MIG_PASS"

-- ── nova_app: SELECT / INSERT / UPDATE / DELETE on all tables ─────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'nova_app') THEN
    EXECUTE format('CREATE ROLE nova_app LOGIN PASSWORD %L', :'app_password');
  END IF;
END$$;

GRANT CONNECT ON DATABASE nova_rewards TO nova_app;
GRANT USAGE  ON SCHEMA public TO nova_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES    IN SCHEMA public TO nova_app;
GRANT USAGE, SELECT                  ON ALL SEQUENCES IN SCHEMA public TO nova_app;

-- Ensure future tables are also covered
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES    TO nova_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT                  ON SEQUENCES TO nova_app;

-- ── nova_migrate: full DDL rights (CREATE / ALTER / DROP) ────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'nova_migrate') THEN
    EXECUTE format('CREATE ROLE nova_migrate LOGIN PASSWORD %L', :'migrate_password');
  END IF;
END$$;

GRANT CONNECT ON DATABASE nova_rewards TO nova_migrate;
GRANT CREATE  ON SCHEMA public         TO nova_migrate;
GRANT ALL     ON ALL TABLES    IN SCHEMA public TO nova_migrate;
GRANT ALL     ON ALL SEQUENCES IN SCHEMA public TO nova_migrate;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON TABLES    TO nova_migrate;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON SEQUENCES TO nova_migrate;
