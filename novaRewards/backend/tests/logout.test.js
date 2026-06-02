'use strict';

/**
 * Unit tests for POST /api/auth/logout and POST /api/auth/logout-all (#876)
 *
 * Route tests: mock tokenService + authenticateUser to isolate handler logic.
 * tokenService tests: mock Redis client to test revokeAllUserRefreshJtis directly.
 */

// ── Module mocks ─────────────────────────────────────────────────────────────
jest.mock('../db/index', () => ({ query: jest.fn() }));
jest.mock('../services/tokenService', () => ({
  signAccessToken:          jest.fn(() => 'mock.access.token'),
  signRefreshToken:         jest.fn(() => ({ token: 'mock.refresh.token', jti: 'mock-jti' })),
  verifyToken:              jest.fn(),
  revokeToken:              jest.fn().mockResolvedValue(undefined),
  isRevoked:                jest.fn().mockResolvedValue(false),
  storeRefreshJti:          jest.fn().mockResolvedValue(undefined),
  consumeRefreshJti:        jest.fn().mockResolvedValue('wallet_abc'),
  revokeAllUserRefreshJtis: jest.fn().mockResolvedValue(undefined),
}));
// Bypass auth middleware — inject a fixed req.user
jest.mock('../middleware/authenticateUser', () => ({
  authenticateUser:        (req, _res, next) => { req.user = { id: 1, wallet_address: 'wallet_abc', role: 'user' }; next(); },
  requireAdmin:            (_req, _res, next) => next(),
  requireOwnershipOrAdmin: (_req, _res, next) => next(),
}));
jest.mock('../middleware/abuseDetection', () => ({
  checkIpBlock:      (_req, _res, next) => next(),
  recordFailedLogin: jest.fn(),
}));
jest.mock('../db/auditLogRepository', () => ({ logAudit: jest.fn() }));

const http    = require('http');
const express = require('express');
const tokenService = require('../services/tokenService');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', require('../routes/auth'));
  app.use((err, _req, res, _next) => res.status(500).json({ success: false, message: err.message }));
  return app;
}

function post(server, path, payload, headers = {}) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const { port } = server.address();
    const req = http.request(
      { host: '127.0.0.1', port, path, method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), ...headers } },
      (res) => { let raw = ''; res.on('data', c => raw += c); res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(raw) })); }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

let server;
beforeAll(() => new Promise(r => { server = http.createServer(buildApp()).listen(0, '127.0.0.1', r); }));
afterAll(() =>  new Promise(r => server.close(r)));
beforeEach(() => jest.clearAllMocks());

const NOW = Math.floor(Date.now() / 1000);
const DECODED_ACCESS  = { sub: 'wallet_abc', jti: 'acc-jti', exp: NOW + 900 };
const DECODED_REFRESH = { sub: 'wallet_abc', type: 'refresh', jti: 'ref-jti', exp: NOW + 604800 };
const AUTH_HEADER     = { Authorization: 'Bearer valid.token' };

// ============================================================================
// POST /api/auth/logout
// ============================================================================
describe('POST /api/auth/logout', () => {
  test('200 — returns success', async () => {
    tokenService.verifyToken
      .mockReturnValueOnce(DECODED_ACCESS)
      .mockReturnValueOnce(DECODED_REFRESH);

    const { status, body } = await post(server, '/api/auth/logout', { refreshToken: 'rt' }, AUTH_HEADER);
    expect(status).toBe(200);
    expect(body).toMatchObject({ success: true, message: 'Logged out' });
  });

  test('revokes the access token jti', async () => {
    tokenService.verifyToken
      .mockReturnValueOnce(DECODED_ACCESS)
      .mockReturnValueOnce(DECODED_REFRESH);

    await post(server, '/api/auth/logout', { refreshToken: 'rt' }, AUTH_HEADER);
    expect(tokenService.revokeToken).toHaveBeenCalledWith(DECODED_ACCESS.jti, DECODED_ACCESS.exp);
  });

  test('consumes and revokes the refresh token jti', async () => {
    tokenService.verifyToken
      .mockReturnValueOnce(DECODED_ACCESS)
      .mockReturnValueOnce(DECODED_REFRESH);

    await post(server, '/api/auth/logout', { refreshToken: 'rt' }, AUTH_HEADER);
    expect(tokenService.consumeRefreshJti).toHaveBeenCalledWith(DECODED_REFRESH.jti);
    expect(tokenService.revokeToken).toHaveBeenCalledWith(DECODED_REFRESH.jti, DECODED_REFRESH.exp);
  });

  test('200 — idempotent when tokens are already expired (verifyToken throws)', async () => {
    tokenService.verifyToken.mockImplementation(() => { throw new Error('jwt expired'); });

    const { status, body } = await post(server, '/api/auth/logout', { refreshToken: 'rt' }, AUTH_HEADER);
    expect(status).toBe(200);
    expect(body.success).toBe(true);
  });

  test('200 — no refresh token in body still succeeds', async () => {
    tokenService.verifyToken.mockReturnValueOnce(DECODED_ACCESS);

    const { status } = await post(server, '/api/auth/logout', {}, AUTH_HEADER);
    expect(status).toBe(200);
    expect(tokenService.consumeRefreshJti).not.toHaveBeenCalled();
  });
});

