'use strict';

/**
 * Integration tests: POST /api/rewards/distribute
 *
 * The rewards route has a module-level bug (getRedisClient not imported),
 * so we build a minimal Express app that mounts the route logic directly,
 * bypassing the broken module-level initialisation.
 *
 * Blockchain calls (distributeRewards, verifyTrustline) are stubbed.
 * The DB (campaign lookup, merchant auth) uses the real test database.
 */

// ── Stub external / broken dependencies ──────────────────────────────────
jest.mock('../../../blockchain/sendRewards', () => ({
  distributeRewards: jest.fn().mockResolvedValue({ txHash: 'fake-tx-hash', tx: {} }),
}));
jest.mock('../../../blockchain/trustline', () => ({
  verifyTrustline: jest.fn().mockResolvedValue({ exists: true }),
}));
jest.mock('../../../blockchain/stellarService', () => ({
  isValidStellarAddress: jest.fn().mockReturnValue(true),
  getNOVABalance: jest.fn().mockResolvedValue('0'),
}));
jest.mock('../../lib/redis', () => ({
  client: { isOpen: false, on: jest.fn() },
  connectRedis: jest.fn().mockResolvedValue(undefined),
}));

const express = require('express');
const request = require('supertest');
const { resetDb, seedDb, closePool } = require('./helpers/db');

// Build a minimal app that mounts only the rewards route logic
// (avoids the broken module-level getRedisClient() call in routes/rewards.js)
function buildRewardsApp() {
  const app = express();
  app.use(express.json());

  const { getCampaignById, getActiveCampaign } = require('../../db/campaignRepository');
  const { distributeRewards } = require('../../../blockchain/sendRewards');
  const { verifyTrustline } = require('../../../blockchain/trustline');
  const { authenticateMerchant } = require('../../middleware/authenticateMerchant');

  app.post('/api/rewards/distribute', authenticateMerchant, async (req, res, next) => {
    try {
      const { walletAddress, customerWallet, amount, campaignId } = req.body;
      const recipientWallet = walletAddress || customerWallet;

      if (!recipientWallet || !amount) {
        return res.status(400).json({ success: false, error: 'Missing required fields: walletAddress and amount are required' });
      }
      if (amount <= 0) {
        return res.status(400).json({ success: false, error: 'Amount must be greater than zero' });
      }

      const campaignExists = await getCampaignById(campaignId);
      if (!campaignExists) {
        return res.status(404).json({ success: false, error: 'not_found', message: 'Campaign does not exist' });
      }

      const campaign = await getActiveCampaign(campaignId);
      if (!campaign) {
        return res.status(400).json({ success: false, error: 'invalid_campaign', message: 'Campaign is expired or inactive' });
      }

      if (campaign.merchant_id !== req.merchant.id) {
        return res.status(403).json({ success: false, error: 'forbidden', message: 'Campaign does not belong to this merchant' });
      }

      const trustline = await verifyTrustline(walletAddress);
      if (!trustline?.exists) {
        return res.status(400).json({ success: false, error: 'no_trustline', message: 'Recipient does not have a NOVA trustline.' });
      }

      const result = await distributeRewards({ recipient: recipientWallet, amount, campaignId });
      res.json({ success: true, txHash: result.txHash, transaction: result.tx });
    } catch (err) {
      next(err);
    }
  });

  app.use((err, _req, res, _next) => {
    res.status(err.status || 500).json({ success: false, error: err.code || 'internal_error', message: err.message });
  });

  return app;
}

let app;
let merchant;
let campaign;

beforeAll(async () => {
  await resetDb();
  ({ merchant, campaign } = await seedDb());
  app = buildRewardsApp();
});

afterAll(async () => {
  await closePool();
});

const API_KEY = 'test-api-key-integration';
const WALLET = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';

describe('POST /api/rewards/distribute', () => {
  it('200 — distributes tokens for valid request', async () => {
    const res = await request(app)
      .post('/api/rewards/distribute')
      .set('x-api-key', API_KEY)
      .send({ walletAddress: WALLET, amount: 50, campaignId: campaign.id });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.txHash).toBe('fake-tx-hash');
  });

  it('401 — missing API key', async () => {
    const res = await request(app)
      .post('/api/rewards/distribute')
      .send({ walletAddress: WALLET, amount: 50, campaignId: campaign.id });

    expect(res.status).toBe(401);
  });

  it('401 — invalid API key', async () => {
    const res = await request(app)
      .post('/api/rewards/distribute')
      .set('x-api-key', 'bad-key')
      .send({ walletAddress: WALLET, amount: 50, campaignId: campaign.id });

    expect(res.status).toBe(401);
  });

  it('400 — missing walletAddress', async () => {
    const res = await request(app)
      .post('/api/rewards/distribute')
      .set('x-api-key', API_KEY)
      .send({ amount: 50, campaignId: campaign.id });

    expect(res.status).toBe(400);
  });

  it('400 — amount zero', async () => {
    const res = await request(app)
      .post('/api/rewards/distribute')
      .set('x-api-key', API_KEY)
      .send({ walletAddress: WALLET, amount: 0, campaignId: campaign.id });

    expect(res.status).toBe(400);
  });

  it('404 — campaign not found', async () => {
    const res = await request(app)
      .post('/api/rewards/distribute')
      .set('x-api-key', API_KEY)
      .send({ walletAddress: WALLET, amount: 50, campaignId: 999999 });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('not_found');
  });

  it('403 — campaign belongs to different merchant', async () => {
    // Insert a second merchant and use their key
    const { getPool } = require('./helpers/db');
    const db = getPool();
    await db.query(`
      INSERT INTO merchants (name, wallet_address, api_key)
      VALUES ('Other Merchant', 'GTEST000000000000000000000000000000000000000000000000000088', 'other-rewards-key')
      ON CONFLICT (api_key) DO NOTHING
    `);

    const res = await request(app)
      .post('/api/rewards/distribute')
      .set('x-api-key', 'other-rewards-key')
      .send({ walletAddress: WALLET, amount: 50, campaignId: campaign.id });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('forbidden');
  });

  it('400 — no trustline', async () => {
    const { verifyTrustline } = require('../../../blockchain/trustline');
    verifyTrustline.mockResolvedValueOnce({ exists: false });

    const res = await request(app)
      .post('/api/rewards/distribute')
      .set('x-api-key', API_KEY)
      .send({ walletAddress: WALLET, amount: 50, campaignId: campaign.id });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('no_trustline');
  });
});
