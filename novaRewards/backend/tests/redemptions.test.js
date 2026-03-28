// Feature: Redemption endpoint
// Validates: POST /api/redemptions — atomic point deduction + stock decrement,
//            idempotency, 409 conflict cases, event emission.

process.env.ISSUER_PUBLIC = 'GDQGIY5T5QULPD7V54LJODKC5CMKPNGTWVEMYBQH4LV6STKI6IGO543K';
process.env.HORIZON_URL   = 'https://horizon-testnet.stellar.org';
process.env.STELLAR_NETWORK = 'testnet';

jest.mock('../middleware/validateEnv', () => ({ validateEnv: jest.fn() }));
jest.mock('../services/emailService',  () => ({ sendRedemptionConfirmation: jest.fn().mockResolvedValue({ success: true }), sendWelcome: jest.fn() }));

// Mock authenticateUser — injects req.user from the Authorization header payload
jest.mock('../middleware/authenticateUser', () => ({
  authenticateUser: (req, res, next) => {
    const auth = req.headers.authorization;
    if (!auth) return res.status(401).json({ success: false, error: 'unauthorized' });
    const parts = auth.substring(7).split('.');
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    req.user = { id: payload.userId, role: payload.role || 'user', email: payload.email || null };
    next();
  },
  requireAdmin: (req, res, next) => next(),
  requireOwnershipOrAdmin: (req, res, next) => next(),
}));

jest.mock('../db/redemptionRepository', () => ({
  redeemReward: jest.fn(),
  getRedemptionById: jest.fn(),
  getUserRedemptions: jest.fn(),
}));

jest.mock('../db/userRepository', () => ({
  getUserById: jest.fn(),
  exists: jest.fn(),
  getPublicProfile: jest.fn(),
  getPrivateProfile: jest.fn(),
  update: jest.fn(),
  softDelete: jest.fn(),
  isAdmin: jest.fn(),
  getUserByWallet: jest.fn(),
  createUser: jest.fn(),
  getReferredUsers: jest.fn(),
  getReferralPointsEarned: jest.fn(),
  hasReferralBonusBeenClaimed: jest.fn(),
  getUnprocessedReferrals: jest.fn(),
  markReferralBonusClaimed: jest.fn(),
}));

jest.mock('../db/adminRepository', () => ({
  getRewardById: jest.fn(),
  getStats: jest.fn(),
  listUsers: jest.fn(),
  createReward: jest.fn(),
  updateReward: jest.fn(),
  deleteReward: jest.fn(),
}));

jest.mock('../services/eventEmitter', () => {
  const { EventEmitter } = require('events');
  const emitter = new EventEmitter();
  emitter.emit = jest.fn(emitter.emit.bind(emitter));
  return emitter;
});

const request = require('supertest');
const app = require('../server');
const { redeemReward, getRedemptionById, getUserRedemptions } = require('../db/redemptionRepository');
const { getUserById } = require('../db/userRepository');
const { getRewardById } = require('../db/adminRepository');
const appEvents = require('../services/eventEmitter');

// Helper: build a base64-encoded JWT-like token
function makeToken(payload) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64');
  return `Bearer header.${encoded}.sig`;
}

const USER_TOKEN = makeToken({ userId: 1, role: 'user', email: 'user@example.com' });
const IDEMPOTENCY_KEY = 'test-idem-key-abc123';

const MOCK_REDEMPTION = {
  id: 10,
  user_id: 1,
  reward_id: 5,
  points_spent: 100,
  idempotency_key: IDEMPOTENCY_KEY,
  status: 'completed',
  point_tx_id: 42,
  created_at: new Date().toISOString(),
};

const MOCK_POINT_TX = {
  id: 42,
  user_id: 1,
  type: 'redeemed',
  amount: 100,
  balance_before: 500,
  balance_after: 400,
};

beforeEach(() => jest.clearAllMocks());

// ── POST /api/redemptions ────────────────────────────────────────────────────

