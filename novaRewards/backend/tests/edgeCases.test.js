/**
 * Edge Case Tests — Issue #944
 * @tags edge-case
 *
 * Covers: null/empty/zero values in wallet balance and campaign list handlers.
 */

const request = require('supertest');
const express = require('express');
const walletRoutes = require('../routes/wallet');
const walletService = require('../services/walletService');
const campaignRepository = require('../db/campaignRepository');

jest.mock('../services/walletService');
jest.mock('../db/campaignRepository');
jest.mock('../services/sorobanService', () => ({
  registerCampaign: jest.fn(),
  updateCampaign: jest.fn(),
  pauseCampaign: jest.fn(),
}));
jest.mock('../cache/redisClient', () => ({ getRedisClient: () => null }));
jest.mock('../middleware/metricsMiddleware', () => ({
  metrics: { cacheHits: { inc: jest.fn() }, cacheMisses: { inc: jest.fn() } },
  metricsMiddleware: (_req, _res, next) => next(),
}));
jest.mock('../middleware/authenticateUser', () => ({
  authenticateUser: (req, _res, next) => { req.user = { id: 1 }; next(); },
}));
jest.mock('../middleware/authenticateMerchant', () => ({
  authenticateMerchant: (req, _res, next) => { req.merchant = { id: 1 }; next(); },
}));
jest.mock('../dtos/middleware', () => ({
  validateCreateCampaign: (_req, _res, next) => next(),
  validateUpdateCampaign: (_req, _res, next) => next(),
  validateCampaignId: (_req, _res, next) => next(),
}));

const campaignRoutes = require('../routes/campaigns');

const app = express();
app.use(express.json());
app.use('/api/wallet', walletRoutes);
app.use('/api/campaigns', campaignRoutes);

describe('Edge Cases — wallet balance (#944)', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns zero balance gracefully', async () => {
    walletService.getBalances.mockResolvedValue({
      success: true,
      balances: { native: '0', nova: '0' },
    });
    const res = await request(app)
      .get('/api/wallet/balances/GABC')
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.balances.nova).toBe('0');
  });

  test('returns empty balances array without crashing', async () => {
    walletService.getBalances.mockResolvedValue({
      success: true,
      balances: [],
    });
    const res = await request(app)
      .get('/api/wallet/balances/GABC')
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.balances).toEqual([]);
  });

  test('handles null balance fields in service response', async () => {
    walletService.getBalances.mockResolvedValue({
      success: true,
      balances: { native: null, nova: null },
    });
    const res = await request(app)
      .get('/api/wallet/balances/GABC')
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.balances.nova).toBeNull();
  });

  test('missing publicKey param returns 400', async () => {
    const res = await request(app)
      .post('/api/wallet/verify')
      .send({ walletType: 'freighter' })
      .expect(400);
    expect(res.body.error).toBe('validation_error');
  });

  test('empty string publicKey returns 400', async () => {
    const res = await request(app)
      .post('/api/wallet/verify')
      .send({ publicKey: '', walletType: 'freighter' })
      .expect(400);
    expect(res.body.error).toBe('validation_error');
  });
});

describe('Edge Cases — campaign list (#944)', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns empty array when no campaigns exist', async () => {
    campaignRepository.getCampaignsByMerchant.mockResolvedValue([]);
    const res = await request(app)
      .get('/api/campaigns')
      .expect(200);
    expect(Array.isArray(res.body.data ?? res.body)).toBe(true);
    const list = res.body.data ?? res.body;
    expect(list).toHaveLength(0);
  });

  test('campaign with null description does not crash', async () => {
    campaignRepository.getCampaignsByMerchant.mockResolvedValue([
      { id: 1, name: 'Test', description: null, rewardRate: '10', status: 'active' },
    ]);
    const res = await request(app)
      .get('/api/campaigns')
      .expect(200);
    const list = res.body.data ?? res.body;
    expect(list[0].description).toBeNull();
  });

  test('campaign with zero rewardRate is returned without error', async () => {
    campaignRepository.getCampaignsByMerchant.mockResolvedValue([
      { id: 2, name: 'Zero Reward', description: 'desc', rewardRate: '0', status: 'active' },
    ]);
    const res = await request(app)
      .get('/api/campaigns')
      .expect(200);
    const list = res.body.data ?? res.body;
    expect(list[0].rewardRate).toBe('0');
  });

  test('campaign with null endDate does not crash', async () => {
    campaignRepository.getCampaignsByMerchant.mockResolvedValue([
      { id: 3, name: 'No Expiry', description: 'desc', rewardRate: '5', endDate: null, status: 'active' },
    ]);
    const res = await request(app)
      .get('/api/campaigns')
      .expect(200);
    const list = res.body.data ?? res.body;
    expect(list[0].endDate).toBeNull();
  });
});
