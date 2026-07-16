#!/usr/bin/env node

/**
 * Seed Test Data Script
 * 
 * Prepares the database with test data for E2E testing.
 * Includes test merchant accounts, users, and initial balances.
 * 
 * Usage:
 *   node scripts/seed-test-data.js
 *   npm run seed:test
 * 
 * Environment variables:
 *   - DB_HOST: Database host (default: localhost)
 *   - DB_PORT: Database port (default: 5432)
 *   - DB_NAME: Database name (default: nova_rewards_test)
 *   - DB_USER: Database user (default: postgres)
 *   - DB_PASSWORD: Database password
 */

const crypto = require('crypto');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: '.env.testnet' });
dotenv.config({ path: '.env.local' });
dotenv.config();

// Database configuration
const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'nova_rewards_test',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
};

// Test data constants
const TEST_MERCHANT_EMAIL = `merchant-test-${Date.now()}@test.nova-rewards.com`;
const TEST_MERCHANT_PASSWORD_HASH = hashPassword('Test@123456789');
const TEST_USER_WALLET = process.env.TESTNET_USER_WALLET || 'GBRPYHIL2CI3WHSCULVRJC3P4ABWOY4XHALUKYAPXL73MRLN42HDA5O';
const INITIAL_BALANCE = 1000;

/**
 * Simple password hashing (should use bcrypt in production)
 */
function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

/**
 * Create database connection pool
 */
function createPool() {
  try {
    const { Pool } = require('pg');
    return new Pool(DB_CONFIG);
  } catch (error) {
    console.error('❌ Failed to load pg module. Install with: npm install pg');
    process.exit(1);
  }
}

/**
 * Create test merchant
 */
async function createTestMerchant(pool) {
  console.log('📝 Creating test merchant account...');
  
  try {
    const result = await pool.query(
      `INSERT INTO merchants (email, password_hash, business_name, business_registration, api_key, stellar_issuer_account, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (email) DO NOTHING
       RETURNING id, email, api_key`,
      [
        TEST_MERCHANT_EMAIL,
        TEST_MERCHANT_PASSWORD_HASH,
        `Test Business ${Date.now()}`,
        'REG-TEST-12345',
        crypto.randomBytes(16).toString('hex'),
        process.env.TESTNET_ISSUER_PUBLIC || 'GDQOE23CFSUMSVQK4Y5R3ZARVIVTD4XVXUUJX3SP27YMGNXC2OGXJVM',
        true,
      ]
    );
    
    if (result.rows.length > 0) {
      const merchant = result.rows[0];
      console.log(`✅ Test merchant created: ${merchant.email}`);
      console.log(`   Merchant ID: ${merchant.id}`);
      console.log(`   API Key: ${merchant.api_key}`);
      return merchant;
    } else {
      console.log('⚠️ Test merchant already exists');
      const existing = await pool.query('SELECT id, email, api_key FROM merchants WHERE email = $1', [TEST_MERCHANT_EMAIL]);
      return existing.rows[0];
    }
  } catch (error) {
    console.error('❌ Failed to create merchant:', error.message);
    throw error;
  }
}

/**
 * Create test user
 */
async function createTestUser(pool) {
  console.log('👤 Creating test user...');
  
  try {
    const result = await pool.query(
      `INSERT INTO users (wallet_address, display_name, email, is_verified, stellar_account_created)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (wallet_address) DO NOTHING
       RETURNING id, wallet_address`,
      [
        TEST_USER_WALLET,
        `Test User ${Date.now()}`,
        `user-${Date.now()}@test.nova-rewards.com`,
        true,
        true,
      ]
    );
    
    if (result.rows.length > 0) {
      const user = result.rows[0];
      console.log(`✅ Test user created: ${user.wallet_address}`);
      console.log(`   User ID: ${user.id}`);
      return user;
    } else {
      console.log('⚠️ Test user already exists');
      const existing = await pool.query('SELECT id, wallet_address FROM users WHERE wallet_address = $1', [TEST_USER_WALLET]);
      return existing.rows[0];
    }
  } catch (error) {
    console.error('❌ Failed to create user:', error.message);
    throw error;
  }
}

