'use strict';
/**
 * Tests for DB-backed refresh token rotation (Issue #865)
 * Unit tests for tokenService functions + endpoint smoke tests for /api/auth/refresh.
 */

// ── ALL jest.mock calls must appear before any other statements ────────────
jest.mock('../middleware/validateEnv', () => ({ validateEnv: jest.fn() }));
jest.mock('../services/emailService', () => ({ sendWelcome: jest.fn() }));
jest.mock('../../blockchain/stellarService', () => ({
  isValidStellarAddress: jest.fn().mockReturnValue(true),
  getNOVABalance: jest.fn().mockResolvedValue('0'),
}));
jest.mock('../../blockchain/sendRewards', () => ({}));
jest.mock('../../blockchain/issueAsset',  () => ({}));
jest.mock('../../blockchain/trustline',   () => ({}));
jest.mock('../routes/rewards',      () => require('express').Router());
jest.mock('../routes/transactions',  () => require('express').Router());
jest.mock('../routes/merchants',     () => require('express').Router());
jest.mock('../routes/users',         () => require('express').Router());
jest.mock('../db/merchantRepository', () => ({
  getMerchantByApiKeyHash: jest.fn(),
  getMerchantById: jest.fn(),
  createMerchant: jest.fn(),
  updateMerchant: jest.fn(),
}));
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    $use: jest.fn(), $disconnect: jest.fn(),
    merchant: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
  })),
}));

const mockQuery = jest.fn();
jest.mock('../db/index', () => ({ query: mockQuery, pool: { query: jest.fn(), connect: jest.fn() } }));

jest.mock('../lib/redis', () => ({
  client: {
    get: jest.fn().mockResolvedValue(null),
    setEx: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    sAdd: jest.fn().mockResolvedValue(1),
    sMembers: jest.fn().mockResolvedValue([]),
    expire: jest.fn().mockResolvedValue(1),
    ttl: jest.fn().mockResolvedValue(100),
    ping: jest.fn().mockResolvedValue('PONG'),
  },
  connectRedis: jest.fn(),
}));

// ── RSA key generation (runs before any imports) ──────────────────────────
const { generateKeyPairSync } = require('crypto');
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
process.env.JWT_PRIVATE_KEY = privateKey.export({ type: 'pkcs8', format: 'pem' });
process.env.JWT_PUBLIC_KEY  = publicKey.export({ type: 'spki',  format: 'pem' });

const bcrypt   = require('bcryptjs');
const jwtLib   = require('jsonwebtoken');
const crypto   = require('crypto');
const request  = require('supertest');

// ── Load modules after mocks ──────────────────────────────────────────────
const svc = require('../services/tokenService');
const app = require('../server');

const USER = { id: 1, wallet_address: 'GTEST123', role: 'user' };

beforeEach(() => { mockQuery.mockReset(); jest.clearAllMocks(); });

// ---------------------------------------------------------------------------
// issueDbRefreshToken
// ---------------------------------------------------------------------------
describe('issueDbRefreshToken', () => {
  test('stores bcrypt hash — not plaintext — in DB', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 42 }] });
    const { token } = await svc.issueDbRefreshToken(USER);
    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toMatch(/INSERT INTO refresh_tokens/);
    const hash = params[1];
    expect(hash).not.toBe(token);
    expect(await bcrypt.compare(token, hash)).toBe(true);
  });

  test('returns tokenId from DB and a familyId UUID', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 7 }] });
    const result = await svc.issueDbRefreshToken(USER);
    expect(result.tokenId).toBe(7);
    expect(typeof result.familyId).toBe('string');
    expect(result.familyId).toMatch(/^[0-9a-f-]{36}$/);
  });

  test('token JWT expires in 30 days', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 1 }] });
    const { token } = await svc.issueDbRefreshToken(USER);
    const decoded = jwtLib.decode(token);
    expect(decoded.exp - decoded.iat).toBeGreaterThanOrEqual(30 * 24 * 60 * 60 - 5);
  });

  test('reuses provided familyId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 1 }] });
    const fam = crypto.randomUUID();
    const result = await svc.issueDbRefreshToken(USER, fam);
    expect(result.familyId).toBe(fam);
  });
});

