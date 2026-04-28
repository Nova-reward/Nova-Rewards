/**
 * Load-test seed script
 *
 * Creates the minimum DB fixtures required by the k6 load tests:
 *   - 100 users (IDs 1–100) with point balances
 *   - 3 merchants with known API keys
 *   - 1 campaign per merchant
 *
 * Run once before starting the backend:
 *   node tests/load/seed.js
 *
 * Environment variables (inherits from process.env / .env.test):
 *   DATABASE_URL  — PostgreSQL connection string
 *   JWT_SECRET    — used to mint load-test user tokens
 *
 * Outputs:
 *   LOAD_TEST_USER_TOKEN   — printed to stdout for use in k6 -e USER_TOKEN=...
 *   LOAD_TEST_MERCHANT_KEYS — printed to stdout for use in k6 -e MERCHANT_API_KEYS=...
 */

'use strict';

require('dotenv').config({ path: '.env.test' });

const { Pool } = require('pg');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const JWT_SECRET = process.env.JWT_SECRET || 'ci-load-test-secret';

// Deterministic API keys for CI reproducibility
const MERCHANT_API_KEYS = [
  'load-test-merchant-key-1',
  'load-test-merchant-key-2',
  'load-test-merchant-key-3',
];

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ── Users ──────────────────────────────────────────────────────────────
    for (let i = 1; i <= 100; i++) {
      await client.query(
        `INSERT INTO users (id, email, first_name, last_name, role, is_deleted, created_at, updated_at)
         VALUES ($1, $2, $3, $4, 'user', FALSE, NOW(), NOW())
         ON CONFLICT (id) DO NOTHING`,
        [i, `loadtest-user-${i}@example.com`, `Load`, `User${i}`],
      );

      // Give each user a point balance
      await client.query(
        `INSERT INTO point_transactions (user_id, points, type, description, created_at)
         VALUES ($1, 1000, 'credit', 'load-test seed', NOW())
         ON CONFLICT DO NOTHING`,
        [i],
      );
    }

    // ── Merchants ──────────────────────────────────────────────────────────
    const merchantIds = [];
    for (let i = 0; i < MERCHANT_API_KEYS.length; i++) {
      const apiKey = MERCHANT_API_KEYS[i];
      const apiKeyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

      const result = await client.query(
        `INSERT INTO merchants (name, api_key_hash, is_active, created_at, updated_at)
         VALUES ($1, $2, TRUE, NOW(), NOW())
         ON CONFLICT (api_key_hash) DO UPDATE SET name = EXCLUDED.name
         RETURNING id`,
        [`Load Test Merchant ${i + 1}`, apiKeyHash],
      );
      merchantIds.push(result.rows[0].id);
    }

    // ── Campaigns ──────────────────────────────────────────────────────────
    for (const merchantId of merchantIds) {
      await client.query(
        `INSERT INTO campaigns (merchant_id, name, reward_rate, start_date, end_date, on_chain_status, created_at, updated_at)
         VALUES ($1, $2, 0.05, NOW() - INTERVAL '1 day', NOW() + INTERVAL '30 days', 'confirmed', NOW(), NOW())
         ON CONFLICT DO NOTHING`,
        [merchantId, `Load Test Campaign (merchant ${merchantId})`],
      );
    }

    await client.query('COMMIT');

    // ── Mint a long-lived admin JWT for the balance endpoint ───────────────
    const adminToken = jwt.sign(
      { userId: 1, role: 'admin' },
      JWT_SECRET,
      { expiresIn: '2h' },
    );

    console.log('\n✅ Load-test seed complete.\n');
    console.log('Export these before running k6:\n');
    console.log(`  export LOAD_TEST_USER_TOKEN="${adminToken}"`);
    console.log(`  export LOAD_TEST_MERCHANT_KEYS="${MERCHANT_API_KEYS.join(',')}"`);
    console.log('');

    // Also write to a file so CI can source them
    const fs = require('fs');
    fs.writeFileSync(
      'test-results/load/seed-env.sh',
      [
        `export LOAD_TEST_USER_TOKEN="${adminToken}"`,
        `export LOAD_TEST_MERCHANT_KEYS="${MERCHANT_API_KEYS.join(',')}"`,
        '',
      ].join('\n'),
    );
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seed failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
