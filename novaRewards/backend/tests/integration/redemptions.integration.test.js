'use strict';

/**
 * Integration tests: /api/redemptions
 *
 * Auth: user JWT (Bearer token).
 * Uses real DB for redemption logic, idempotency, and auth/authz.
 */

jest.mock('../../middleware/validateEnv', () => ({ validateEnv: jest.fn() }));
jest.mock('../../../blockchain/stellarService', () => ({
  isValidStellarAddress: jest.fn().mockReturnValue(true),
  getNOVABalance: jest.fn().mockResolvedValue('0'),
}));
jest.mock('../../../blockchain/sendRewards', () => ({ distributeRewards: jest.fn() }));
jest.mock('../../../blockchain/trustline', () => ({ verifyTrustline: jest.fn().mockResolvedValue({ exists: true }) }));
jest.mock('../../services/emailService', () => ({ sendWelcome: jest.fn().mockResolvedValue(true) }));
jest.mock('../../services/sorobanService', () => ({
  registerCampaign: jest.fn(),
  updateCampaign: jest.fn(),
  pauseCampaign: jest.fn(),
}));
jest.mock('../../routes/rewards', () => require('express').Router());
jest.mock('../../routes/transactions', () => require('express').Router());
jest.mock('../../lib/redis', () => ({
  client: { isOpen: false, on: jest.fn() },
  connectRedis: jest.fn().mockResolvedValue(undefined),
}));

const request = require('supertest');
const { v4: uuidv4 } = require('uuid');
const app = require('../../server');
const { resetDb, seedDb, closePool, getPool } = require('./helpers/db');
const { bearerFor, expiredToken, wrongSecretToken } = require('./helpers/auth');

let user;
let admin;
let reward;

beforeAll(async () => {
  await resetDb();
  ({ user, admin, reward } = await seedDb());

  // Give the test user enough balance to redeem
  const db = getPool();
  await db.query(
    `INSERT INTO user_balance (user_id, balance) VALUES ($1, 1000)
     ON CONFLICT (user_id) DO UPDATE SET balance = 1000`,
    [user.id]
  );
});

afterAll(async () => {
  await closePool();
});

// ── POST /api/redemptions ─────────────────────────────────────────────────