describe('POST /api/redemptions', () => {
  describe('happy path', () => {
    test('201 - creates redemption and returns data', async () => {
      redeemReward.mockResolvedValue({ redemption: MOCK_REDEMPTION, pointTx: MOCK_POINT_TX, idempotent: false });
      getUserById.mockResolvedValue({ id: 1, email: 'user@example.com', wallet_address: 'GABC' });
      getRewardById.mockResolvedValue({ id: 5, name: 'Coffee Voucher' });

      const res = await request(app)
        .post('/api/redemptions')
        .set('Authorization', USER_TOKEN)
        .set('X-Idempotency-Key', IDEMPOTENCY_KEY)
        .send({ userId: 1, rewardId: 5 });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.redemption.id).toBe(10);
      expect(res.body.data.pointTx.type).toBe('redeemed');
      expect(redeemReward).toHaveBeenCalledWith({
        userId: 1,
        rewardId: 5,
        idempotencyKey: IDEMPOTENCY_KEY,
      });
    });

    test('emits redemption.created event on fresh redemption', async () => {
      redeemReward.mockResolvedValue({ redemption: MOCK_REDEMPTION, pointTx: MOCK_POINT_TX, idempotent: false });
      getUserById.mockResolvedValue({ id: 1, email: 'user@example.com' });
      getRewardById.mockResolvedValue({ id: 5, name: 'Coffee Voucher' });

      await request(app)
        .post('/api/redemptions')
        .set('Authorization', USER_TOKEN)
        .set('X-Idempotency-Key', IDEMPOTENCY_KEY)
        .send({ userId: 1, rewardId: 5 });

      // Give the fire-and-forget Promise a tick to resolve
      await new Promise((r) => setImmediate(r));

      expect(appEvents.emit).toHaveBeenCalledWith(
        'redemption.created',
        expect.objectContaining({ redemption: MOCK_REDEMPTION })
      );
    });
  });

  describe('idempotency', () => {
    test('200 - returns existing redemption on duplicate key', async () => {
      redeemReward.mockResolvedValue({ redemption: MOCK_REDEMPTION, pointTx: undefined, idempotent: true });

      const res = await request(app)
        .post('/api/redemptions')
        .set('Authorization', USER_TOKEN)
        .set('X-Idempotency-Key', IDEMPOTENCY_KEY)
        .send({ userId: 1, rewardId: 5 });

      expect(res.status).toBe(200);
      expect(res.body.idempotent).toBe(true);
      expect(res.body.data.redemption.id).toBe(10);
    });

    test('does NOT emit event on idempotent replay', async () => {
      redeemReward.mockResolvedValue({ redemption: MOCK_REDEMPTION, pointTx: undefined, idempotent: true });

      await request(app)
        .post('/api/redemptions')
        .set('Authorization', USER_TOKEN)
        .set('X-Idempotency-Key', IDEMPOTENCY_KEY)
        .send({ userId: 1, rewardId: 5 });

      await new Promise((r) => setImmediate(r));
      expect(appEvents.emit).not.toHaveBeenCalled();
    });
  });

  describe('validation errors', () => {
    test('400 - missing X-Idempotency-Key header', async () => {
      const res = await request(app)
        .post('/api/redemptions')
        .set('Authorization', USER_TOKEN)
        .send({ userId: 1, rewardId: 5 });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('validation_error');
      expect(res.body.message).toMatch(/X-Idempotency-Key/);
    });

    test('400 - missing userId', async () => {
      const res = await request(app)
        .post('/api/redemptions')
        .set('Authorization', USER_TOKEN)
        .set('X-Idempotency-Key', IDEMPOTENCY_KEY)
        .send({ rewardId: 5 });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('validation_error');
      expect(res.body.message).toMatch(/userId/);
    });

    test('400 - missing rewardId', async () => {
      const res = await request(app)
        .post('/api/redemptions')
        .set('Authorization', USER_TOKEN)
        .set('X-Idempotency-Key', IDEMPOTENCY_KEY)
        .send({ userId: 1 });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('validation_error');
      expect(res.body.message).toMatch(/rewardId/);
    });

    test('400 - non-integer userId', async () => {
      const res = await request(app)
        .post('/api/redemptions')
        .set('Authorization', USER_TOKEN)
        .set('X-Idempotency-Key', IDEMPOTENCY_KEY)
        .send({ userId: 'abc', rewardId: 5 });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('validation_error');
    });
  });

  describe('authorisation', () => {
    test('401 - no auth token', async () => {
      const res = await request(app)
        .post('/api/redemptions')
        .set('X-Idempotency-Key', IDEMPOTENCY_KEY)
        .send({ userId: 1, rewardId: 5 });

      expect(res.status).toBe(401);
    });

    test('403 - userId in body does not match authenticated user', async () => {
      const res = await request(app)
        .post('/api/redemptions')
        .set('Authorization', USER_TOKEN)   // userId = 1
        .set('X-Idempotency-Key', IDEMPOTENCY_KEY)
        .send({ userId: 99, rewardId: 5 }); // different user

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('forbidden');
    });
  });

  describe('conflict / business-rule errors', () => {
    test('404 - reward not found', async () => {
      redeemReward.mockRejectedValue(
        Object.assign(new Error('Reward not found'), { status: 404, code: 'not_found' })
      );

      const res = await request(app)
        .post('/api/redemptions')
        .set('Authorization', USER_TOKEN)
        .set('X-Idempotency-Key', IDEMPOTENCY_KEY)
        .send({ userId: 1, rewardId: 999 });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('not_found');
    });

    test('409 - out of stock', async () => {
      redeemReward.mockRejectedValue(
        Object.assign(new Error('Reward is out of stock'), { status: 409, code: 'out_of_stock' })
      );

      const res = await request(app)
        .post('/api/redemptions')
        .set('Authorization', USER_TOKEN)
        .set('X-Idempotency-Key', IDEMPOTENCY_KEY)
        .send({ userId: 1, rewardId: 5 });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('out_of_stock');
    });

    test('409 - insufficient points', async () => {
      redeemReward.mockRejectedValue(
        Object.assign(new Error('Insufficient points'), { status: 409, code: 'insufficient_points' })
      );

      const res = await request(app)
        .post('/api/redemptions')
        .set('Authorization', USER_TOKEN)
        .set('X-Idempotency-Key', IDEMPOTENCY_KEY)
        .send({ userId: 1, rewardId: 5 });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('insufficient_points');
    });

    test('409 - reward inactive', async () => {
      redeemReward.mockRejectedValue(
        Object.assign(new Error('Reward is not active'), { status: 409, code: 'reward_inactive' })
      );

      const res = await request(app)
        .post('/api/redemptions')
        .set('Authorization', USER_TOKEN)
        .set('X-Idempotency-Key', IDEMPOTENCY_KEY)
        .send({ userId: 1, rewardId: 5 });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('reward_inactive');
    });
  });
});

