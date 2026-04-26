-- Test Fixtures for Nova Rewards (PL/pgSQL Functions)
-- Run: psql -d test_db -f test_fixtures.sql
-- Usage: SELECT create_user('test@example.com', 'Test User'); -- returns user_id

-- Enable UUID extension if not already
CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";

-- Factory: create_user(email, name, referral_code, referred_by)
CREATE OR REPLACE FUNCTION create_user(
    p_email TEXT DEFAULT 'test@example.com',
    p_name TEXT DEFAULT 'Test User',
    p_referral_code TEXT DEFAULT 'TEST' || uuid_generate_v4()::text[:10],
    p_referred_by INTEGER DEFAULT NULL
) RETURNS INTEGER AS $$
DECLARE
    v_user_id INTEGER;
BEGIN
    INSERT INTO users (email, name, referral_code, referred_by, created_at)
    VALUES (p_email, p_name, p_referral_code, p_referred_by, NOW())
    RETURNING id INTO v_user_id;
    
    RETURN v_user_id;
END;
$$ LANGUAGE plpgsql;

-- Factory: create_campaign(merchant_id, name, points_per_dollar, active)
CREATE OR REPLACE FUNCTION create_campaign(
    p_merchant_id INTEGER DEFAULT 1, -- assume merchant 1 exists
    p_name TEXT DEFAULT 'Test Campaign',
    p_points_per_dollar NUMERIC DEFAULT 1.0,
    p_active BOOLEAN DEFAULT true
) RETURNS INTEGER AS $$
DECLARE
    v_campaign_id INTEGER;
BEGIN
    INSERT INTO campaigns (merchant_id, name, points_per_dollar, active, created_at)
    VALUES (p_merchant_id, p_name, p_points_per_dollar, p_active, NOW())
    RETURNING id INTO v_campaign_id;
    
    RETURN v_campaign_id;
END;
$$ LANGUAGE plpgsql;

-- Factory: create_transaction(user_id, campaign_id, amount, points_earned)
CREATE OR REPLACE FUNCTION create_transaction(
    p_user_id INTEGER,
    p_campaign_id INTEGER,
    p_amount DECIMAL DEFAULT 10.00,
    p_points_earned INTEGER DEFAULT 10
) RETURNS INTEGER AS $$
DECLARE
    v_tx_id INTEGER;
BEGIN
    INSERT INTO transactions (user_id, campaign_id, amount, points_earned, created_at)
    VALUES (p_user_id, p_campaign_id, p_amount, p_points_earned, NOW())
    RETURNING id INTO v_tx_id;
    
    -- Update user balance trigger should fire automatically
    RETURN v_tx_id;
END;
$$ LANGUAGE plpgsql;

-- Factory: create_merchant(name, api_key)
CREATE OR REPLACE FUNCTION create_merchant(
    p_name TEXT DEFAULT 'Test Merchant',
    p_api_key TEXT DEFAULT 'test-api-key-123'
) RETURNS INTEGER AS $$
DECLARE
    v_merchant_id INTEGER;
BEGIN
    INSERT INTO merchants (name, api_key, created_at)
    VALUES (p_name, p_api_key, NOW())
    RETURNING id INTO v_merchant_id;
    
    RETURN v_merchant_id;
END;
$$ LANGUAGE plpgsql;

-- Clean up function: truncate_test_tables()
CREATE OR REPLACE FUNCTION truncate_test_tables() RETURNS VOID AS $$
BEGIN
    TRUNCATE TABLE transactions, campaigns, users, merchants RESTART IDENTITY CASCADE;
END;
$$ LANGUAGE plpgsql;

-- Example usage:
-- SELECT create_merchant();
-- SELECT create_user();
-- SELECT create_campaign();
-- SELECT create_transaction(1, 1);

COMMENT ON SCHEMA public IS 'Test fixtures loaded for development/testing';