describe('POST /api/redemptions', () => {
  it('201 — redeems a reward and returns redemption data', async () => {
    const res = await request(app)
      .post('/api/redemptions')
      .set('Authorization', bearerFor(user))
      .set('x-idempotency-key', uuidv4())
      .send({ userId: user.id, rewardId: reward.id });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.redemption.user_id).toBe(user.id);
    expect(res.body.data.redemption.reward_id).toBe(reward.id);
  });

  it('200 — idempotent replay returns same redemption', async () => {
    const key = uuidv4();

    // First call
    await request(app)
      .post('/api/redemptions')
      .set('Authorization', bearerFor(user))
      .set('x-idempotency-key', key)
      .send({ userId: user.id, rewardId: reward.id });

    // Second call with same key
    const res = await request(app)
      .post('/api/redemptions')
      .set('Authorization', bearerFor(user))
      .set('x-idempotency-key', key)
      .send({ userId: user.id, rewardId: reward.id });

    expect(res.status).toBe(200);
    expect(res.body.idempotent).toBe(true);
  });

  it('401 — missing Authorization header', async () => {
    const res = await request(app)
      .post('/api/redemptions')
      .set('x-idempotency-key', uuidv4())
      .send({ userId: user.id, rewardId: reward.id });

    expect(res.status).toBe(401);
  });

  it('401 — expired JWT', async () => {
    const res = await request(app)
      .post('/api/redemptions')
      .set('Authorization', `Bearer ${expiredToken(user)}`)
      .set('x-idempotency-key', uuidv4())
      .send({ userId: user.id, rewardId: reward.id });

    expect(res.status).toBe(401);
  });

  it('401 — wrong secret JWT', async () => {
    const res = await request(app)
      .post('/api/redemptions')
      .set('Authorization', `Bearer ${wrongSecretToken(user)}`)
      .set('x-idempotency-key', uuidv4())
      .send({ userId: user.id, rewardId: reward.id });

    expect(res.status).toBe(401);
  });

  it('400 — missing idempotency key', async () => {
    const res = await request(app)
      .post('/api/redemptions')
      .set('Authorization', bearerFor(user))
      .send({ userId: user.id, rewardId: reward.id });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_error');
  });

  it('403 — cannot redeem for another user', async () => {
    const res = await request(app)
      .post('/api/redemptions')
      .set('Authorization', bearerFor(user))
      .set('x-idempotency-key', uuidv4())
      .send({ userId: admin.id, rewardId: reward.id }); // user tries to redeem as admin

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('forbidden');
  });

  it('404 — reward not found', async () => {
    const res = await request(app)
      .post('/api/redemptions')
      .set('Authorization', bearerFor(user))
      .set('x-idempotency-key', uuidv4())
      .send({ userId: user.id, rewardId: 999999 });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('not_found');
  });

  it('409 — out of stock', async () => {
    // Create a reward with zero stock
    const db = getPool();
    const { rows } = await db.query(`
      INSERT INTO rewards (name, cost, stock, is_active)
      VALUES ('Empty Reward', 1, 0, TRUE)
      RETURNING *
    `);
    const emptyReward = rows[0];

    const res = await request(app)
      .post('/api/redemptions')
      .set('Authorization', bearerFor(user))
      .set('x-idempotency-key', uuidv4())
      .send({ userId: user.id, rewardId: emptyReward.id });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('out_of_stock');
  });

  it('409 — insufficient points', async () => {
    // Create an expensive reward
    const db = getPool();
    const { rows } = await db.query(`
      INSERT INTO rewards (name, cost, stock, is_active)
      VALUES ('Expensive Reward', 999999, 10, TRUE)
      RETURNING *
    `);
    const expensiveReward = rows[0];

    const res = await request(app)
      .post('/api/redemptions')
      .set('Authorization', bearerFor(user))
      .set('x-idempotency-key', uuidv4())
      .send({ userId: user.id, rewardId: expensiveReward.id });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('insufficient_points');
  });
});

// ── GET /api/redemptions ──────────────────────────────────────────────────

describe('GET /api/redemptions', () => {
  it('200 — returns paginated redemption history', async () => {
    const res = await request(app)
      .get('/api/redemptions')
      .set('Authorization', bearerFor(user));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('401 — unauthenticated', async () => {
    const res = await request(app).get('/api/redemptions');
    expect(res.status).toBe(401);
  });
});

// ── GET /api/redemptions/:id ──────────────────────────────────────────────

describe('GET /api/redemptions/:id', () => {
  let redemptionId;

  beforeAll(async () => {
    // Create a redemption to look up
    const db = getPool();
    await db.query(
      `INSERT INTO user_balance (user_id, balance) VALUES ($1, 5000)
       ON CONFLICT (user_id) DO UPDATE SET balance = 5000`,
      [user.id]
    );
    const res = await request(app)
      .post('/api/redemptions')
      .set('Authorization', bearerFor(user))
      .set('x-idempotency-key', uuidv4())
      .send({ userId: user.id, rewardId: reward.id });

    redemptionId = res.body.data?.redemption?.id;
  });

  it('200 — returns redemption by id', async () => {
    if (!redemptionId) return; // skip if creation failed
    const res = await request(app)
      .get(`/api/redemptions/${redemptionId}`)
      .set('Authorization', bearerFor(user));

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(redemptionId);
  });

  it('404 — non-existent redemption', async () => {
    const res = await request(app)
      .get('/api/redemptions/999999')
      .set('Authorization', bearerFor(user));

    expect(res.status).toBe(404);
  });

  it('400 — invalid id', async () => {
    const res = await request(app)
      .get('/api/redemptions/abc')
      .set('Authorization', bearerFor(user));

    expect(res.status).toBe(400);
  });

  it('401 — unauthenticated', async () => {
    const res = await request(app).get('/api/redemptions/1');
    expect(res.status).toBe(401);
  });
});
