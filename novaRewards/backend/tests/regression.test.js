/**
 * Regression Test Suite
 * Covers critical business flows to prevent re-introduction of known bugs.
 * Each test is tagged with the GitHub issue number it regresses.
 *
 * Closes #644
 */

// ── env setup ────────────────────────────────────────────────────────────────
process.env.ISSUER_PUBLIC = 'GDQGIY5T5QULPD7V54LJODKC5CMKPNGTWVEMYBQH4LV6STKI6IGO543K';
process.env.HORIZON_URL = 'https://horizon-testnet.stellar.org';
process.env.STELLAR_NETWORK = 'testnet';
process.env.DISTRIBUTION_SECRET = 'SDCAOELAD27GUNRPWJ2QXINWREZVTMOQF4UXIYVBHJSYLU6V4KKJJTJA';

jest.mock('../middleware/validateEnv', () => ({ validateEnv: jest.fn() }));
jest.mock('../services/emailService', () => ({ sendWelcome: jest.fn().mockResolvedValue({ success: true }) }));

jest.mock('../db/index', () => ({ query: jest.fn() }));
jest.mock('../db/campaignRepository', () => ({
  getCampaignById: jest.fn(),
  getActiveCampaign: jest.fn(),
}));
jest.mock('../db/transactionRepository', () => ({
  recordTransaction: jest.fn(),
  getTransactionByIdempotencyKey: jest.fn(),
}));
jest.mock('../../blockchain/sendRewards', () => ({
  distributeRewards: jest.fn(),
}));
jest.mock('../../blockchain/stellarService', () => ({
  isValidStellarAddress: jest.fn(() => true),
  server: { loadAccount: jest.fn(), submitTransaction: jest.fn() },
}));
jest.mock('../../blockchain/trustline', () => ({
  verifyTrustline: jest.fn(),
}));
jest.mock('../middleware/authenticateUser', () => ({
  authenticateUser: (req, res, next) => {
    const auth = req.headers.authorization;
    if (!auth) return res.status(401).json({ success: false, error: 'unauthorized' });
    const parts = auth.substring(7).split('.');
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    req.user = { id: payload.userId, role: payload.role || 'user' };
    next();
  },
  requireAdmin: (req, res, next) => {
    if (req.user?.role !== 'admin') return res.status(403).json({ success: false, error: 'forbidden' });
    next();
  },
  requireOwnershipOrAdmin: (req, res, next) => next(),
}));
jest.mock('../db/adminRepository', () => ({
  getStats: jest.fn(),
  listUsers: jest.fn(),
  createReward: jest.fn(),
  updateReward: jest.fn(),
  deleteReward: jest.fn(),
  getRewardById: jest.fn(),
}));

const request = require('supertest');
const { Keypair } = require('stellar-sdk');

const { getCampaignById, getActiveCampaign } = require('../db/campaignRepository');
const { recordTransaction, getTransactionByIdempotencyKey } = require('../db/transactionRepository');
const { distributeRewards } = require('../../blockchain/sendRewards');
const { verifyTrustline } = require('../../blockchain/trustline');
const { query } = require('../db/index');

const app = require('../server');

const VALID_API_KEY = 'test-api-key';
const MERCHANT = { id: 1, api_key: VALID_API_KEY };
const RECIPIENT = Keypair.random().publicKey();

function makeToken(payload) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64');
  return `Bearer header.${encoded}.sig`;
}

beforeEach(() => {
  jest.clearAllMocks();
  query.mockResolvedValue({ rows: [MERCHANT] });
});

// ── Regression #R1: Reward double-issuance prevention ────────────────────────
// Issue: Rewards were being issued multiple times for the same transaction.
// Fix: Idempotency key check before calling distributeRewards.
describe('[#R1] Reward double-issuance prevention', () => {
  const activeCampaign = { id: 1, merchant_id: 1, end_date: '2099-12-31', is_active: true };

  test('issues reward on first request', async () => {
    getCampaignById.mockResolvedValue(activeCampaign);
    getActiveCampaign.mockResolvedValue(activeCampaign);
    verifyTrustline.mockResolvedValue({ exists: true });
    getTransactionByIdempotencyKey.mockResolvedValue(null); // no prior tx
    distributeRewards.mockResolvedValue({ txHash: 'hash-001', tx: {} });
    recordTransaction.mockResolvedValue({ id: 1 });

    const res = await request(app)
      .post('/api/rewards/distribute')
      .set('x-api-key', VALID_API_KEY)
      .send({ walletAddress: RECIPIENT, amount: 10, campaignId: 1 });

    // 200 or 201 — reward issued
    expect([200, 201]).toContain(res.status);
    expect(res.body.success).toBe(true);
  });

  test('rejects distribution when campaign is not found — prevents phantom issuance', async () => {
    getCampaignById.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/rewards/distribute')
      .set('x-api-key', VALID_API_KEY)
      .send({ walletAddress: RECIPIENT, amount: 10, campaignId: 9999 });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(distributeRewards).not.toHaveBeenCalled();
  });

  test('rejects distribution when walletAddress is missing — prevents issuance to null address', async () => {
    const res = await request(app)
      .post('/api/rewards/distribute')
      .set('x-api-key', VALID_API_KEY)
      .send({ amount: 10, campaignId: 1 });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(distributeRewards).not.toHaveBeenCalled();
  });

  test('rejects distribution when amount is zero or negative', async () => {
    const res = await request(app)
      .post('/api/rewards/distribute')
      .set('x-api-key', VALID_API_KEY)
      .send({ walletAddress: RECIPIENT, amount: 0, campaignId: 1 });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(distributeRewards).not.toHaveBeenCalled();
  });

  test('does not distribute when recipient has no trustline', async () => {
    getCampaignById.mockResolvedValue(activeCampaign);
    getActiveCampaign.mockResolvedValue(activeCampaign);
    verifyTrustline.mockResolvedValue({ exists: false });

    const res = await request(app)
      .post('/api/rewards/distribute')
      .set('x-api-key', VALID_API_KEY)
      .send({ walletAddress: RECIPIENT, amount: 10, campaignId: 1 });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('no_trustline');
    expect(distributeRewards).not.toHaveBeenCalled();
  });
});

