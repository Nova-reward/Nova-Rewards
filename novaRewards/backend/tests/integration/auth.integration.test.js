'use strict';

/**
 * Integration tests: POST /api/auth/register and POST /api/auth/login
 *
 * Uses a real PostgreSQL test database. No DB mocks.
 * External services (Stellar, Soroban, Redis, email) are stubbed at the
 * module level so the test process never makes network calls.
 */

// ── Stub external services that would fail without real infra ─────────────
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
// rewards.js has a module-level bug (getRedisClient not imported); stub the route
jest.mock('../../routes/rewards', () => require('express').Router());
jest.mock('../../routes/transactions', () => require('express').Router());
jest.mock('../../lib/redis', () => ({
  client: { isOpen: false, on: jest.fn() },
  connectRedis: jest.fn().mockResolvedValue(undefined),
}));

const request = require('supertest');
const app = require('../../server');
const { resetDb, closePool } = require('./helpers/db');

beforeAll(async () => {
  await resetDb();
});

afterAll(async () => {
  await closePool();
});

// ── Register ──────────────────────────────────────────────────────────────

describe('POST /api/auth/register', () => {
  const VALID = {
    email: 'register@example.com',
    password: 'Str0ngPass!',
    firstName: 'Alice',
    lastName: 'Smith',
  };

  it('201 — creates a new user and returns user data', async () => {
    const res = await request(app).post('/api/auth/register').send(VALID);
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      email: 'register@example.com',
      first_name: 'Alice',
      last_name: 'Smith',
      role: 'user',
    });
    expect(res.body.data).not.toHaveProperty('password_hash');
  });

  it('409 — duplicate email returns conflict', async () => {
    const res = await request(app).post('/api/auth/register').send(VALID);
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('duplicate_email');
  });

  it('400 — missing email', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ password: 'Str0ngPass!', firstName: 'A', lastName: 'B' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_error');
  });

  it('400 — password too short', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'short@example.com', password: 'abc', firstName: 'A', lastName: 'B' });
    expect(res.status).toBe(400);
  });

  it('400 — invalid email format', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'not-an-email', password: 'Str0ngPass!', firstName: 'A', lastName: 'B' });
    expect(res.status).toBe(400);
  });
});

// ── Login ─────────────────────────────────────────────────────────────────

describe('POST /api/auth/login', () => {
  const CREDS = { email: 'login@example.com', password: 'Str0ngPass!' };

  beforeAll(async () => {
    // Register the user we'll log in with
    await request(app).post('/api/auth/register').send({
      ...CREDS,
      firstName: 'Login',
      lastName: 'User',
    });
  });

  it('200 — returns accessToken and refreshToken', async () => {
    const res = await request(app).post('/api/auth/login').send(CREDS);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeValidJwt();
    expect(res.body.data.refreshToken).toBeValidJwt();
    expect(res.body.data.user.email).toBe('login@example.com');
  });

  it('401 — wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: CREDS.email, password: 'WrongPass1!' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('invalid_credentials');
  });

  it('401 — unknown email', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'Str0ngPass!' });
    expect(res.status).toBe(401);
  });

  it('400 — missing password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: CREDS.email });
    expect(res.status).toBe(400);
  });
});
