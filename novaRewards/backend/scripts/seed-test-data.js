/**
 * Bulk Seed Script — Nova Rewards
 *
 * Generates realistic test data at scale using batched INSERTs and
 * parallel execution where possible.
 *
 * Usage:
 *   node novaRewards/backend/scripts/seed-test-data.js [--count=N] [--env=test]
 *
 * Options:
 *   --count=N   Number of users to generate (default: 500)
 *   --env=test  Which .env file to load (default: .env.test)
 *   --clean     Truncate seed tables before inserting
 *
 * Performance strategy:
 *   - Single multi-row INSERT per entity type (one round-trip per batch)
 *   - Batch size capped at BATCH_SIZE rows to stay within pg parameter limits
 *   - Merchants and campaigns inserted first; users/wallets/transactions in parallel
 *   - All writes wrapped in a single transaction for atomicity
 */

'use strict';

const path   = require('path');
const crypto = require('crypto');

// ── CLI args ──────────────────────────────────────────────────────────────

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  }),
);

const ENV_FILE  = args.env   ? `.env.${args.env}` : '.env.test';
const USER_COUNT = parseInt(args.count ?? '500', 10);
const CLEAN      = Boolean(args.clean);
const BATCH_SIZE = 200; // rows per INSERT statement

require('dotenv').config({ path: path.resolve(__dirname, '..', ENV_FILE) });

const { Pool } = require('pg');
const { faker } = require('@faker-js/faker');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ── Helpers ───────────────────────────────────────────────────────────────

const stellarAddress = () =>
  'G' + faker.string.alphanumeric({ length: 55, casing: 'upper' });

const isoDate = (d) => d.toISOString().split('T')[0];
const daysAgo   = (n) => new Date(Date.now() - n * 86_400_000);
const daysAhead = (n) => new Date(Date.now() + n * 86_400_000);

/**
 * Build a parameterised multi-row INSERT.
 * Returns { text, values } ready for client.query().
 *
 * @param {string}   table   - table name
 * @param {string[]} cols    - column names
 * @param {Array[]}  rows    - array of value arrays (one per row)
 */
function buildBulkInsert(table, cols, rows) {
  const placeholders = rows.map((_, ri) =>
    `(${cols.map((_, ci) => `$${ri * cols.length + ci + 1}`).join(', ')})`
  );
  return {
    text: `INSERT INTO ${table} (${cols.join(', ')}) VALUES ${placeholders.join(', ')} ON CONFLICT DO NOTHING`,
    values: rows.flat(),
  };
}

/**
 * Execute rows in batches of BATCH_SIZE to avoid exceeding pg's 65535 parameter limit.
 */
async function batchInsert(client, table, cols, rows) {
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { text, values } = buildBulkInsert(table, cols, batch);
    await client.query(text, values);
  }
}

// ── Data generators ───────────────────────────────────────────────────────

function generateMerchants(count = 10) {
  return Array.from({ length: count }, (_, i) => {
    const apiKey = `seed-merchant-key-${i + 1}-${crypto.randomBytes(8).toString('hex')}`;
    return {
      name: faker.company.name(),
      api_key_hash: crypto.createHash('sha256').update(apiKey).digest('hex'),
      wallet_address: stellarAddress(),
      is_active: true,
      _api_key: apiKey, // kept for output only, not inserted
    };
  });
}

function generateCampaigns(merchantIds, perMerchant = 3) {
  return merchantIds.flatMap((merchantId) =>
    Array.from({ length: perMerchant }, () => {
      const isExpired = faker.datatype.boolean({ probability: 0.2 });
      return {
        merchant_id: merchantId,
        name: `${faker.commerce.productName()} Rewards`,
        reward_rate: parseFloat(faker.number.float({ min: 0.01, max: 0.1, fractionDigits: 7 })),
        start_date: isoDate(isExpired ? daysAgo(90) : faker.date.recent({ days: 30 })),
        end_date:   isoDate(isExpired ? daysAgo(1)  : daysAhead(faker.number.int({ min: 7, max: 90 }))),
        is_active: !isExpired,
        on_chain_status: faker.helpers.arrayElement(['confirmed', 'confirmed', 'confirmed', 'pending']),
      };
    })
  );
}