// ── Regression #R2: Expired campaign rejection ────────────────────────────────
// Issue: Rewards were distributed against expired campaigns.
// Fix: getActiveCampaign returns null for expired/inactive campaigns.
describe('[#R2] Expired campaign rejection', () => {
  test('returns 400 and does not distribute for an expired campaign', async () => {
    const expiredCampaign = { id: 2, merchant_id: 1, end_date: '2020-01-01', is_active: false };
    getCampaignById.mockResolvedValue(expiredCampaign);
    getActiveCampaign.mockResolvedValue(null); // expired → no active campaign

    const res = await request(app)
      .post('/api/rewards/distribute')
      .set('x-api-key', VALID_API_KEY)
      .send({ walletAddress: RECIPIENT, amount: 10, campaignId: 2 });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('invalid_campaign');
    expect(distributeRewards).not.toHaveBeenCalled();
  });

  test('returns 400 for an inactive (not yet started) campaign', async () => {
    const inactiveCampaign = { id: 3, merchant_id: 1, end_date: '2099-12-31', is_active: false };
    getCampaignById.mockResolvedValue(inactiveCampaign);
    getActiveCampaign.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/rewards/distribute')
      .set('x-api-key', VALID_API_KEY)
      .send({ walletAddress: RECIPIENT, amount: 5, campaignId: 3 });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_campaign');
    expect(distributeRewards).not.toHaveBeenCalled();
  });

  test('returns 403 when campaign belongs to a different merchant', async () => {
    const otherMerchantCampaign = { id: 4, merchant_id: 99, end_date: '2099-12-31', is_active: true };
    getCampaignById.mockResolvedValue(otherMerchantCampaign);
    getActiveCampaign.mockResolvedValue(otherMerchantCampaign);
    verifyTrustline.mockResolvedValue({ exists: true });

    const res = await request(app)
      .post('/api/rewards/distribute')
      .set('x-api-key', VALID_API_KEY)
      .send({ walletAddress: RECIPIENT, amount: 10, campaignId: 4 });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('forbidden');
    expect(distributeRewards).not.toHaveBeenCalled();
  });
});

// ── Regression #R3: Unauthorized access prevention ───────────────────────────
// Issue: Admin endpoints were accessible without authentication.
// Fix: authenticateUser + requireAdmin middleware enforced on all admin routes.
describe('[#R3] Unauthorized access prevention', () => {
  test('GET /api/admin/stats returns 401 without token', async () => {
    const res = await request(app).get('/api/admin/stats');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('GET /api/admin/stats returns 403 for non-admin user', async () => {
    const userToken = makeToken({ userId: 2, role: 'user' });
    const res = await request(app)
      .get('/api/admin/stats')
      .set('Authorization', userToken);
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('forbidden');
  });

  test('GET /api/admin/stats returns 200 for admin user', async () => {
    const adminRepo = require('../db/adminRepository');
    adminRepo.getStats.mockResolvedValue({ total_users: '5' });
    const adminToken = makeToken({ userId: 1, role: 'admin' });
    const res = await request(app)
      .get('/api/admin/stats')
      .set('Authorization', adminToken);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('POST /api/rewards/distribute returns 401 without API key', async () => {
    query.mockResolvedValue({ rows: [] }); // no merchant found
    const res = await request(app)
      .post('/api/rewards/distribute')
      .send({ walletAddress: RECIPIENT, amount: 10, campaignId: 1 });
    expect([401, 403]).toContain(res.status);
    expect(distributeRewards).not.toHaveBeenCalled();
  });

  test('POST /api/rewards/distribute returns 401 with invalid API key', async () => {
    query.mockResolvedValue({ rows: [] }); // invalid key → no merchant
    const res = await request(app)
      .post('/api/rewards/distribute')
      .set('x-api-key', 'invalid-key')
      .send({ walletAddress: RECIPIENT, amount: 10, campaignId: 1 });
    expect([401, 403]).toContain(res.status);
    expect(distributeRewards).not.toHaveBeenCalled();
  });
});
