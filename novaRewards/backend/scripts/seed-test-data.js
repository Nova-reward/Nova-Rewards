/**
 * seed-test-data.js — Generate deterministic test data for E2E tests.
 *
 * This script runs in CI/Docker to pre-populate the test database with:
 * - Test merchant accounts (for reference, though tests create their own)
 * - Sample campaigns (optional, for seeding)
 * - Known wallet addresses (for deterministic testing)
 *
 * Run in:
 *   - GitHub Actions (before E2E tests)
 *   - Docker (optional, for manual E2E testing in containers)
 *
 * NOTE: E2E tests use RUN_SUFFIX to create unique merchants/campaigns per run,
 * so this script is primarily for reference. It's safe to skip if tests handle
 * all setup internally.
 *
 * Environment Requirements:
 *   DATABASE_URL=postgresql://nova:changeme@localhost:5432/nova_rewards
 *   NODE_ENV=test
 */

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://nova:changeme@localhost:5432/nova_rewards',
});

/**
 * Test data: Well-known Stellar addresses used across E2E tests.
 * These should match the fixtures in frontend/e2e/fixtures/merchants.js
 */
const TEST_DATA = {
  merchants: [
    {
      name: 'E2E Test Merchant - Primary',
      wallet_address: 'GCKFBEIYTKP5RCTLBMTPHBGO7NUWI6SNAJH5OVHQZAQHNOMZQR3ATYP',
      business_category: 'E2E Testing',
      api_key: 'a'.repeat(32), // Deterministic key for reference (won't be used; tests get real keys)
    },
    {
      name: 'E2E Test Merchant - Secondary',
      wallet_address: 'GBZXN7PIRZGNMHGA7MUSC7SHJFPAY2MMNVFQ4YGPHDGNDUNVCM65LLE',
      business_category: 'E2E Testing',
      api_key: 'b'.repeat(32),
    },
  ],
  customers: [
    {
      wallet_address: 'GDQGIY5T5QULPD7V54LJODKC5CMKPNGTWVEMYBQH4LV6STKI6IGO543K',
      description: 'E2E Test Customer 1',
    },
    {
      wallet_address: 'GBYH7EWH63C7RVGVNFGXPXJCCCTUWVPCZZWJSYPSBFWKDJWZFTC5XSBM',
      description: 'E2E Test Customer 2',
    },
    {
      wallet_address: 'GAWVKFXVNUMKL3YXHM2KKDQVMIWVT5LTSALP3XYQMZ7KQSGDLZ4VBZD',
      description: 'E2E Test Customer 3',
    },
  ],
};

async function seedTestData() {
  const client = await pool.connect();

  try {
    console.log('[seed-test-data] Starting database seeding...');

    // NOTE: E2E tests create their own merchants with unique RUN_SUFFIX names,
    // so we don't insert merchants here. This script is provided as a reference.
    // If you want to pre-populate merchants for manual testing, uncomment below:

    /*
    // Insert test merchants (optional)
    console.log('[seed-test-data] Inserting test merchants...');
    for (const merchant of TEST_DATA.merchants) {
      try {
        await client.query(
          `INSERT INTO merchants (name, wallet_address, business_category, api_key)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (wallet_address) DO NOTHING`,
          [merchant.name, merchant.wallet_address, merchant.business_category, merchant.api_key]
        );
        console.log(`  ✓ ${merchant.name}`);
      } catch (err) {
        if (err.code === '23505') { // Unique violation
          console.log(`  ⊘ ${merchant.name} (already exists, skipping)`);
        } else {
          throw err;
        }
      }
    }
    */

    // Log test wallet addresses for reference
    console.log('[seed-test-data] Test wallet addresses (from fixtures):');
    console.log(`  Merchant 1: ${TEST_DATA.merchants[0].wallet_address}`);
    console.log(`  Merchant 2: ${TEST_DATA.merchants[1].wallet_address}`);
    TEST_DATA.customers.forEach((cust, i) => {
      console.log(`  Customer ${i + 1}: ${cust.wallet_address}`);
    });

    // Verify database connectivity
    const result = await client.query('SELECT COUNT(*) FROM merchants');
    console.log(`[seed-test-data] Database connected. Current merchants: ${result.rows[0].count}`);

    console.log('[seed-test-data] ✓ Seeding complete');
    process.exit(0);
  } catch (err) {
    console.error('[seed-test-data] ✗ Error:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seedTestData().catch((err) => {
  console.error('[seed-test-data] Fatal error:', err);
  process.exit(1);
});
