'use strict';

/**
 * Integration tests: full auth flow — login, refresh, logout, expired token.
 * Closes #940
 *
 * Runs against a real PostgreSQL test database. No DB mocks.
 * Redis and external services are stubbed so no network calls are made.
 */

// ── Stub external services ────────────────────────────────────────────────
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

// Stub Redis with an in-memory store so refresh/revoke logic works without a real Redis
const redisStore = new Map();
jest.mock('../../lib/redis', () => ({
  client: {
    isOpen: true,
    on: jest.fn(),
    setEx: jest.fn(async (key, _ttl, val) => { redisStore.set(key, val); }),
    get:   jest.fn(async (key) => redisStore.get(key) ?? null),
    del:   jest.fn(async (key) => { redisStore.delete(key); }),
  },
  connectRedis: jest.fn().mockResolvedValue(undefined),
}));

const request = require('supertest');
const app     = require('../../server');
const { resetDb, closePool } = require('./helpers/db');

const CREDS = { email: 'authflow@example.com', password: 'Str0ngPass!' };

beforeAll(async () => {
  await resetDb();
  // Register the test user once for the whole suite
  await request(app).post('/api/auth/register').send({
    ...CREDS,
    firstName: 'Auth',
    lastName: 'Flow',
  });
});

afterAll(async () => {
  await closePool();
});

// ── Successful login ──────────────────────────────────────────────────────

describe('POST /api/auth/login — successful login', () => {
  it('200 — returns accessToken, refreshToken, and user object', async () => {
    const res = await request(app).post('/api/auth/login').send(CREDS);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeValidJwt();
    expect(res.body.data.refreshToken).toBeValidJwt();
    expect(res.body.data.user).toMatchObject({
      email: CREDS.email,
      role: 'user',
    });
  });

  it('does not expose password_hash in response', async () => {
    const res = await request(app).post('/api/auth/login').send(CREDS);
    expect(res.body.data.user).not.toHaveProperty('password_hash');
  });
});

// ── Wrong password ────────────────────────────────────────────────────────

describe('POST /api/auth/login — wrong password', () => {
  it('401 — returns invalid_credentials error', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: CREDS.email, password: 'WrongPass99!' });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('invalid_credentials');
  });

  it('401 — unknown email also returns invalid_credentials (no user enumeration)', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ghost@example.com', password: 'Str0ngPass!' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('invalid_credentials');
  });
});

// ── Token refresh ─────────────────────────────────────────────────────────

describe('POST /api/auth/refresh — token rotation', () => {
  let refreshToken;

  beforeEach(async () => {
    redisStore.clear();
    const loginRes = await request(app).post('/api/auth/login').send(CREDS);
    refreshToken = loginRes.body.data.refreshToken;
  });

  it('200 — returns new accessToken and refreshToken', async () => {
    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeValidJwt();
    expect(res.body.data.refreshToken).toBeValidJwt();
  });

  it('401 — reusing the same refresh token is rejected (rotation)', async () => {
    // First use — should succeed
    await request(app).post('/api/auth/refresh').send({ refreshToken });
    // Second use of the same token — should fail
    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('401 — missing refresh token', async () => {
    const res = await request(app).post('/api/auth/refresh').send({});
    expect(res.status).toBe(401);
  });

  it('401 — malformed token string', async () => {
    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: 'not.a.valid.jwt' });
    expect(res.status).toBe(401);
  });
});

// ── Expired token ─────────────────────────────────────────────────────────

describe('expired access token', () => {
  it('401 — expired token is rejected by protected routes', async () => {
    const jwt = require('jsonwebtoken');
    // Sign a token that expired 1 second ago using the test secret
    const expiredToken = jwt.sign(
      { userId: 9999, email: CREDS.email, role: 'user' },
      process.env.JWT_SECRET,
      { expiresIn: -1 }
    );
    // Use a protected endpoint — /api/users/me or similar
    const res = await request(app)
      .get('/api/users/me')
      .set('Authorization', `Bearer ${expiredToken}`);
    expect(res.status).toBe(401);
  });
});

// ── Logout ────────────────────────────────────────────────────────────────

describe('POST /api/auth/logout', () => {
  let accessToken;
  let refreshToken;

  beforeEach(async () => {
    redisStore.clear();
    const loginRes = await request(app).post('/api/auth/login').send(CREDS);
    accessToken  = loginRes.body.data.accessToken;
    refreshToken = loginRes.body.data.refreshToken;
  });

  it('200 — logout succeeds and returns success message', async () => {
    const res = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ refreshToken });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('200 — logout without tokens still returns success (idempotent)', async () => {
    const res = await request(app).post('/api/auth/logout').send({});
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('refresh token is invalidated after logout', async () => {
    await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ refreshToken });

    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken });
    expect(res.status).toBe(401);
  });
});