// ── GET /api/redemptions ─────────────────────────────────────────────────────

describe('GET /api/redemptions', () => {
  test('200 - returns paginated redemption history', async () => {
    getUserRedemptions.mockResolvedValue({
      data: [MOCK_REDEMPTION],
      total: 1,
      page: 1,
      limit: 20,
    });

    const res = await request(app)
      .get('/api/redemptions')
      .set('Authorization', USER_TOKEN);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.total).toBe(1);
    expect(getUserRedemptions).toHaveBeenCalledWith(1, { page: 1, limit: 20 });
  });

  test('200 - respects page and limit query params', async () => {
    getUserRedemptions.mockResolvedValue({ data: [], total: 0, page: 2, limit: 5 });

    const res = await request(app)
      .get('/api/redemptions?page=2&limit=5')
      .set('Authorization', USER_TOKEN);

    expect(res.status).toBe(200);
    expect(getUserRedemptions).toHaveBeenCalledWith(1, { page: 2, limit: 5 });
  });
});

// ── GET /api/redemptions/:id ─────────────────────────────────────────────────

describe('GET /api/redemptions/:id', () => {
  test('200 - returns a specific redemption', async () => {
    getRedemptionById.mockResolvedValue({ ...MOCK_REDEMPTION, reward_name: 'Coffee Voucher' });

    const res = await request(app)
      .get('/api/redemptions/10')
      .set('Authorization', USER_TOKEN);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(10);
    expect(getRedemptionById).toHaveBeenCalledWith(10, 1);
  });

  test('400 - invalid id', async () => {
    const res = await request(app)
      .get('/api/redemptions/abc')
      .set('Authorization', USER_TOKEN);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_error');
  });

  test('404 - redemption not found or belongs to another user', async () => {
    getRedemptionById.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/redemptions/999')
      .set('Authorization', USER_TOKEN);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('not_found');
  });
});