function generateUsers(count) {
  return Array.from({ length: count }, () => ({
    email: faker.internet.email(),
    first_name: faker.person.firstName(),
    last_name: faker.person.lastName(),
    wallet_address: stellarAddress(),
    stellar_public_key: stellarAddress(),
    referral_code: faker.string.alphanumeric({ length: 8, casing: 'upper' }),
    role: faker.helpers.weightedArrayElement([
      { weight: 90, value: 'user' },
      { weight: 8,  value: 'merchant' },
      { weight: 2,  value: 'admin' },
    ]),
    is_deleted: faker.datatype.boolean({ probability: 0.02 }),
  }));
}

function generateWallets(userIds) {
  return userIds.flatMap((userId) => {
    const count = faker.number.int({ min: 1, max: 2 });
    return Array.from({ length: count }, (_, i) => ({
      user_id: userId,
      address: stellarAddress(),
      is_primary: i === 0,
      is_active: true,
    }));
  });
}

function generateTransactions(userIds, campaignIds, merchantIds, count) {
  const types = ['distribution', 'redemption', 'transfer'];
  return Array.from({ length: count }, () => ({
    tx_hash: faker.string.hexadecimal({ length: 64, casing: 'lower' }).replace('0x', ''),
    tx_type: faker.helpers.arrayElement(types),
    amount: parseFloat(faker.number.float({ min: 0.1, max: 1_000, fractionDigits: 7 })),
    from_wallet: stellarAddress(),
    to_wallet: stellarAddress(),
    merchant_id: faker.helpers.arrayElement(merchantIds),
    campaign_id: faker.helpers.arrayElement(campaignIds),
    stellar_ledger: faker.number.int({ min: 1_000_000, max: 50_000_000 }),
    created_at: faker.date.recent({ days: 90 }),
  }));
}

function generateRewards(count = 20) {
  return Array.from({ length: count }, () => ({
    name: faker.commerce.productName(),
    description: faker.commerce.productDescription(),
    cost: faker.number.int({ min: 10, max: 5_000 }),
    stock: faker.number.int({ min: 0, max: 500 }),
    is_active: faker.datatype.boolean({ probability: 0.85 }),
    is_deleted: false,
  }));
}

function generateRewardIssuances(userIds, campaignIds, count) {
  return Array.from({ length: count }, () => {
    const status = faker.helpers.weightedArrayElement([
      { weight: 70, value: 'confirmed' },
      { weight: 20, value: 'pending' },
      { weight: 10, value: 'failed' },
    ]);
    return {
      idempotency_key: faker.string.uuid(),
      user_id: faker.helpers.arrayElement(userIds),
      campaign_id: faker.helpers.arrayElement(campaignIds),
      wallet_address: stellarAddress(),
      amount: parseFloat(faker.number.float({ min: 0.1, max: 500, fractionDigits: 7 })),
      status,
      tx_hash: status !== 'failed'
        ? faker.string.hexadecimal({ length: 64, casing: 'lower' }).replace('0x', '')
        : null,
      error_message: status === 'failed'
        ? faker.helpers.arrayElement(['Insufficient balance', 'Trustline not established', 'Network timeout'])
        : null,
      attempts: status === 'failed' ? 3 : faker.number.int({ min: 0, max: 2 }),
    };
  });
}

// ── Main ──────────────────────────────────────────────────────────────────

