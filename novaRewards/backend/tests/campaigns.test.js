// Tests for campaign CRUD endpoints with Soroban on-chain sync
// Covers: POST /campaigns, GET /campaigns/:id, PATCH /campaigns/:id, DELETE /campaigns/:id
// Acceptance criteria: all four endpoints + on-chain failure rollback

process.env.ISSUER_PUBLIC = 'GDQGIY5T5QULPD7V54LJODKC5CMKPNGTWVEMYBQH4LV6STKI6IGO543K';
process.env.HORIZON_URL = 'https://horizon-testnet.stellar.org';
process.env.STELLAR_NETWORK = 'testnet';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';

const request = require('supertest');

jest.mock('../middleware/validateEnv', () => ({ validateEnv: jest.fn() }));
jest.mock('../services/emailService', () => ({ sendWelcome: jest.fn().mockResolvedValue({ success: true }) }));
jest.mock('../../blockchain/stellarService', () => ({
  server: {},
  NOVA: {},
  isValidStellarAddress: jest.fn().mockReturnValue(true),
  getNOVABalance: jest.fn().mockResolvedValue('1000'),
}));
jest.mock('../../blockchain/sendRewards', () => ({ sendRewards: jest.fn() }));
jest.mock('../../blockchain/issueAsset', () => ({}));
jest.mock('../../blockchain/trustline', () => ({}));
jest.mock('../db/index', () => ({ query: jest.fn(), pool: { query: jest.fn() } }));
jest.mock('../db/merchantRepository', () => ({
  getMerchantByApiKeyHash: jest.fn(),
  getMerchantById: jest.fn(),
  createMerchant: jest.fn(),
  updateMerchant: jest.fn(),
  prisma: { $disconnect: jest.fn() },
}));
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    $use: jest.fn(),
    merchant: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    $disconnect: jest.fn(),
  })),
}));
// Mock routes that pull in Prisma or have module-level bugs
jest.mock('../routes/rewards', () => require('express').Router());
jest.mock('../routes/transactions', () => require('express').Router());
jest.mock('../routes/merchants', () => require('express').Router());
jest.mock('../routes/users', () => require('express').Router());

// ── Mock the entire repository ────────────────────────────────────────────
jest.mock('../db/campaignRepository', () => ({
  validateCampaign: jest.requireActual('../db/campaignRepository').validateCampaign,
  createCampaign: jest.fn(),
  confirmOnChain: jest.fn(),
  markOnChainFailed: jest.fn(),
  getCampaignById: jest.fn(),
  getCampaignsByMerchant: jest.fn(),
  updateCampaign: jest.fn(),
  softDeleteCampaign: jest.fn(),
}));

// ── Mock Soroban service ──────────────────────────────────────────────────
jest.mock('../services/sorobanService', () => ({
  registerCampaign: jest.fn(),
  updateCampaign: jest.fn(),
  pauseCampaign: jest.fn(),
}));

// ── Inject test merchant via middleware mock ──────────────────────────────
jest.mock('../middleware/authenticateMerchant', () => ({
  authenticateMerchant: (req, _res, next) => {
    req.merchant = { id: 1, name: 'Test Merchant', wallet_address: 'GDTEST1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDE' };
    next();
  },
}));

const app = require('../server');
const repo = require('../db/campaignRepository');
const soroban = require('../services/sorobanService');
const stellar = require('../../blockchain/stellarService');

// ── Shared fixtures ───────────────────────────────────────────────────────
const VALID_BODY = {
  name: 'Summer Sale',
  tokenAmount: 500,
  rewardPerAction: 5,
  startDate: '2026-06-01',
  endDate: '2026-08-31',
};

const DB_CAMPAIGN = {
  id: 42,
  merchant_id: 1,
  name: 'Summer Sale',
  reward_rate: '5',
  token_amount: '500',
  reward_per_action: '5',
  start_date: '2026-06-01',
  end_date: '2026-08-31',
  is_active: true,
  on_chain_status: 'pending',
  contract_campaign_id: null,
  tx_hash: null,
  deleted_at: null,
};

const CONFIRMED_CAMPAIGN = {
  ...DB_CAMPAIGN,
  on_chain_status: 'confirmed',
  contract_campaign_id: 'contract-id-abc',
  tx_hash: 'txhash-abc',
};

beforeEach(() => jest.clearAllMocks());