// ---------------------------------------------------------------------------
// rotateDbRefreshToken
// ---------------------------------------------------------------------------
describe('rotateDbRefreshToken', () => {
  async function makeToken() {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 1 }] });
    return svc.issueDbRefreshToken(USER);
  }

  test('returns null when no DB row matches the token', async () => {
    const { token } = await makeToken();
    mockQuery.mockResolvedValueOnce({ rows: [] });
    expect(await svc.rotateDbRefreshToken(token, USER.id)).toBeNull();
  });

  test('throws token_reuse error when a revoked token is presented', async () => {
    const { token } = await makeToken();
    const hash = await bcrypt.hash(token, 10);
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 5, token_hash: hash, family_id: crypto.randomUUID(), revoked_at: new Date() }],
    });
    mockQuery.mockResolvedValueOnce({ rows: [] }); // UPDATE revoke family
    await expect(svc.rotateDbRefreshToken(token, USER.id))
      .rejects.toMatchObject({ code: 'token_reuse' });
  });

  test('revokes old token, issues new one in same family', async () => {
    const { token } = await makeToken();
    const hash = await bcrypt.hash(token, 10);
    const familyId = crypto.randomUUID();
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 9, token_hash: hash, family_id: familyId, revoked_at: null }] })
      .mockResolvedValueOnce({ rows: [] })               // revoke old
      .mockResolvedValueOnce({ rows: [USER] })           // user SELECT
      .mockResolvedValueOnce({ rows: [{ id: 10 }] });   // new token INSERT
    const result = await svc.rotateDbRefreshToken(token, USER.id);
    expect(result).not.toBeNull();
    expect(result.familyId).toBe(familyId);
    expect(typeof result.token).toBe('string');
    expect(result.token).not.toBe(token);
  });
});

// ---------------------------------------------------------------------------
// revokeAllDbRefreshTokens
// ---------------------------------------------------------------------------
describe('revokeAllDbRefreshTokens', () => {
  test('issues UPDATE to mark all user tokens revoked', async () => {
    mockQuery.mockResolvedValue({ rows: [] });
    await svc.revokeAllDbRefreshTokens(99);
    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toMatch(/UPDATE refresh_tokens SET revoked_at/);
    expect(params).toContain(99);
  });
});

// ---------------------------------------------------------------------------
// POST /api/auth/refresh — endpoint
// ---------------------------------------------------------------------------
describe('POST /api/auth/refresh', () => {
  test('401 — missing refreshToken', async () => {
    const res = await request(app).post('/api/auth/refresh').send({});
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('unauthorized');
  });

  test('401 — garbled token (JWT verify fails)', async () => {
    const res = await request(app).post('/api/auth/refresh').send({ refreshToken: 'x.y.z' });
    expect(res.status).toBe(401);
  });

  test('401 — valid JWT but no matching DB row', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 1 }] }); // issue token
    const { token } = await svc.issueDbRefreshToken(USER);
    mockQuery.mockResolvedValueOnce({ rows: [USER] });  // user lookup in /refresh
    mockQuery.mockResolvedValueOnce({ rows: [] });       // rotate: no match
    const res = await request(app).post('/api/auth/refresh').send({ refreshToken: token });
    expect(res.status).toBe(401);
  });

  test('401 token_reuse — revoked token → all sessions revoked', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 1 }] });
    const { token } = await svc.issueDbRefreshToken(USER);
    const hash = await bcrypt.hash(token, 10);
    mockQuery
      .mockResolvedValueOnce({ rows: [USER] })
      .mockResolvedValueOnce({ rows: [{ id: 3, token_hash: hash, family_id: crypto.randomUUID(), revoked_at: new Date() }] })
      .mockResolvedValueOnce({ rows: [] })  // revoke family
      .mockResolvedValueOnce({ rows: [] }); // revokeAllDbRefreshTokens
    const res = await request(app).post('/api/auth/refresh').send({ refreshToken: token });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('token_reuse');
  });

  test('200 — valid rotation issues new access + refresh tokens', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 1 }] });
    const { token } = await svc.issueDbRefreshToken(USER);
    const hash = await bcrypt.hash(token, 10);
    const familyId = crypto.randomUUID();
    mockQuery
      .mockResolvedValueOnce({ rows: [USER] })
      .mockResolvedValueOnce({ rows: [{ id: 1, token_hash: hash, family_id: familyId, revoked_at: null }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [USER] })
      .mockResolvedValueOnce({ rows: [{ id: 2 }] });
    const res = await request(app).post('/api/auth/refresh').send({ refreshToken: token });
    expect(res.status).toBe(200);
    expect(typeof res.body.data.accessToken).toBe('string');
    expect(typeof res.body.data.refreshToken).toBe('string');
    expect(res.body.data.refreshToken).not.toBe(token);
  });
});
