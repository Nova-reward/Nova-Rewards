// Tests for GET /api/users/me
// Covers: 200 happy path, 401 missing/invalid token, 404 unknown user

const http = require('http');
const express = require('express');
const jwt = require('jsonwebtoken');

const JWT_SECRET = 'test-secret';

jest.mock('../db/index', () => ({ query: jest.fn() }));

// JWT_SECRET must be set before the middleware is required
process.env.JWT_SECRET = JWT_SECRET;

const { query } = require('../db/index');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/users', require('../routes/users'));
  app.use((err, req, res, _next) => {
    res.status(err.status || 500).json({ success: false, error: 'internal_error', message: err.message });
  });
  return app;
}

function get(server, path, headers = {}) {
  return new Promise((resolve, reject) => {
    const { port } = server.address();
    const req = http.request(
      { host: '127.0.0.1', port, path, method: 'GET', headers },
      (res) => {
        let raw = '';
        res.on('data', (c) => { raw += c; });
        res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(raw) }));
      }
    );
    req.on('error', reject);
    req.end();
  });
}

function makeToken(payload, secret = JWT_SECRET) {
  return jwt.sign(payload, secret, { expiresIn: '1h' });
}

describe('GET /api/users/me', () => {
  let server;

  beforeAll(() => new Promise((resolve) => {
    server = http.createServer(buildApp()).listen(0, '127.0.0.1', resolve);
  }));

  afterAll(() => new Promise((resolve) => server.close(resolve)));

  beforeEach(() => jest.clearAllMocks());

  const fakeUser = {
    id: 42,
    wallet_address: 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN',
    role: 'user',
    is_frozen: false,
    referral_code: 'REF123',
    created_at: '2024-01-01T00:00:00.000Z',
  };

  test('200 – valid token returns camelCase profile fields', async () => {
    query.mockResolvedValueOnce({ rows: [fakeUser] });
    const token = makeToken({ id: 42 });

    const { status, body } = await get(server, '/api/users/me', { Authorization: `Bearer ${token}` });

    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toEqual({
      id: 42,
      walletAddress: fakeUser.wallet_address,
      role: 'user',
      isFrozen: false,
      referralCode: 'REF123',
      createdAt: fakeUser.created_at,
    });
  });

  test('200 – frozen account still returns profile', async () => {
    query.mockResolvedValueOnce({ rows: [{ ...fakeUser, is_frozen: true }] });
    const token = makeToken({ id: 42 });

    const { status, body } = await get(server, '/api/users/me', { Authorization: `Bearer ${token}` });

    expect(status).toBe(200);
    expect(body.data.isFrozen).toBe(true);
  });

  test('200 – response excludes sensitive fields (no password_hash, no internal columns)', async () => {
    query.mockResolvedValueOnce({ rows: [fakeUser] });
    const token = makeToken({ id: 42 });

    const { status, body } = await get(server, '/api/users/me', { Authorization: `Bearer ${token}` });

    expect(status).toBe(200);
    expect(body.data.password_hash).toBeUndefined();
    expect(body.data.passwordHash).toBeUndefined();
    // Only the six required fields should be present
    expect(Object.keys(body.data).sort()).toEqual(
      ['createdAt', 'id', 'isFrozen', 'referralCode', 'role', 'walletAddress']
    );
  });

  test('200 – referralCode is null when not set', async () => {
    query.mockResolvedValueOnce({ rows: [{ ...fakeUser, referral_code: null }] });
    const token = makeToken({ id: 42 });

    const { status, body } = await get(server, '/api/users/me', { Authorization: `Bearer ${token}` });

    expect(status).toBe(200);
    expect(body.data.referralCode).toBeNull();
  });

  test('401 – no Authorization header', async () => {
    const { status, body } = await get(server, '/api/users/me');

    expect(status).toBe(401);
    expect(body.success).toBe(false);
    expect(body.error).toBe('unauthorized');
    expect(query).not.toHaveBeenCalled();
  });

  test('401 – Authorization header without Bearer prefix', async () => {
    const token = makeToken({ id: 42 });
    const { status, body } = await get(server, '/api/users/me', { Authorization: token });

    expect(status).toBe(401);
    expect(body.success).toBe(false);
    expect(query).not.toHaveBeenCalled();
  });

  test('401 – expired token', async () => {
    const token = jwt.sign({ id: 42 }, JWT_SECRET, { expiresIn: -1 });
    const { status, body } = await get(server, '/api/users/me', { Authorization: `Bearer ${token}` });

    expect(status).toBe(401);
    expect(body.success).toBe(false);
    expect(body.error).toBe('unauthorized');
    expect(query).not.toHaveBeenCalled();
  });

  test('401 – token signed with wrong secret', async () => {
    const token = makeToken({ id: 42 }, 'wrong-secret');
    const { status, body } = await get(server, '/api/users/me', { Authorization: `Bearer ${token}` });

    expect(status).toBe(401);
    expect(body.success).toBe(false);
    expect(query).not.toHaveBeenCalled();
  });

  test('401 – malformed token string', async () => {
    const { status, body } = await get(server, '/api/users/me', { Authorization: 'Bearer not.a.jwt' });

    expect(status).toBe(401);
    expect(body.success).toBe(false);
    expect(query).not.toHaveBeenCalled();
  });

  test('404 – valid token but user not in database', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    const token = makeToken({ id: 999 });

    const { status, body } = await get(server, '/api/users/me', { Authorization: `Bearer ${token}` });

    expect(status).toBe(404);
    expect(body.success).toBe(false);
    expect(body.error).toBe('not_found');
  });

  test('500 – database error is forwarded to error handler', async () => {
    query.mockRejectedValueOnce(new Error('DB down'));
    const token = makeToken({ id: 42 });

    const { status, body } = await get(server, '/api/users/me', { Authorization: `Bearer ${token}` });

    expect(status).toBe(500);
    expect(body.success).toBe(false);
  });
});
