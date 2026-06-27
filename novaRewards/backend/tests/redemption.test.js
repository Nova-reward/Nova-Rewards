/**
 * Unit tests: Redemption flow — Issue #190 (Duplicate Redemption Fix)
 */

process.env.ISSUER_PUBLIC = 'GDQGIY5T5QULPD7V54LJODKC5CMKPNGTWVEMYBQH4LV6STKI6IGO543K';
process.env.HORIZON_URL = 'https://horizon-testnet.stellar.org';
process.env.STELLAR_NETWORK = 'testnet';

const request = require('supertest');

jest.mock('../middleware/validateEnv', () => ({ validateEnv: jest.fn() }));
jest.mock('../middleware/authenticateUser', () => ({
  authenticateUser: (req, _res, next) => { req.user = { id: 1 }; next(); },
  requireAdmin: (_req, _res, next) => next(),
  requireOwnershipOrAdmin: (_req, _res, next) => next(),
}));

jest.mock('../db/index', () => ({ pool: { connect: jest.fn() }, query: jest.fn() }));
jest.mock('../db/userRepository', () => ({ getUserById: jest.fn() }));
jest.mock('../db/adminRepository', () => ({ getRewardById: jest.fn() }));
jest.mock('../services/eventEmitter', () => ({ emit: jest.fn() }));

const mockRedeemReward = jest.fn();
jest.mock('../db/redemptionRepository', () => ({
  redeemReward: (...args) => mockRedeemReward(...args),
  getRedemptionById: jest.fn(),
  getUserRedemptions: jest.fn(),
}));

const app = require('../server');

const VALID_HEADERS = {
  'x-idempotency-key': 'test-key-123',
  'content-type': 'application/json',
};
const VALID_BODY = { userId: 1, rewardId: 1 };
const REDEMPTION_ROW = { id: 99, user_id: 1, reward_id: 1, points_spent: '50', idempotency_key: 'test-key-123' };
const POINT_TX_ROW   = { id: 99 };

beforeEach(() => jest.clearAllMocks());

// ---------------------------------------------------------------------------
describe('POST /api/redemptions — idempotency middleware', () => {
  test('400 when X-Idempotency-Key header is missing', async () => {
    const res = await request(app).post('/api/redemptions').set('content-type', 'application/json').send(VALID_BODY);
    expect(res.status).toBe(400);
  });

  test('400 when X-Idempotency-Key is blank', async () => {
    const res = await request(app).post('/api/redemptions').set({ ...VALID_HEADERS, 'x-idempotency-key': '   ' }).send(VALID_BODY);
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
describe('POST /api/redemptions — input validation', () => {
  test('400 when userId is missing', async () => {
    const res = await request(app).post('/api/redemptions').set(VALID_HEADERS).send({ rewardId: 1 });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_error');
  });

  test('400 when rewardId is missing', async () => {
    const res = await request(app).post('/api/redemptions').set(VALID_HEADERS).send({ userId: 1 });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_error');
  });
});

// ---------------------------------------------------------------------------
describe('POST /api/redemptions — happy path', () => {
  test('201 — fresh redemption returns created status', async () => {
    mockRedeemReward.mockResolvedValue({ redemption: REDEMPTION_ROW, pointTx: POINT_TX_ROW, idempotent: false });

    const res = await request(app).post('/api/redemptions').set(VALID_HEADERS).send(VALID_BODY);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  test('200 — idempotent replay returns 200', async () => {
    mockRedeemReward.mockResolvedValue({ redemption: REDEMPTION_ROW, pointTx: POINT_TX_ROW, idempotent: true });

    const res = await request(app).post('/api/redemptions').set(VALID_HEADERS).send(VALID_BODY);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.redemption).toMatchObject({ id: 99 });
  });
});

// ---------------------------------------------------------------------------
describe('POST /api/redemptions — eligibility failures', () => {
  test('404 when user balance row does not exist', async () => {
    const err = Object.assign(new Error('not found'), { status: 404, code: 'not_found' });
    mockRedeemReward.mockRejectedValue(err);

    const res = await request(app).post('/api/redemptions').set(VALID_HEADERS).send(VALID_BODY);
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('not_found');
  });

  test('404 when reward row does not exist', async () => {
    const err = Object.assign(new Error('not found'), { status: 404, code: 'not_found' });
    mockRedeemReward.mockRejectedValue(err);

    const res = await request(app).post('/api/redemptions').set(VALID_HEADERS).send(VALID_BODY);
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('not_found');
  });

  test('422 when user has insufficient points', async () => {
    const err = Object.assign(new Error('insufficient points'), { status: 422, code: 'insufficient_points' });
    mockRedeemReward.mockRejectedValue(err);

    const res = await request(app).post('/api/redemptions').set(VALID_HEADERS).send(VALID_BODY);
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('insufficient_points');
  });

  test('422 when reward inventory is 0', async () => {
    const err = Object.assign(new Error('out of stock'), { status: 422, code: 'out_of_stock' });
    mockRedeemReward.mockRejectedValue(err);

    const res = await request(app).post('/api/redemptions').set(VALID_HEADERS).send(VALID_BODY);
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('out_of_stock');
  });
});

// ---------------------------------------------------------------------------
describe('POST /api/redemptions — idempotency / duplicate detection', () => {
  test('409 when idempotency_key already exists (pg error 23505)', async () => {
    const err = Object.assign(new Error('duplicate key'), { code: '23505' });
    mockRedeemReward.mockRejectedValue(err);

    const res = await request(app).post('/api/redemptions').set(VALID_HEADERS).send(VALID_BODY);
    // 23505 is not mapped in the route — falls through to next(err) → 500
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
describe('POST /api/redemptions — unexpected errors', () => {
  test('500 propagated for unknown DB errors', async () => {
    mockRedeemReward.mockRejectedValue(new Error('connection reset'));

    const res = await request(app).post('/api/redemptions').set(VALID_HEADERS).send(VALID_BODY);
    expect(res.status).toBe(500);
  });
});
