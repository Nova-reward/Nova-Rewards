// Feature: nova-rewards, campaign routes
// Validates: Requirements 7.2, 7.3
// #94: Unit Tests for campaign routes

// Must be set before requiring server.js — stellarService reads ISSUER_PUBLIC
// at module load time to construct the NOVA Asset.
process.env.ISSUER_PUBLIC = 'GDQGIY5T5QULPD7V54LJODKC5CMKPNGTWVEMYBQH4LV6STKI6IGO543K';
process.env.HORIZON_URL   = 'https://horizon-testnet.stellar.org';
process.env.STELLAR_NETWORK = 'testnet';

const request = require('supertest');

// Stub validateEnv so server.js does not halt on missing env vars
jest.mock('../middleware/validateEnv', () => ({ validateEnv: jest.fn() }));

// Mock the db layer - keeps tests free of a real Postgres connection
jest.mock('../db/campaignRepository', () => ({
  validateCampaign: jest.requireActual('../db/campaignRepository').validateCampaign,
  createCampaign: jest.fn(),
  getCampaignsByMerchant: jest.fn(),
}));

const app = require('../server');
const { createCampaign, getCampaignsByMerchant } = require('../db/campaignRepository');

// Shared valid payload
const VALID_BODY = {
  merchantId: 1,
  name: 'Summer Sale',
  rewardRate: 5,
  startDate: '2026-06-01',
  endDate: '2026-08-31',
};

beforeEach(() => jest.clearAllMocks());

// ---------------------------------------------------------------------------
// POST /api/campaigns
// ---------------------------------------------------------------------------
describe('POST /api/campaigns', () => {
  test('201 - creates campaign and returns it for valid input', async () => {
    const created = { id: 42, ...VALID_BODY, is_active: true };
    createCampaign.mockResolvedValue(created);

    const res = await request(app).post('/api/campaigns').send(VALID_BODY);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({ id: 42, name: 'Summer Sale' });
    expect(createCampaign).toHaveBeenCalledTimes(1);
  });

  test('400 - rejects when rewardRate is 0', async () => {
    const res = await request(app)
      .post('/api/campaigns')
      .send({ ...VALID_BODY, rewardRate: 0 });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('validation_error');
    expect(res.body.message).toMatch(/reward/i);
    expect(createCampaign).not.toHaveBeenCalled();
  });

  test('400 - rejects when rewardRate is negative', async () => {
    const res = await request(app)
      .post('/api/campaigns')
      .send({ ...VALID_BODY, rewardRate: -1 });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_error');
    expect(createCampaign).not.toHaveBeenCalled();
  });

  test('400 - rejects when rewardRate is not a number', async () => {
    const res = await request(app)
      .post('/api/campaigns')
      .send({ ...VALID_BODY, rewardRate: 'free' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_error');
    expect(createCampaign).not.toHaveBeenCalled();
  });

  test('400 - rejects when endDate equals startDate', async () => {
    const res = await request(app)
      .post('/api/campaigns')
      .send({ ...VALID_BODY, startDate: '2026-06-01', endDate: '2026-06-01' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/end/i);
    expect(createCampaign).not.toHaveBeenCalled();
  });

  test('400 - rejects when endDate is before startDate', async () => {
    const res = await request(app)
      .post('/api/campaigns')
      .send({ ...VALID_BODY, startDate: '2026-08-01', endDate: '2026-06-01' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_error');
    expect(createCampaign).not.toHaveBeenCalled();
  });

  test('400 - rejects when merchantId is missing', async () => {
    const { merchantId, ...body } = VALID_BODY;
    const res = await request(app).post('/api/campaigns').send(body);

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/merchantId/i);
  });

  test('400 - rejects when name is missing', async () => {
    const { name, ...body } = VALID_BODY;
    const res = await request(app).post('/api/campaigns').send(body);

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/name/i);
  });
});

// ---------------------------------------------------------------------------
// GET /api/campaigns/:merchantId
// ---------------------------------------------------------------------------
describe('GET /api/campaigns/:merchantId', () => {
  test('200 - returns an array of campaigns for a merchant', async () => {
    const campaigns = [
      { id: 1, merchant_id: 7, name: 'Spring Promo', reward_rate: 3 },
      { id: 2, merchant_id: 7, name: 'Flash Sale', reward_rate: 10 },
    ];
    getCampaignsByMerchant.mockResolvedValue(campaigns);

    const res = await request(app).get('/api/campaigns/7');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toHaveLength(2);
    expect(getCampaignsByMerchant).toHaveBeenCalledWith(7);
  });

  test('200 - returns an empty array when merchant has no campaigns', async () => {
    getCampaignsByMerchant.mockResolvedValue([]);

    const res = await request(app).get('/api/campaigns/99');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual([]);
  });
});