// ============================================================================
// POST /api/campaigns
// ============================================================================
describe('POST /api/campaigns', () => {
  test('201 — creates campaign in DB and registers on-chain', async () => {
    stellar.getNOVABalance.mockResolvedValue('1000');
    repo.createCampaign.mockResolvedValue(DB_CAMPAIGN);
    soroban.registerCampaign.mockResolvedValue({ txHash: 'txhash-abc', contractCampaignId: 'contract-id-abc' });
    repo.confirmOnChain.mockResolvedValue(CONFIRMED_CAMPAIGN);

    const res = await request(app).post('/api/campaigns').send(VALID_BODY);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.on_chain_status).toBe('confirmed');
    expect(repo.createCampaign).toHaveBeenCalledWith(expect.objectContaining({
      merchantId: 1,
      tokenAmount: 500,
      rewardPerAction: 5,
    }));
    expect(soroban.registerCampaign).toHaveBeenCalledTimes(1);
    expect(repo.confirmOnChain).toHaveBeenCalledWith({
      id: 42,
      contractCampaignId: 'contract-id-abc',
      txHash: 'txhash-abc',
    });
  });

  test('400 — rejects missing name', async () => {
    const { name, ...body } = VALID_BODY;
    const res = await request(app).post('/api/campaigns').send(body);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_error');
    expect(repo.createCampaign).not.toHaveBeenCalled();
  });

  test('400 — rejects missing tokenAmount', async () => {
    const { tokenAmount, ...body } = VALID_BODY;
    const res = await request(app).post('/api/campaigns').send(body);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_error');
    expect(res.body.fields.tokenAmount).toBeDefined();
  });

  test('400 — rejects missing rewardPerAction', async () => {
    const { rewardPerAction, ...body } = VALID_BODY;
    const res = await request(app).post('/api/campaigns').send(body);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_error');
    expect(res.body.fields.rewardPerAction).toBeDefined();
  });

  test('400 — rejects zero tokenAmount', async () => {
    const res = await request(app).post('/api/campaigns').send({ ...VALID_BODY, tokenAmount: 0 });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_error');
  });

  test('400 — rejects zero rewardPerAction', async () => {
    const res = await request(app).post('/api/campaigns').send({ ...VALID_BODY, rewardPerAction: 0 });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_error');
  });

  test('400 — rejects endDate <= startDate', async () => {
    const res = await request(app)
      .post('/api/campaigns')
      .send({ ...VALID_BODY, startDate: '2026-08-01', endDate: '2026-06-01' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_error');
  });

  test('400 — returns insufficient_balance when merchant balance < tokenAmount', async () => {
    stellar.getNOVABalance.mockResolvedValue('100');

    const res = await request(app).post('/api/campaigns').send({ ...VALID_BODY, tokenAmount: 500 });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('insufficient_balance');
    expect(repo.createCampaign).not.toHaveBeenCalled();
  });

  test('400 — treats balance fetch failure as zero balance', async () => {
    stellar.getNOVABalance.mockRejectedValue(new Error('Horizon unavailable'));

    const res = await request(app).post('/api/campaigns').send({ ...VALID_BODY, tokenAmount: 500 });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('insufficient_balance');
    expect(repo.createCampaign).not.toHaveBeenCalled();
  });

  test('502 — marks DB failed and returns chain_error when Soroban throws', async () => {
    stellar.getNOVABalance.mockResolvedValue('1000');
    repo.createCampaign.mockResolvedValue(DB_CAMPAIGN);
    soroban.registerCampaign.mockRejectedValue(new Error('RPC timeout'));

    const res = await request(app).post('/api/campaigns').send(VALID_BODY);

    expect(res.status).toBe(502);
    expect(res.body.error).toBe('chain_error');
    expect(repo.markOnChainFailed).toHaveBeenCalledWith(42);
    expect(repo.confirmOnChain).not.toHaveBeenCalled();
  });
});

// ============================================================================
// GET /api/campaigns/:id
// ============================================================================
describe('GET /api/campaigns/:id', () => {
  test('200 — returns campaign with on-chain fields', async () => {
    repo.getCampaignById.mockResolvedValue(CONFIRMED_CAMPAIGN);

    const res = await request(app).get('/api/campaigns/42');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.on_chain_status).toBe('confirmed');
    expect(res.body.data.tx_hash).toBe('txhash-abc');
  });

  test('404 — returns not_found for unknown id', async () => {
    repo.getCampaignById.mockResolvedValue(null);

    const res = await request(app).get('/api/campaigns/999');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('not_found');
  });

  test('403 — denies access to another merchant\'s campaign', async () => {
    repo.getCampaignById.mockResolvedValue({ ...CONFIRMED_CAMPAIGN, merchant_id: 99 });

    const res = await request(app).get('/api/campaigns/42');
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('forbidden');
  });

  test('400 — rejects non-integer id', async () => {
    const res = await request(app).get('/api/campaigns/abc');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_error');
  });
});

