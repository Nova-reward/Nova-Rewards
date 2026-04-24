'use strict';

/**
 * Pact provider state handlers for Nova Rewards backend.
 *
 * Each handler sets up the necessary mocks/stubs so that when the Pact
 * verifier replays a consumer interaction, the provider returns the
 * expected response.
 *
 * State names must match exactly the `states[].description` values used
 * in the consumer Pact tests (novaRewards/frontend/pact/*.pact.test.js).
 *
 * Requirements: 3.1, 3.2
 */

const { query } = require('../db/index');

// ── Shared fixture rows ────────────────────────────────────────────────────

const USER_ROW = {
  id: 42,
  email: 'alice@example.com',
  password_hash: '$2b$12$hashedpassword',
  first_name: 'Alice',
  last_name: 'Smith',
  role: 'user',
  wallet_address: 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN',
  stellar_public_key: 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const ADMIN_USER_ROW = {
  ...USER_ROW,
  id: 1,
  email: 'admin@example.com',
  role: 'admin',
};

const CAMPAIGN_ROW = {
  id: 3,
  merchant_id: 7,
  name: 'Summer Loyalty Drive',
  reward_rate: '1.5',
  start_date: '2025-06-01',
  end_date: '2025-08-31',
  is_active: true,
  on_chain_status: 'confirmed',
  contract_campaign_id: 'contract-id-abc',
  tx_hash: 'txhash-abc',
  deleted_at: null,
};

const REWARD_ROW = {
  id: 12,
  name: '10% Off Voucher',
  cost: 500,
  stock: 100,
  is_active: true,
};

const LEADERBOARD_ROW = {
  rank: 1,
  user_id: 42,
  display_name: 'Alice S.',
  points: 4200,
};

const DROP_ROW = {
  id: 1,
  title: 'Genesis Drop',
  amount: 100,
  merkle_root: null,
  expires_at: '2025-12-31T23:59:59Z',
};

const TRANSACTION_ROW = {
  id: 101,
  tx_hash: 'a1b2c3d4e5f6',
  tx_type: 'distribution',
  amount: 50,
  from_wallet: 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN',
  to_wallet: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
  stellar_ledger: 48293847,
  created_at: new Date().toISOString(),
};

const MERCHANT_TOTAL_ROW = {
  merchant_id: 7,
  total_amount: 1500,
  transaction_count: 30,
};

// ── State handlers ─────────────────────────────────────────────────────────

const stateHandlers = {
  /**
   * A registered user exists in the database.
   * Used by: auth login (valid), auth register (duplicate), transactions,
   *          rewards, admin (non-admin), users profile.
   */
  'a registered user exists': async () => {
    if (query && typeof query.mockResolvedValue === 'function') {
      // Mock: user lookup returns the user row
      query.mockResolvedValue({ rows: [USER_ROW], rowCount: 1 });
    }
  },

  /**
   * No user with the given email exists yet.
   * Used by: auth register (valid new user).
   */
  'no existing user with this email': async () => {
    if (query && typeof query.mockResolvedValue === 'function') {
      // First call: check for duplicate → empty; second call: insert → new row
      query
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        .mockResolvedValueOnce({
          rows: [{
            id: 99,
            email: 'bob@example.com',
            first_name: 'Bob',
            last_name: 'Jones',
            role: 'user',
            created_at: new Date().toISOString(),
          }],
          rowCount: 1,
        });
    }
  },

  /**
   * Merchant campaigns exist in the database.
   * Used by: campaigns list, campaigns by merchantId, transactions.
   */
  'merchant campaigns exist': async () => {
    if (query && typeof query.mockResolvedValue === 'function') {
      query.mockResolvedValue({ rows: [CAMPAIGN_ROW], rowCount: 1 });
    }
  },

  /**
   * No campaigns exist for merchant 9999.
   * Used by: campaigns by unknown merchantId → 404.
   */
  'no campaigns exist for merchant 9999': async () => {
    if (query && typeof query.mockResolvedValue === 'function') {
      query.mockResolvedValue({ rows: [], rowCount: 0 });
    }
  },

  /**
   * Rewards are available in the database.
   * Used by: rewards list, rewards by id.
   */
  'rewards are available': async () => {
    if (query && typeof query.mockResolvedValue === 'function') {
      query.mockResolvedValue({ rows: [REWARD_ROW], rowCount: 1 });
    }
  },

  /**
   * An admin user is authenticated.
   * Used by: admin stats, admin users list, admin create reward.
   * The verifier injects req.user via the state handler endpoint;
   * here we ensure the DB returns admin-appropriate data.
   */
  'admin user is authenticated': async () => {
    if (query && typeof query.mockResolvedValue === 'function') {
      query.mockResolvedValue({ rows: [ADMIN_USER_ROW], rowCount: 1 });
    }
  },

  /**
   * Leaderboard entries exist in the database.
   * Used by: leaderboard list.
   */
  'leaderboard entries exist': async () => {
    if (query && typeof query.mockResolvedValue === 'function') {
      query.mockResolvedValue({ rows: [LEADERBOARD_ROW], rowCount: 1 });
    }
  },

  /**
   * An active drop is available for claiming.
   * Used by: drops list, drops claim (valid).
   */
  'a drop is available': async () => {
    if (query && typeof query.mockResolvedValue === 'function') {
      query.mockResolvedValue({ rows: [DROP_ROW], rowCount: 1 });
    }
  },

  /**
   * No active drops exist (all expired or invalid).
   * Used by: drops claim with expired/invalid drop → 400.
   */
  'no active drops exist': async () => {
    if (query && typeof query.mockResolvedValue === 'function') {
      query.mockResolvedValue({ rows: [], rowCount: 0 });
    }
  },

  /**
   * A user profile with referral info exists.
   * Used by: users profile, users referral.
   */
  'user profile exists': async () => {
    if (query && typeof query.mockResolvedValue === 'function') {
      query.mockResolvedValue({
        rows: [{
          ...USER_ROW,
          referral_code: 'ALICE123',
          referral_count: 5,
          referral_points_earned: 250,
        }],
        rowCount: 1,
      });
    }
  },

  /**
   * Merchant transactions exist in the database.
   * Used by: transactions merchant-totals.
   */
  'merchant transactions exist': async () => {
    if (query && typeof query.mockResolvedValue === 'function') {
      query.mockResolvedValue({ rows: [MERCHANT_TOTAL_ROW], rowCount: 1 });
    }
  },
};

module.exports = stateHandlers;
