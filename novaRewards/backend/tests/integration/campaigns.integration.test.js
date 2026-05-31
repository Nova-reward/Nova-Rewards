'use strict';

/**
 * Integration tests: /api/campaigns
 *
 * Auth: merchant API key (x-api-key header).
 * Soroban calls are stubbed — we test DB persistence and HTTP semantics.
 */

jest.mock('../../middleware/validateEnv', () => ({ validateEnv: jest.fn() }));
jest.mock('../../../blockchain/stellarService', () => ({
  isValidStellarAddress: jest.fn().mockReturnValue(true),
  getNOVABalance: jest.fn().mockResolvedValue('0'),
}));
jest.mock('../../../blockchain/sendRewards', () => ({ distributeRewards: jest.fn() }));
jest.mock('../../../blockchain/trustline', () => ({ verifyTrustline: jest.fn().mockResolvedValue({ exists: true }) }));
jest.mock('../../services/emailService', () => ({ sendWelcome: jest.fn().mockResolvedValue(true) }));
jest.mock('../../routes/rewards', () => require('express').Router());
jest.mock('../../routes/transactions', () => require('express').Router());
jest.mock('../../lib/redis', () => ({
  client: { isOpen: false, on: jest.fn() },
  connectRedis: jest.fn().mockResolvedValue(undefined),
}));

// Stub Soroban — returns deterministic fake on-chain data
jest.mock('../../services/sorobanService', () => ({
  registerCampaign: jest.fn().mockResolvedValue({
    txHash: 'fake-tx-hash',
    contractCampaignId: 'fake-contract-id',
  }),
  updateCampaign: jest.fn().mockResolvedValue({ txHash: 'fake-update-tx' }),
  pauseCampaign: jest.fn().mockResolvedValue({ txHash: 'fake-pause-tx' }),
}));

const request = require('supertest');
const app = require('../../server');
const { resetDb, seedDb, closePool } = require('./helpers/db');

let merchant;
let otherMerchant;
let campaign;

beforeAll(async () => {
  await resetDb();
  ({ merchant, campaign } = await seedDb());

  // Second merchant for cross-merchant authz tests
  const { getPool } = require('./helpers/db');
  const db = getPool();
  const res = await db.query(`
    INSERT INTO merchants (name, wallet_address, api_key)
    VALUES ('Other Merchant', 'GTEST000000000000000000000000000000000000000000000000000099', 'other-api-key')
    RETURNING *
  `);
  otherMerchant = res.rows[0];
});

afterAll(async () => {
  await closePool();
});

const API_KEY = 'test-api-key-integration';
const OTHER_KEY = 'other-api-key';

const VALID_CAMPAIGN = {
  name: 'New Campaign',
  rewardRate: 2.0,
  startDate: '2026-01-01',
  endDate: '2026-12-31',
};

// ── POST /api/campaigns ───────────────────────────────────────────────────