// ============================================================================
// PATCH /api/campaigns/:id
// ============================================================================
describe('PATCH /api/campaigns/:id', () => {
  test('200 — updates name and rewardRate on-chain then in DB', async () => {
    repo.getCampaignById.mockResolvedValue(CONFIRMED_CAMPAIGN);
    soroban.updateCampaign.mockResolvedValue({ txHash: 'txhash-update' });
    const updated = { ...CONFIRMED_CAMPAIGN, name: 'Winter Sale', tx_hash: 'txhash-update' };
    repo.updateCampaign.mockResolvedValue(updated);

    const res = await request(app)
      .patch('/api/campaigns/42')
      .send({ name: 'Winter Sale', rewardRate: 7 });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Winter Sale');
    expect(soroban.updateCampaign).toHaveBeenCalledWith({
      contractCampaignId: 'contract-id-abc',
      name: 'Winter Sale',
      rewardRate: 7,
    });
    expect(repo.updateCampaign).toHaveBeenCalledWith(42, {
      name: 'Winter Sale',
      rewardRate: 7,
      txHash: 'txhash-update',
    });
  });

  test('400 — rejects when no fields provided', async () => {
    repo.getCampaignById.mockResolvedValue(CONFIRMED_CAMPAIGN);

    const res = await request(app).patch('/api/campaigns/42').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_error');
  });

  test('409 — rejects when campaign not yet confirmed on-chain', async () => {
    repo.getCampaignById.mockResolvedValue({ ...DB_CAMPAIGN, contract_campaign_id: null });

    const res = await request(app).patch('/api/campaigns/42').send({ name: 'New Name' });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('chain_not_ready');
  });

  test('502 — returns chain_error when Soroban update fails', async () => {
    repo.getCampaignById.mockResolvedValue(CONFIRMED_CAMPAIGN);
    soroban.updateCampaign.mockRejectedValue(new Error('network error'));

    const res = await request(app).patch('/api/campaigns/42').send({ name: 'New Name' });
    expect(res.status).toBe(502);
    expect(res.body.error).toBe('chain_error');
    expect(repo.updateCampaign).not.toHaveBeenCalled();
  });

  test('404 — returns not_found for unknown campaign', async () => {
    repo.getCampaignById.mockResolvedValue(null);

    const res = await request(app).patch('/api/campaigns/999').send({ name: 'X' });
    expect(res.status).toBe(404);
  });

  test('403 — denies access to another merchant\'s campaign', async () => {
    repo.getCampaignById.mockResolvedValue({ ...CONFIRMED_CAMPAIGN, merchant_id: 99 });

    const res = await request(app).patch('/api/campaigns/42').send({ name: 'X' });
    expect(res.status).toBe(403);
  });
});

// ============================================================================
// DELETE /api/campaigns/:id
// ============================================================================
describe('DELETE /api/campaigns/:id', () => {
  test('200 — pauses on-chain then soft-deletes in DB', async () => {
    repo.getCampaignById.mockResolvedValue(CONFIRMED_CAMPAIGN);
    soroban.pauseCampaign.mockResolvedValue({ txHash: 'txhash-pause' });
    repo.softDeleteCampaign.mockResolvedValue({ ...CONFIRMED_CAMPAIGN, deleted_at: new Date().toISOString() });

    const res = await request(app).delete('/api/campaigns/42');

    expect(res.status).toBe(200);
    expect(res.body.data.deleted).toBe(true);
    expect(soroban.pauseCampaign).toHaveBeenCalledWith('contract-id-abc');
    expect(repo.softDeleteCampaign).toHaveBeenCalledWith(42, 'txhash-pause');
  });

  test('409 — rejects when campaign not yet confirmed on-chain', async () => {
    repo.getCampaignById.mockResolvedValue({ ...DB_CAMPAIGN, contract_campaign_id: null });

    const res = await request(app).delete('/api/campaigns/42');
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('chain_not_ready');
  });

  test('502 — returns chain_error when Soroban pause fails; DB not touched', async () => {
    repo.getCampaignById.mockResolvedValue(CONFIRMED_CAMPAIGN);
    soroban.pauseCampaign.mockRejectedValue(new Error('contract error'));

    const res = await request(app).delete('/api/campaigns/42');
    expect(res.status).toBe(502);
    expect(res.body.error).toBe('chain_error');
    expect(repo.softDeleteCampaign).not.toHaveBeenCalled();
  });

  test('404 — returns not_found for unknown campaign', async () => {
    repo.getCampaignById.mockResolvedValue(null);

    const res = await request(app).delete('/api/campaigns/999');
    expect(res.status).toBe(404);
  });

  test('403 — denies access to another merchant\'s campaign', async () => {
    repo.getCampaignById.mockResolvedValue({ ...CONFIRMED_CAMPAIGN, merchant_id: 99 });

    const res = await request(app).delete('/api/campaigns/42');
    expect(res.status).toBe(403);
  });
});
