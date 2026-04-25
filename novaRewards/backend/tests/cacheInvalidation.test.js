/**
 * Integration tests: Redis cache invalidation on reward issuance — issue #576
 */
jest.mock('../cache/redisClient');
jest.mock('../db/campaignRepository');
jest.mock('../../blockchain/sendRewards');
jest.mock('../../blockchain/trustline');

const { getRedisClient } = require('../cache/redisClient');
const { getCampaignById, getActiveCampaign } = require('../db/campaignRepository');
const { distributeRewards } = require('../../blockchain/sendRewards');
const { verifyTrustline } = require('../../blockchain/trustline');

const mockRedis = { get: jest.fn(), set: jest.fn(), del: jest.fn() };
getRedisClient.mockReturnValue(mockRedis);

const request = require('supertest');
const express = require('express');
const rewardsRouter = require('../routes/rewards');

const app = express();
app.use(express.json());
// Inject a fake merchant via middleware
app.use((req, _res, next) => { req.merchant = { id: 1 }; next(); });
app.use('/api/rewards', rewardsRouter);

const campaign = { id: 3, merchant_id: 1, name: 'Test', reward_rate: 1 };

beforeEach(() => {
  jest.clearAllMocks();
  getCampaignById.mockResolvedValue(campaign);
  getActiveCampaign.mockResolvedValue(campaign);
  verifyTrustline.mockResolvedValue({ exists: true });
  distributeRewards.mockResolvedValue({ txHash: 'abc123', tx: {} });
  mockRedis.del.mockResolvedValue(1);
});

describe('Cache invalidation on reward issuance (#576)', () => {
  it('invalidates campaign cache after successful distribution', async () => {
    const res = await request(app)
      .post('/api/rewards/distribute')
      .send({ walletAddress: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5', amount: 10, campaignId: 3 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockRedis.del).toHaveBeenCalledWith('campaigns:merchant:1');
  });

  it('does not call del when campaign not found', async () => {
    getCampaignById.mockResolvedValue(null);
    const res = await request(app)
      .post('/api/rewards/distribute')
      .send({ walletAddress: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5', amount: 10, campaignId: 99 });

    expect(res.status).toBe(404);
    expect(mockRedis.del).not.toHaveBeenCalled();
  });
});

describe('Campaign cache hit/miss (#576)', () => {
  const campaignsRouter = require('../routes/campaigns');
  const appC = express();
  appC.use(express.json());
  appC.use((req, _res, next) => { req.merchant = { id: 1 }; next(); });
  appC.use('/api/campaigns', campaignsRouter);

  const { getCampaignsByMerchant } = require('../db/campaignRepository');

  it('returns cached data on cache hit', async () => {
    mockRedis.get.mockResolvedValue(JSON.stringify([campaign]));
    const res = await request(appC).get('/api/campaigns');
    expect(res.body.cached).toBe(true);
    expect(getCampaignsByMerchant).not.toHaveBeenCalled();
  });

  it('fetches from DB and caches on cache miss', async () => {
    mockRedis.get.mockResolvedValue(null);
    mockRedis.set.mockResolvedValue('OK');
    getCampaignsByMerchant.mockResolvedValue([campaign]);
    const res = await request(appC).get('/api/campaigns');
    expect(res.body.cached).toBe(false);
    expect(mockRedis.set).toHaveBeenCalledWith(
      'campaigns:merchant:1',
      JSON.stringify([campaign]),
      'EX',
      60
    );
  });
});