async function seed() {
  const client = await pool.connect();
  const t0 = Date.now();

  try {
    if (CLEAN) {
      console.log('🧹 Cleaning seed tables…');
      // Truncate in dependency order (children first)
      await client.query(`
        TRUNCATE reward_issuances, transactions, wallets, rewards,
                 campaigns, users, merchants RESTART IDENTITY CASCADE
      `);
    }

    await client.query('BEGIN');

    // ── Merchants ──────────────────────────────────────────────────────────
    console.log('🏪 Inserting merchants…');
    const merchantData = generateMerchants(10);
    await batchInsert(client, 'merchants',
      ['name', 'api_key_hash', 'wallet_address', 'is_active'],
      merchantData.map((m) => [m.name, m.api_key_hash, m.wallet_address, m.is_active]),
    );
    const { rows: merchantRows } = await client.query(
      `SELECT id FROM merchants WHERE api_key_hash = ANY($1)`,
      [merchantData.map((m) => m.api_key_hash)],
    );
    const merchantIds = merchantRows.map((r) => r.id);

    // ── Campaigns ──────────────────────────────────────────────────────────
    console.log('📣 Inserting campaigns…');
    const campaigns = generateCampaigns(merchantIds, 3);
    await batchInsert(client, 'campaigns',
      ['merchant_id', 'name', 'reward_rate', 'start_date', 'end_date', 'is_active', 'on_chain_status'],
      campaigns.map((c) => [c.merchant_id, c.name, c.reward_rate, c.start_date, c.end_date, c.is_active, c.on_chain_status]),
    );
    const { rows: campaignRows } = await client.query(`SELECT id FROM campaigns`);
    const campaignIds = campaignRows.map((r) => r.id);

    // ── Rewards ────────────────────────────────────────────────────────────
    console.log('🎁 Inserting rewards…');
    const rewards = generateRewards(20);
    await batchInsert(client, 'rewards',
      ['name', 'description', 'cost', 'stock', 'is_active', 'is_deleted'],
      rewards.map((r) => [r.name, r.description, r.cost, r.stock, r.is_active, r.is_deleted]),
    );

    // ── Users ──────────────────────────────────────────────────────────────
    console.log(`👤 Inserting ${USER_COUNT} users…`);
    const users = generateUsers(USER_COUNT);
    await batchInsert(client, 'users',
      ['email', 'first_name', 'last_name', 'wallet_address', 'stellar_public_key', 'referral_code', 'role', 'is_deleted'],
      users.map((u) => [u.email, u.first_name, u.last_name, u.wallet_address, u.stellar_public_key, u.referral_code, u.role, u.is_deleted]),
    );
    const { rows: userRows } = await client.query(`SELECT id FROM users ORDER BY id`);
    const userIds = userRows.map((r) => r.id);

    // ── Wallets ────────────────────────────────────────────────────────────
    console.log('💳 Inserting wallets…');
    const wallets = generateWallets(userIds);
    await batchInsert(client, 'wallets',
      ['user_id', 'address', 'is_primary', 'is_active'],
      wallets.map((w) => [w.user_id, w.address, w.is_primary, w.is_active]),
    );

    // ── Transactions ───────────────────────────────────────────────────────
    const txCount = USER_COUNT * 5;
    console.log(`💸 Inserting ${txCount} transactions…`);
    const transactions = generateTransactions(userIds, campaignIds, merchantIds, txCount);
    await batchInsert(client, 'transactions',
      ['tx_hash', 'tx_type', 'amount', 'from_wallet', 'to_wallet', 'merchant_id', 'campaign_id', 'stellar_ledger', 'created_at'],
      transactions.map((t) => [t.tx_hash, t.tx_type, t.amount, t.from_wallet, t.to_wallet, t.merchant_id, t.campaign_id, t.stellar_ledger, t.created_at]),
    );

    // ── Reward Issuances ───────────────────────────────────────────────────
    const issuanceCount = Math.floor(USER_COUNT * 2);
    console.log(`🏅 Inserting ${issuanceCount} reward issuances…`);
    const issuances = generateRewardIssuances(userIds, campaignIds, issuanceCount);
    await batchInsert(client, 'reward_issuances',
      ['idempotency_key', 'user_id', 'campaign_id', 'wallet_address', 'amount', 'status', 'tx_hash', 'error_message', 'attempts'],
      issuances.map((r) => [r.idempotency_key, r.user_id, r.campaign_id, r.wallet_address, r.amount, r.status, r.tx_hash, r.error_message, r.attempts]),
    );

    await client.query('COMMIT');

    const elapsed = ((Date.now() - t0) / 1000).toFixed(2);
    console.log(`\n✅ Seed complete in ${elapsed}s`);
    console.log(`   Merchants:        ${merchantIds.length}`);
    console.log(`   Campaigns:        ${campaignIds.length}`);
    console.log(`   Users:            ${userIds.length}`);
    console.log(`   Wallets:          ${wallets.length}`);
    console.log(`   Transactions:     ${transactions.length}`);
    console.log(`   Reward issuances: ${issuances.length}`);
    console.log(`   Rewards:          ${rewards.length}`);
    console.log('');
    console.log('Merchant API keys (for manual testing):');
    merchantData.forEach((m, i) => console.log(`  [${i + 1}] ${m._api_key}`));
    console.log('');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Seed failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
