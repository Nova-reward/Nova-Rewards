'use strict';

/**
 * Integration test DB helper.
 *
 * Provides:
 *  - getPool()   — shared pg.Pool connected to the test database
 *  - resetDb()   — truncates all tables and resets sequences between suites
 *  - seedDb()    — inserts baseline fixtures (merchant, users, rewards)
 *  - closePool() — tears down the pool after all tests
 *
 * The DATABASE_URL env var must point to a real PostgreSQL test database.
 * In CI this is provided by the postgres service container.
 * Locally: docker-compose -f docker-compose.test.yml up -d
 */

const { Pool } = require('pg');

let pool;

function getPool() {
  if (!pool) {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
  }
  return pool;
}

/**
 * Truncate all application tables in dependency order and restart sequences.
 * Called in beforeEach / beforeAll of each integration suite.
 */
async function resetDb() {
  const db = getPool();
  await db.query(`
    TRUNCATE TABLE
      redemptions,
      point_transactions,
      rewards,
      transactions,
      campaigns,
      users,
      merchants
    RESTART IDENTITY CASCADE
  `);
}

/**
 * Seed baseline fixtures required by most test suites.
 * Returns the created rows so tests can reference their IDs.
 */
async function seedDb() {
  const db = getPool();

  // Merchant
  const merchantRes = await db.query(`
    INSERT INTO merchants (name, wallet_address, api_key)
    VALUES ('Test Merchant', 'GTEST000000000000000000000000000000000000000000000000000001', 'test-api-key-integration')
    RETURNING *
  `);
  const merchant = merchantRes.rows[0];

  // Regular user
  const bcrypt = require('bcryptjs');
  const hash = await bcrypt.hash('Password1!', 4); // low rounds for speed
  const userRes = await db.query(`
    INSERT INTO users (email, password_hash, first_name, last_name, role)
    VALUES ('user@example.com', $1, 'Test', 'User', 'user')
    RETURNING *
  `, [hash]);
  const user = userRes.rows[0];

  // Admin user
  const adminHash = await bcrypt.hash('AdminPass1!', 4);
  const adminRes = await db.query(`
    INSERT INTO users (email, password_hash, first_name, last_name, role)
    VALUES ('admin@example.com', $1, 'Admin', 'User', 'admin')
    RETURNING *
  `, [adminHash]);
  const admin = adminRes.rows[0];

  // Reward
  const rewardRes = await db.query(`
    INSERT INTO rewards (name, cost, stock, is_active)
    VALUES ('Test Reward', 100, 10, TRUE)
    RETURNING *
  `);
  const reward = rewardRes.rows[0];

  // Campaign (confirmed on-chain so routes that check contract_campaign_id work)
  const campaignRes = await db.query(`
    INSERT INTO campaigns (merchant_id, name, reward_rate, start_date, end_date, on_chain_status, contract_campaign_id, tx_hash)
    VALUES ($1, 'Test Campaign', 1.5, CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days', 'confirmed', 'contract-camp-1', 'tx-hash-1')
    RETURNING *
  `, [merchant.id]);
  const campaign = campaignRes.rows[0];

  return { merchant, user, admin, reward, campaign };
}

async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

module.exports = { getPool, resetDb, seedDb, closePool };
