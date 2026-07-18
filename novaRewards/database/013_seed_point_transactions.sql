-- Migration 013: Seed sample point transactions for local development
-- Creates two demo users and a realistic transaction history.
-- Requirements: #190
-- NOTE: Only runs if no point_transactions exist (idempotent guard).

DO $$
DECLARE
  v_user1 INTEGER;
  v_user2 INTEGER;
  v_bal   INTEGER;
BEGIN
  -- Skip if data already exists
  IF (SELECT COUNT(*) FROM point_transactions) > 0 THEN
    RAISE NOTICE 'Seed data already present, skipping.';
    RETURN;
  END IF;

  -- Ensure demo users exist
  INSERT INTO users (wallet_address)
    VALUES ('GDEMO1AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA')
    ON CONFLICT (wallet_address) DO NOTHING;

  INSERT INTO users (wallet_address)
    VALUES ('GDEMO2AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA')
    ON CONFLICT (wallet_address) DO NOTHING;

  SELECT id INTO v_user1 FROM users WHERE wallet_address = 'GDEMO1AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
  SELECT id INTO v_user2 FROM users WHERE wallet_address = 'GDEMO2AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

  -- Ensure user_balance rows exist for demo users
  INSERT INTO user_balance (user_id, balance) VALUES (v_user1, 0) ON CONFLICT DO NOTHING;
  INSERT INTO user_balance (user_id, balance) VALUES (v_user2, 0) ON CONFLICT DO NOTHING;

  -- ---- User 1 transactions ----

  -- earned: 100 pts
  v_bal := 0;
  INSERT INTO point_transactions (user_id, type, amount, balance_before, balance_after, description)
    VALUES (v_user1, 'earned', 100, v_bal, v_bal + 100, 'Welcome bonus');
  v_bal := v_bal + 100;

  -- bonus: 50 pts
  INSERT INTO point_transactions (user_id, type, amount, balance_before, balance_after, description)
    VALUES (v_user1, 'bonus', 50, v_bal, v_bal + 50, 'Daily login bonus');
  v_bal := v_bal + 50;

  -- referral: 200 pts
  INSERT INTO point_transactions (user_id, type, amount, balance_before, balance_after, description)
    VALUES (v_user1, 'referral', 200, v_bal, v_bal + 200, 'Referral reward for inviting a friend');
  v_bal := v_bal + 200;

  -- redeemed: 75 pts (amount is positive; sign is conveyed by type)
  INSERT INTO point_transactions (user_id, type, amount, balance_before, balance_after, description)
    VALUES (v_user1, 'redeemed', 75, v_bal, v_bal - 75, 'Redeemed for store credit');
  v_bal := v_bal - 75;

  -- expired: 25 pts
  INSERT INTO point_transactions (user_id, type, amount, balance_before, balance_after, description)
    VALUES (v_user1, 'expired', 25, v_bal, v_bal - 25, 'Points expired after 90 days');
  v_bal := v_bal - 25;

  -- Sync user1 balance
  UPDATE user_balance SET balance = v_bal, updated_at = NOW() WHERE user_id = v_user1;

  -- ---- User 2 transactions ----

  v_bal := 0;
  INSERT INTO point_transactions (user_id, type, amount, balance_before, balance_after, description)
    VALUES (v_user2, 'earned', 500, v_bal, v_bal + 500, 'Campaign reward');
  v_bal := v_bal + 500;

  INSERT INTO point_transactions (user_id, type, amount, balance_before, balance_after, description)
    VALUES (v_user2, 'redeemed', 100, v_bal, v_bal - 100, 'Redeemed for discount');
  v_bal := v_bal - 100;

  UPDATE user_balance SET balance = v_bal, updated_at = NOW() WHERE user_id = v_user2;

  RAISE NOTICE 'Seed data inserted successfully.';
END;
$$;