// ============================================================================
// POST /api/auth/logout-all
// ============================================================================
describe('POST /api/auth/logout-all', () => {
  test('200 — returns success', async () => {
    tokenService.verifyToken.mockReturnValueOnce(DECODED_ACCESS);

    const { status, body } = await post(server, '/api/auth/logout-all', {}, AUTH_HEADER);
    expect(status).toBe(200);
    expect(body).toMatchObject({ success: true, message: 'All sessions revoked' });
  });

  test('revokes the current access token', async () => {
    tokenService.verifyToken.mockReturnValueOnce(DECODED_ACCESS);

    await post(server, '/api/auth/logout-all', {}, AUTH_HEADER);
    expect(tokenService.revokeToken).toHaveBeenCalledWith(DECODED_ACCESS.jti, DECODED_ACCESS.exp);
  });

  test('calls revokeAllUserRefreshJtis with wallet_address from req.user', async () => {
    tokenService.verifyToken.mockReturnValueOnce(DECODED_ACCESS);

    await post(server, '/api/auth/logout-all', {}, AUTH_HEADER);
    expect(tokenService.revokeAllUserRefreshJtis).toHaveBeenCalledWith('wallet_abc');
  });

  test('200 — idempotent: still revokes all sessions even when access token is expired', async () => {
    tokenService.verifyToken.mockImplementation(() => { throw new Error('jwt expired'); });

    const { status } = await post(server, '/api/auth/logout-all', {}, AUTH_HEADER);
    expect(status).toBe(200);
    expect(tokenService.revokeAllUserRefreshJtis).toHaveBeenCalledWith('wallet_abc');
  });
});

// ============================================================================
// tokenService.revokeAllUserRefreshJtis — unit tests with Redis mock
// ============================================================================
describe('tokenService.revokeAllUserRefreshJtis', () => {
  let svc;
  const store = new Map();
  const sets  = new Map();

  const redisMock = {
    setEx:    jest.fn(async (k, _ttl, v) => store.set(k, v)),
    get:      jest.fn(async (k) => store.get(k) ?? null),
    del:      jest.fn(async (k) => { store.delete(k); sets.delete(k); }),
    ttl:      jest.fn(async () => 3600),
    sAdd:     jest.fn(async (k, v) => { if (!sets.has(k)) sets.set(k, new Set()); sets.get(k).add(v); }),
    expire:   jest.fn().mockResolvedValue(undefined),
    sMembers: jest.fn(async (k) => [...(sets.get(k) ?? [])]),
  };

  beforeAll(() => {
    jest.resetModules();
    jest.doMock('../lib/redis', () => ({ client: redisMock }));
    jest.doMock('../services/configService', () => ({
      getRequiredConfig: () => 'placeholder',
    }));
    svc = require('../services/tokenService');
  });

  afterAll(() => jest.resetModules());

  beforeEach(() => { jest.clearAllMocks(); store.clear(); sets.clear(); });

  test('storeRefreshJti writes refresh key and adds to user set', async () => {
    await svc.storeRefreshJti('jti-1', 'wallet_xyz');
    expect(redisMock.setEx).toHaveBeenCalledWith('refresh:jti-1', expect.any(Number), 'wallet_xyz');
    expect(redisMock.sAdd).toHaveBeenCalledWith('user_refresh_jtis:wallet_xyz', 'jti-1');
  });

  test('revokeAllUserRefreshJtis blocklists each JTI and removes tracking set', async () => {
    sets.set('user_refresh_jtis:wallet_xyz', new Set(['jti-a', 'jti-b']));
    store.set('refresh:jti-a', 'wallet_xyz');
    store.set('refresh:jti-b', 'wallet_xyz');

    await svc.revokeAllUserRefreshJtis('wallet_xyz');

    expect(redisMock.setEx).toHaveBeenCalledWith('blocklist:jti-a', expect.any(Number), '1');
    expect(redisMock.setEx).toHaveBeenCalledWith('blocklist:jti-b', expect.any(Number), '1');
    expect(redisMock.del).toHaveBeenCalledWith('refresh:jti-a');
    expect(redisMock.del).toHaveBeenCalledWith('refresh:jti-b');
    expect(redisMock.del).toHaveBeenCalledWith('user_refresh_jtis:wallet_xyz');
  });

  test('revokeAllUserRefreshJtis is a no-op when user has no tracked JTIs', async () => {
    await svc.revokeAllUserRefreshJtis('wallet_no_sessions');
    expect(redisMock.setEx).not.toHaveBeenCalled();
    expect(redisMock.del).not.toHaveBeenCalled();
  });

  test('skips blocklisting JTIs that have already expired (ttl <= 0)', async () => {
    sets.set('user_refresh_jtis:wallet_xyz', new Set(['expired-jti']));
    redisMock.ttl.mockResolvedValueOnce(0);

    await svc.revokeAllUserRefreshJtis('wallet_xyz');

    expect(redisMock.setEx).not.toHaveBeenCalled();
    expect(redisMock.del).toHaveBeenCalledWith('refresh:expired-jti');
    expect(redisMock.del).toHaveBeenCalledWith('user_refresh_jtis:wallet_xyz');
  });
});
