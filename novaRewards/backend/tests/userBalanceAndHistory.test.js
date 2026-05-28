// Tests for GET /users/:id/balance and GET /users/:id/rewards/history
// Covers: caching, Horizon balance, off-chain points, cursor pagination, auth enforcement

process.env.ISSUER_PUBLIC = 'GDQGIY5T5QULPD7V54LJODKC5CMKPNGTWVEMYBQH4LV6STKI6IGO543K';
process.env.HORIZON_URL = 'https://horizon-testnet.stellar.org';
process.env.STELLAR_NETWORK = 'testnet';

const request = require('supertest');

jest.mock('../middleware/validateEnv', () => ({ validateEnv: jest.fn() }));
jest.mock('../services/emailService', () => ({ sendWelcome: jest.fn().mockResolvedValue({ success: true }) }));
// Mock rateLimiter to avoid rate-limit-redis RedisStore issues in tests
jest.mock('../middleware/rateLimiter', () => {
  const noop = (_req, _res, next) => next();
  return { globalLimiter: noop, authLimiter: noop };
});
jest.mock('../../blockchain/stellarService', () => ({
  getNOVABalance: jest.fn().mockResolvedValue('42.0000000'),
  isValidStellarAddress: jest.fn().mockReturnValue(true),
  server: {},
  NOVA: {},
}));
jest.mock('../../blockchain/sendRewards', () => ({}));
jest.mock('../../blockchain/issueAsset', () => ({}));
jest.mock('../../blockchain/trustline', () => ({}));
jest.mock('../routes/rewards', () => require('express').Router());
jest.mock('../routes/transactions', () => require('express').Router());
jest.mock('../db/index', () => ({ query: jest.fn(), pool: { connect: jest.fn(), query: jest.fn() } }));

jest.mock('../db/userRepository', () => ({
  getUserById: jest.fn(),
  getUserByWallet: jest.fn(),
  createUser: jest.fn(),
  updateUser: jest.fn(),
}));

jest.mock('../db/pointTransactionRepository', () => ({
  getUserBalance: jest.fn(),
  getUserTotalPoints: jest.fn(),
  getUserReferralPoints: jest.fn(),
  recordPointTransaction: jest.fn(),
}));

jest.mock('../db/redemptionRepository', () => ({
  getUserRedemptions: jest.fn(),
  redeemReward: jest.fn(),
  getRedemptionById: jest.fn(),
}));

jest.mock('../db/transactionRepository', () => ({
  getTransactionsByUser: jest.fn(),
  getRewardsHistoryCursor: jest.fn(),
  recordTransaction: jest.fn(),
  getTransactionByHash: jest.fn(),
  getTransactionsByMerchant: jest.fn(),
  getMerchantTotals: jest.fn(),
}));

jest.mock('../services/referralService', () => ({
  getUserReferralStats: jest.fn(),
  processReferralBonus: jest.fn(),
}));

jest.mock('../middleware/authenticateUser', () => ({
  authenticateUser: (req, res, next) => {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'unauthorized', message: 'Unauthorized' });
    }
    try {
      const payload = JSON.parse(Buffer.from(auth.split('.')[1], 'base64').toString());
      req.user = { id: payload.userId, role: payload.role || 'user' };
      next();
    } catch {
      return res.status(401).json({ success: false, error: 'unauthorized', message: 'Invalid token' });
    }
  },
  requireAdmin: (req, res, next) => next(),
  requireOwnershipOrAdmin: (req, res, next) => next(),
}));

jest.mock('../lib/redis', () => ({
  client: {
    isOpen: true,
    get: jest.fn(),
    setEx: jest.fn(),
    sendCommand: jest.fn().mockResolvedValue(null),
  },
  connectRedis: jest.fn(),
}));

const app = require('../server');
const { client: mockRedis } = require('../lib/redis');
const { getUserById } = require('../db/userRepository');
const { getUserBalance } = require('../db/pointTransactionRepository');
const { getRewardsHistoryCursor } = require('../db/transactionRepository');
const { getNOVABalance } = require('../../blockchain/stellarService');

// Helper: build a minimal JWT-like token for userId
function makeToken(userId, role = 'user') {
  const payload = Buffer.from(JSON.stringify({ userId, role })).toString('base64');
  return `Bearer header.${payload}.sig`;
}

const MOCK_USER = {
  id: 1,
  stellar_public_key: 'GTEST000000000000000000000000000000000000000000000000000001',
  role: 'user',
};

beforeEach(() => {
  jest.clearAllMocks();
  mockRedis.get.mockResolvedValue(null);
  mockRedis.setEx.mockResolvedValue('OK');
});