/**
 * Create test campaign
 */
async function createTestCampaign(pool, merchantId) {
  console.log('🎯 Creating test campaign...');
  
  try {
    const campaignName = `E2E Test Campaign ${Date.now()}`;
    const result = await pool.query(
      `INSERT INTO campaigns (merchant_id, name, description, token_type, total_reward_amount, remaining_amount, start_date, end_date, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, name`,
      [
        merchantId,
        campaignName,
        'Automated E2E test campaign for reward issuance flow',
        'REWARD_TOKEN',
        5000,
        5000,
        new Date(),
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        'active',
      ]
    );
    
    const campaign = result.rows[0];
    console.log(`✅ Test campaign created: ${campaign.name}`);
    console.log(`   Campaign ID: ${campaign.id}`);
    return campaign;
  } catch (error) {
    console.error('❌ Failed to create campaign:', error.message);
    throw error;
  }
}

/**
 * Create test reward
 */
async function createTestReward(pool, campaignId, userId, merchantId) {
  console.log('💝 Creating test reward...');
  
  try {
    const result = await pool.query(
      `INSERT INTO rewards (campaign_id, user_id, merchant_id, amount, reward_type, status, issued_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, amount`,
      [
        campaignId,
        userId,
        merchantId,
        100,
        'ISSUED',
        'completed',
        new Date(),
      ]
    );
    
    const reward = result.rows[0];
    console.log(`✅ Test reward created: ${reward.amount} tokens`);
    console.log(`   Reward ID: ${reward.id}`);
    return reward;
  } catch (error) {
    console.error('❌ Failed to create reward:', error.message);
    throw error;
  }
}

/**
 * Initialize user balance
 */
async function initializeUserBalance(pool, userId) {
  console.log('💰 Initializing user balance...');
  
  try {
    // Check if balance exists
    const existing = await pool.query('SELECT id FROM user_balances WHERE user_id = $1', [userId]);
    
    if (existing.rows.length === 0) {
      await pool.query(
        `INSERT INTO user_balances (user_id, balance, last_updated)
         VALUES ($1, $2, $3)`,
        [userId, INITIAL_BALANCE, new Date()]
      );
      console.log(`✅ User balance initialized: ${INITIAL_BALANCE} tokens`);
    } else {
      console.log(`⚠️ User balance already exists`);
    }
  } catch (error) {
    console.error('❌ Failed to initialize balance:', error.message);
    // Don't throw - this table may not exist
  }
}

/**
 * Main seeding function
 */
async function seed() {
  console.log('🌱 Starting test data seeding...\n');
  
  const pool = createPool();
  
  try {
    // Create test merchant
    const merchant = await createTestMerchant(pool);
    
    // Create test user
    const user = await createTestUser(pool);
    
    // Create test campaign
    const campaign = await createTestCampaign(pool, merchant.id);
    
    // Create test reward
    await createTestReward(pool, campaign.id, user.id, merchant.id);
    
    // Initialize user balance
    await initializeUserBalance(pool, user.id);
    
    console.log('\n✅ Test data seeding completed successfully!\n');
    console.log('📋 Test Data Summary:');
    console.log(`   Merchant Email: ${TEST_MERCHANT_EMAIL}`);
    console.log(`   Merchant Password: Test@123456789`);
    console.log(`   Merchant API Key: ${merchant.api_key}`);
    console.log(`   Test User Wallet: ${TEST_USER_WALLET}`);
    console.log(`   Campaign ID: ${campaign.id}`);
    console.log(`   Initial Balance: ${INITIAL_BALANCE} tokens\n`);
    
    console.log('🚀 Ready to run E2E tests!\n');
    
  } catch (error) {
    console.error('\n❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run seeding
if (require.main === module) {
  seed().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { seed, createTestMerchant, createTestUser, createTestCampaign };