describe('POST /api/campaigns', () => {
  it('201 — creates campaign and returns confirmed data', async () => {
    const res = await request(app)
      .post('/api/campaigns')
      .set('x-api-key', API_KEY)
      .send(VALID_CAMPAIGN);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('New Campaign');
    expect(res.body.data.on_chain_status).toBe('confirmed');
  });

  it('401 — missing API key', async () => {
    const res = await request(app).post('/api/campaigns').send(VALID_CAMPAIGN);
    expect(res.status).toBe(401);
  });

  it('401 — invalid API key', async () => {
    const res = await request(app)
      .post('/api/campaigns')
      .set('x-api-key', 'bad-key')
      .send(VALID_CAMPAIGN);
    expect(res.status).toBe(401);
  });

  it('400 — missing name', async () => {
    const res = await request(app)
      .post('/api/campaigns')
      .set('x-api-key', API_KEY)
      .send({ rewardRate: 1.0, startDate: '2026-01-01', endDate: '2026-12-31' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_error');
  });

  it('400 — end date before start date', async () => {
    const res = await request(app)
      .post('/api/campaigns')
      .set('x-api-key', API_KEY)
      .send({ name: 'Bad', rewardRate: 1.0, startDate: '2026-12-31', endDate: '2026-01-01' });
    expect(res.status).toBe(400);
  });

  it('502 — Soroban failure rolls back to failed status', async () => {
    const soroban = require('../../services/sorobanService');
    soroban.registerCampaign.mockRejectedValueOnce(new Error('chain down'));

    const res = await request(app)
      .post('/api/campaigns')
      .set('x-api-key', API_KEY)
      .send({ ...VALID_CAMPAIGN, name: 'Chain Fail Campaign' });

    expect(res.status).toBe(502);
    expect(res.body.error).toBe('chain_error');
  });
});

// ── GET /api/campaigns/:id ────────────────────────────────────────────────

describe('GET /api/campaigns/:id', () => {
  it('200 — returns own campaign', async () => {
    const res = await request(app)
      .get(`/api/campaigns/${campaign.id}`)
      .set('x-api-key', API_KEY);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(campaign.id);
  });

  it('403 — cannot read another merchant\'s campaign', async () => {
    const res = await request(app)
      .get(`/api/campaigns/${campaign.id}`)
      .set('x-api-key', OTHER_KEY);

    expect(res.status).toBe(403);
  });

  it('404 — non-existent campaign', async () => {
    const res = await request(app)
      .get('/api/campaigns/999999')
      .set('x-api-key', API_KEY);

    expect(res.status).toBe(404);
  });

  it('400 — invalid id', async () => {
    const res = await request(app)
      .get('/api/campaigns/abc')
      .set('x-api-key', API_KEY);

    expect(res.status).toBe(400);
  });
});

// ── GET /api/campaigns ────────────────────────────────────────────────────

describe('GET /api/campaigns', () => {
  it('200 — returns only own campaigns', async () => {
    const res = await request(app)
      .get('/api/campaigns')
      .set('x-api-key', API_KEY);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    res.body.data.forEach(c => expect(c.merchant_id).toBe(merchant.id));
  });

  it('401 — no API key', async () => {
    const res = await request(app).get('/api/campaigns');
    expect(res.status).toBe(401);
  });
});

// ── PATCH /api/campaigns/:id ──────────────────────────────────────────────

describe('PATCH /api/campaigns/:id', () => {
  it('200 — updates name', async () => {
    const res = await request(app)
      .patch(`/api/campaigns/${campaign.id}`)
      .set('x-api-key', API_KEY)
      .send({ name: 'Updated Name' });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Updated Name');
  });

  it('403 — cannot update another merchant\'s campaign', async () => {
    const res = await request(app)
      .patch(`/api/campaigns/${campaign.id}`)
      .set('x-api-key', OTHER_KEY)
      .send({ name: 'Hijack' });

    expect(res.status).toBe(403);
  });

  it('400 — no fields provided', async () => {
    const res = await request(app)
      .patch(`/api/campaigns/${campaign.id}`)
      .set('x-api-key', API_KEY)
      .send({});

    expect(res.status).toBe(400);
  });
});

// ── DELETE /api/campaigns/:id ─────────────────────────────────────────────

describe('DELETE /api/campaigns/:id', () => {
  it('200 — soft-deletes own campaign', async () => {
    // Create a fresh campaign to delete
    const soroban = require('../../services/sorobanService');
    soroban.registerCampaign.mockResolvedValueOnce({
      txHash: 'del-tx',
      contractCampaignId: 'del-contract-id',
    });

    const created = await request(app)
      .post('/api/campaigns')
      .set('x-api-key', API_KEY)
      .send({ ...VALID_CAMPAIGN, name: 'To Delete' });

    const id = created.body.data.id;

    const res = await request(app)
      .delete(`/api/campaigns/${id}`)
      .set('x-api-key', API_KEY);

    expect(res.status).toBe(200);
    expect(res.body.data.deleted).toBe(true);
  });

  it('403 — cannot delete another merchant\'s campaign', async () => {
    const res = await request(app)
      .delete(`/api/campaigns/${campaign.id}`)
      .set('x-api-key', OTHER_KEY);

    expect(res.status).toBe(403);
  });
});