// ============================================================================
// GET /api/users/:id/balance
// ============================================================================
describe('GET /api/users/:id/balance', () => {
  test('200 — returns on-chain and off-chain balance', async () => {
    getUserById.mockResolvedValue(MOCK_USER);
    getNOVABalance.mockResolvedValue('42.0000000');
    getUserBalance.mockResolvedValue(500);

    const res = await request(app)
      .get('/api/users/1/balance')
      .set('Authorization', makeToken(1));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.onChainBalance).toBe('42.0000000');
    expect(res.body.data.offChainPoints).toBe(500);
    expect(res.body.data.stellarPublicKey).toBe(MOCK_USER.stellar_public_key);
    expect(res.body.cached).toBe(false);
  });

  test('200 — returns cached response when Redis hit', async () => {
    const cached = { userId: 1, onChainBalance: '10.0', offChainPoints: 100, stellarPublicKey: 'GTEST...' };
    mockRedis.get.mockResolvedValue(JSON.stringify(cached));

    const res = await request(app)
      .get('/api/users/1/balance')
      .set('Authorization', makeToken(1));

    expect(res.status).toBe(200);
    expect(res.body.cached).toBe(true);
    expect(res.body.data.onChainBalance).toBe('10.0');
    expect(getNOVABalance).not.toHaveBeenCalled();
  });

  test('200 — returns 0 on-chain balance when no stellar_public_key', async () => {
    getUserById.mockResolvedValue({ ...MOCK_USER, stellar_public_key: null });
    getUserBalance.mockResolvedValue(200);

    const res = await request(app)
      .get('/api/users/1/balance')
      .set('Authorization', makeToken(1));

    expect(res.status).toBe(200);
    expect(res.body.data.onChainBalance).toBe('0');
    expect(getNOVABalance).not.toHaveBeenCalled();
  });

  test('200 — caches result in Redis after fetch', async () => {
    getUserById.mockResolvedValue(MOCK_USER);
    getNOVABalance.mockResolvedValue('5.0');
    getUserBalance.mockResolvedValue(50);

    await request(app).get('/api/users/1/balance').set('Authorization', makeToken(1));

    expect(mockRedis.setEx).toHaveBeenCalledWith('balance:1', 30, expect.any(String));
  });

  test('404 — user not found', async () => {
    getUserById.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/users/99/balance')
      .set('Authorization', makeToken(99));

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('not_found');
  });

  test('401 — missing auth token', async () => {
    const res = await request(app).get('/api/users/1/balance');
    expect(res.status).toBe(401);
  });

  test('400 — invalid id', async () => {
    const res = await request(app)
      .get('/api/users/abc/balance')
      .set('Authorization', makeToken(1));
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_error');
  });

  test('403 — user cannot access another user\'s balance', async () => {
    // Override authenticateUser to enforce ownership for this test
    const authMod = require('../middleware/authenticateUser');
    const original = authMod.authenticateUser;
    authMod.authenticateUser = (req, res, next) => {
      req.user = { id: 2, role: 'user' }; // different user
      next();
    };

    getUserById.mockResolvedValue(MOCK_USER); // user id=1

    const res = await request(app)
      .get('/api/users/1/balance')
      .set('Authorization', makeToken(2));

    authMod.authenticateUser = original;
    expect(res.status).toBe(403);
  });
});

// ============================================================================
// GET /api/users/:id/rewards/history
// ============================================================================
describe('GET /api/users/:id/rewards/history', () => {
  const HISTORY_ROWS = [
    { id: 10, tx_hash: 'hash1', action_type: 'distribution', amount: '100', timestamp: '2026-04-01T00:00:00Z', status: 'completed', campaign_name: 'Spring Sale', campaign_id: 1 },
    { id: 9,  tx_hash: 'hash2', action_type: 'redemption',   amount: '50',  timestamp: '2026-03-15T00:00:00Z', status: 'completed', campaign_name: null, campaign_id: null },
  ];

  test('200 — returns paginated history with nextCursor', async () => {
    getUserById.mockResolvedValue(MOCK_USER);
    getRewardsHistoryCursor.mockResolvedValue({ data: HISTORY_ROWS, nextCursor: 'abc123' });

    const res = await request(app)
      .get('/api/users/1/rewards/history')
      .set('Authorization', makeToken(1));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0].tx_hash).toBe('hash1');
    expect(res.body.data[0].action_type).toBe('distribution');
    expect(res.body.pagination.nextCursor).toBe('abc123');
    expect(getRewardsHistoryCursor).toHaveBeenCalledWith(1, { limit: 20, cursor: undefined });
  });

  test('200 — passes cursor and limit to repository', async () => {
    getUserById.mockResolvedValue(MOCK_USER);
    getRewardsHistoryCursor.mockResolvedValue({ data: [], nextCursor: null });

    const res = await request(app)
      .get('/api/users/1/rewards/history?limit=5&cursor=dGVzdA==')
      .set('Authorization', makeToken(1));

    expect(res.status).toBe(200);
    expect(getRewardsHistoryCursor).toHaveBeenCalledWith(1, { limit: 5, cursor: 'dGVzdA==' });
    expect(res.body.pagination.nextCursor).toBeNull();
  });

  test('200 — returns empty array when no history', async () => {
    getUserById.mockResolvedValue(MOCK_USER);
    getRewardsHistoryCursor.mockResolvedValue({ data: [], nextCursor: null });

    const res = await request(app)
      .get('/api/users/1/rewards/history')
      .set('Authorization', makeToken(1));

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  test('400 — rejects limit > 100', async () => {
    getUserById.mockResolvedValue(MOCK_USER);

    const res = await request(app)
      .get('/api/users/1/rewards/history?limit=200')
      .set('Authorization', makeToken(1));

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_error');
  });

  test('404 — user not found', async () => {
    getUserById.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/users/99/rewards/history')
      .set('Authorization', makeToken(99));

    expect(res.status).toBe(404);
  });

  test('401 — missing auth token', async () => {
    const res = await request(app).get('/api/users/1/rewards/history');
    expect(res.status).toBe(401);
  });

  test('400 — invalid id', async () => {
    const res = await request(app)
      .get('/api/users/abc/rewards/history')
      .set('Authorization', makeToken(1));
    expect(res.status).toBe(400);
  });
});
