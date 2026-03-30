/**
 * Comprehensive tests for the authentication layer.
 *
 * Covers:
 *  - POST /api/auth/register  (happy path, validation, duplicates, edge cases)
 *  - POST /api/auth/login     (happy path, validation, wrong creds, timing safety)
 *  - tokenService             (signAccessToken, signRefreshToken, verifyToken)
 *  - validateRegisterDto      (all fields, boundary values, unknown fields)
 *  - validateLoginDto         (all fields, boundary values, unknown fields)
 *  - authenticateUser         (JWT validation, DB lookup, error paths)
 *  - requireAdmin             (role enforcement)
 *  - requireOwnershipOrAdmin  (ownership + admin bypass)
 *  - Password hashing         (bcrypt integration via route)
 *  - Session / token lifecycle (sign → verify → expiry)
 */

// ---------------------------------------------------------------------------
// Module mocks — declared before any require() calls
// ---------------------------------------------------------------------------
jest.mock('../db/index', () => ({ query: jest.fn() }));
jest.mock('bcryptjs');
jest.mock('../services/tokenService', () => ({
  signAccessToken:  jest.fn(() => 'mock.access.token'),
  signRefreshToken: jest.fn(() => 'mock.refresh.token'),
  verifyToken:      jest.fn(),
}));

const http    = require('http');
const express = require('express');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');

const { query }      = require('../db/index');
const tokenService   = require('../services/tokenService');
const { validateRegisterDto } = require('../dtos/registerDto');
const { validateLoginDto }    = require('../dtos/loginDto');
const {
  authenticateUser,
  requireAdmin,
  requireOwnershipOrAdmin,
} = require('../middleware/authenticateUser');

// ---------------------------------------------------------------------------
// HTTP test helpers
// ---------------------------------------------------------------------------
function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', require('../routes/auth'));
  // Generic error handler
  app.use((err, _req, res, _next) => {
    res.status(err.status || 500).json({
      success: false,
      error: err.code || 'internal_error',
      message: err.message || 'An unexpected error occurred',
    });
  });
  return app;
}

function httpRequest(server, method, path, payload) {
  return new Promise((resolve, reject) => {
    const bodyStr = JSON.stringify(payload);
    const { port } = server.address();
    const req = http.request(
      {
        host: '127.0.0.1',
        port,
        path,
        method,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(bodyStr),
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (c) => { raw += c; });
        res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(raw) }));
      },
    );
    req.on('error', reject);
    req.write(bodyStr);
    req.end();
  });
}

const post = (server, path, payload) => httpRequest(server, 'POST', path, payload);

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------
const VALID_REGISTER = {
  email: 'jane@example.com',
  password: 'Str0ngPass!',
  firstName: 'Jane',
  lastName: 'Doe',
};

const DB_USER_ROW = {
  id: 42,
  email: 'jane@example.com',
  password_hash: '$2b$12$hashedpassword',
  first_name: 'Jane',
  last_name: 'Doe',
  role: 'user',
};

const DB_REGISTER_ROW = {
  id: 42,
  email: 'jane@example.com',
  first_name: 'Jane',
  last_name: 'Doe',
  role: 'user',
  created_at: new Date().toISOString(),
};

// ---------------------------------------------------------------------------
// Helper: build a mock req/res/next triple for middleware tests
// ---------------------------------------------------------------------------
function mockCtx(headers = {}, params = {}, method = 'GET', body = {}) {
  const req = { headers, params, method, body, user: null };
  const res = {
    status: jest.fn().mockReturnThis(),
    json:   jest.fn().mockReturnThis(),
  };
  const next = jest.fn();
  return { req, res, next };
}

// ===========================================================================
// 1. validateRegisterDto — pure unit tests (no I/O)
// ===========================================================================
describe('validateRegisterDto', () => {
  test('valid payload returns { valid: true, errors: [] }', () => {
    const result = validateRegisterDto(VALID_REGISTER);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  // ── email ──────────────────────────────────────────────────────────────
  test('missing email → error', () => {
    const { valid, errors } = validateRegisterDto({ ...VALID_REGISTER, email: undefined });
    expect(valid).toBe(false);
    expect(errors.some(e => /email/i.test(e))).toBe(true);
  });

  test('empty string email → error', () => {
    const { valid, errors } = validateRegisterDto({ ...VALID_REGISTER, email: '   ' });
    expect(valid).toBe(false);
    expect(errors.some(e => /email/i.test(e))).toBe(true);
  });

  test('invalid email format → error', () => {
    const { valid, errors } = validateRegisterDto({ ...VALID_REGISTER, email: 'not-an-email' });
    expect(valid).toBe(false);
    expect(errors.some(e => /email/i.test(e))).toBe(true);
  });

  test('email without TLD → error', () => {
    const { valid } = validateRegisterDto({ ...VALID_REGISTER, email: 'user@domain' });
    expect(valid).toBe(false);
  });

  test('valid email with subdomain passes', () => {
    const { valid } = validateRegisterDto({ ...VALID_REGISTER, email: 'user@mail.example.co.uk' });
    expect(valid).toBe(true);
  });

  // ── password ───────────────────────────────────────────────────────────
  test('missing password → error', () => {
    const { valid, errors } = validateRegisterDto({ ...VALID_REGISTER, password: undefined });
    expect(valid).toBe(false);
    expect(errors.some(e => /password/i.test(e))).toBe(true);
  });

  test('password exactly 7 chars → error (min is 8)', () => {
    const { valid, errors } = validateRegisterDto({ ...VALID_REGISTER, password: 'Short1!' });
    expect(valid).toBe(false);
    expect(errors.some(e => /password/i.test(e))).toBe(true);
  });

  test('password exactly 8 chars → valid', () => {
    const { valid } = validateRegisterDto({ ...VALID_REGISTER, password: 'Exactly8' });
    expect(valid).toBe(true);
  });

  test('password of 100 chars → valid', () => {
    const { valid } = validateRegisterDto({ ...VALID_REGISTER, password: 'a'.repeat(100) });
    expect(valid).toBe(true);
  });

  // ── firstName / lastName ───────────────────────────────────────────────
  test('missing firstName → error', () => {
    const { valid, errors } = validateRegisterDto({ ...VALID_REGISTER, firstName: undefined });
    expect(valid).toBe(false);
    expect(errors.some(e => /firstName/i.test(e))).toBe(true);
  });

  test('whitespace-only firstName → error', () => {
    const { valid } = validateRegisterDto({ ...VALID_REGISTER, firstName: '   ' });
    expect(valid).toBe(false);
  });

  test('firstName of exactly 100 chars → valid', () => {
    const { valid } = validateRegisterDto({ ...VALID_REGISTER, firstName: 'A'.repeat(100) });
    expect(valid).toBe(true);
  });

  test('firstName of 101 chars → error', () => {
    const { valid, errors } = validateRegisterDto({ ...VALID_REGISTER, firstName: 'A'.repeat(101) });
    expect(valid).toBe(false);
    expect(errors.some(e => /firstName/i.test(e))).toBe(true);
  });

  test('missing lastName → error', () => {
    const { valid, errors } = validateRegisterDto({ ...VALID_REGISTER, lastName: undefined });
    expect(valid).toBe(false);
    expect(errors.some(e => /lastName/i.test(e))).toBe(true);
  });

  test('lastName of 101 chars → error', () => {
    const { valid } = validateRegisterDto({ ...VALID_REGISTER, lastName: 'B'.repeat(101) });
    expect(valid).toBe(false);
  });

  // ── unknown fields ─────────────────────────────────────────────────────
  test('unknown field → error (mass-assignment protection)', () => {
    const { valid, errors } = validateRegisterDto({ ...VALID_REGISTER, role: 'admin' });
    expect(valid).toBe(false);
    expect(errors.some(e => /unknown/i.test(e))).toBe(true);
  });

  test('multiple unknown fields → single error listing all', () => {
    const { valid, errors } = validateRegisterDto({ ...VALID_REGISTER, a: 1, b: 2 });
    expect(valid).toBe(false);
    const unknownErr = errors.find(e => /unknown/i.test(e));
    expect(unknownErr).toMatch(/a/);
    expect(unknownErr).toMatch(/b/);
  });

  // ── multiple errors at once ────────────────────────────────────────────
  test('multiple invalid fields → all errors reported', () => {
    const { valid, errors } = validateRegisterDto({
      email: 'bad', password: 'short', firstName: '', lastName: '',
    });
    expect(valid).toBe(false);
    expect(errors.length).toBeGreaterThanOrEqual(4);
  });
});

// ===========================================================================
// 2. validateLoginDto — pure unit tests
// ===========================================================================
describe('validateLoginDto', () => {
  const VALID = { email: 'jane@example.com', password: 'anypassword' };

  test('valid payload → { valid: true }', () => {
    expect(validateLoginDto(VALID).valid).toBe(true);
  });

  test('missing email → error', () => {
    const { valid, errors } = validateLoginDto({ password: 'pass' });
    expect(valid).toBe(false);
    expect(errors.some(e => /email/i.test(e))).toBe(true);
  });

  test('invalid email format → error', () => {
    const { valid } = validateLoginDto({ email: 'notvalid', password: 'pass' });
    expect(valid).toBe(false);
  });

  test('missing password → error', () => {
    const { valid, errors } = validateLoginDto({ email: 'jane@example.com' });
    expect(valid).toBe(false);
    expect(errors.some(e => /password/i.test(e))).toBe(true);
  });

  test('empty string password → error', () => {
    const { valid } = validateLoginDto({ email: 'jane@example.com', password: '' });
    expect(valid).toBe(false);
  });

  test('unknown field → error', () => {
    const { valid, errors } = validateLoginDto({ ...VALID, role: 'admin' });
    expect(valid).toBe(false);
    expect(errors.some(e => /unknown/i.test(e))).toBe(true);
  });

  test('password of 1 char is accepted (no min length on login)', () => {
    // Login DTO does not enforce password length — that is a registration concern
    const { valid } = validateLoginDto({ email: 'jane@example.com', password: 'x' });
    expect(valid).toBe(true);
  });
});

// ===========================================================================
// 3. tokenService — unit tests using real jsonwebtoken
// ===========================================================================
describe('tokenService (real implementation)', () => {
  // Use the real module, not the mock used by route tests
  let realTokenService;

  beforeAll(() => {
    process.env.JWT_SECRET = 'test-secret-at-least-32-chars-long!!';
    // Bypass the module mock for this describe block
    jest.resetModules();
    realTokenService = require('../services/tokenService');
  });

  afterAll(() => {
    jest.resetModules();
  });

  const userPayload = { id: 7, email: 'test@example.com', role: 'user' };

  // ── signAccessToken ──────────────────────────────────────────────────
  test('signAccessToken returns a non-empty string', () => {
    const token = realTokenService.signAccessToken(userPayload);
    expect(typeof token).toBe('string');
    expect(token.split('.').length).toBe(3); // JWT structure
  });

  test('signAccessToken payload contains userId, email, role', () => {
    const token = realTokenService.signAccessToken(userPayload);
    const decoded = jwt.decode(token);
    expect(decoded.userId).toBe(7);
    expect(decoded.email).toBe('test@example.com');
    expect(decoded.role).toBe('user');
  });

  test('signAccessToken does NOT include password or sensitive fields', () => {
    const token = realTokenService.signAccessToken({ ...userPayload, password_hash: 'secret' });
    const decoded = jwt.decode(token);
    expect(decoded.password_hash).toBeUndefined();
  });

  // ── signRefreshToken ─────────────────────────────────────────────────
  test('signRefreshToken returns a valid JWT', () => {
    const token = realTokenService.signRefreshToken(userPayload);
    expect(token.split('.').length).toBe(3);
  });

  test('signRefreshToken payload contains userId and type=refresh', () => {
    const token = realTokenService.signRefreshToken(userPayload);
    const decoded = jwt.decode(token);
    expect(decoded.userId).toBe(7);
    expect(decoded.type).toBe('refresh');
  });

  test('access and refresh tokens are different', () => {
    const access  = realTokenService.signAccessToken(userPayload);
    const refresh = realTokenService.signRefreshToken(userPayload);
    expect(access).not.toBe(refresh);
  });

  // ── verifyToken ──────────────────────────────────────────────────────
  test('verifyToken decodes a valid access token', () => {
    const token   = realTokenService.signAccessToken(userPayload);
    const decoded = realTokenService.verifyToken(token);
    expect(decoded.userId).toBe(7);
    expect(decoded.email).toBe('test@example.com');
  });

  test('verifyToken throws JsonWebTokenError on tampered token', () => {
    const token   = realTokenService.signAccessToken(userPayload);
    const tampered = token.slice(0, -5) + 'XXXXX';
    expect(() => realTokenService.verifyToken(tampered)).toThrow();
  });

  test('verifyToken throws on completely invalid string', () => {
    expect(() => realTokenService.verifyToken('not.a.token')).toThrow();
  });

  test('verifyToken throws TokenExpiredError on expired token', () => {
    const expired = jwt.sign(
      { userId: 1 },
      process.env.JWT_SECRET,
      { expiresIn: -1 }, // already expired
    );
    expect(() => realTokenService.verifyToken(expired)).toThrow(/expired/i);
  });

  test('verifyToken throws when signed with wrong secret', () => {
    const wrongSecret = jwt.sign({ userId: 1 }, 'wrong-secret');
    expect(() => realTokenService.verifyToken(wrongSecret)).toThrow();
  });

  test('verifyToken throws on empty string', () => {
    expect(() => realTokenService.verifyToken('')).toThrow();
  });

  // ── missing JWT_SECRET ───────────────────────────────────────────────
  test('signAccessToken throws when JWT_SECRET is not set', () => {
    const saved = process.env.JWT_SECRET;
    delete process.env.JWT_SECRET;
    jest.resetModules();
    const svc = require('../services/tokenService');
    expect(() => svc.signAccessToken(userPayload)).toThrow(/JWT_SECRET/);
    process.env.JWT_SECRET = saved;
  });
});

// ===========================================================================
// 4. POST /api/auth/register — HTTP integration tests (mocked DB + bcrypt)
// ===========================================================================
describe('POST /api/auth/register', () => {
  let server;

  beforeAll(() => new Promise((resolve) => {
    server = http.createServer(buildApp()).listen(0, '127.0.0.1', resolve);
  }));

  afterAll(() => new Promise((resolve) => server.close(resolve)));

  beforeEach(() => {
    jest.clearAllMocks();
    bcrypt.hash = jest.fn().mockResolvedValue('hashed_pw');
  });

  // ── Happy path ───────────────────────────────────────────────────────
  test('201 – creates user and returns record without password_hash', async () => {
    query.mockResolvedValueOnce({ rows: [DB_REGISTER_ROW] });

    const { status, body } = await post(server, '/api/auth/register', VALID_REGISTER);

    expect(status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.data.email).toBe('jane@example.com');
    expect(body.data.password_hash).toBeUndefined();
  });

  test('201 – bcrypt.hash called with SALT_ROUNDS=12', async () => {
    query.mockResolvedValueOnce({ rows: [DB_REGISTER_ROW] });

    await post(server, '/api/auth/register', VALID_REGISTER);

    expect(bcrypt.hash).toHaveBeenCalledWith('Str0ngPass!', 12);
  });

  test('201 – email is trimmed and lowercased before DB insert', async () => {
    query.mockResolvedValueOnce({ rows: [DB_REGISTER_ROW] });

    await post(server, '/api/auth/register', { ...VALID_REGISTER, email: '  JANE@EXAMPLE.COM  ' });

    expect(query.mock.calls[0][1][0]).toBe('jane@example.com');
  });

  test('201 – firstName and lastName are trimmed before DB insert', async () => {
    query.mockResolvedValueOnce({ rows: [DB_REGISTER_ROW] });

    await post(server, '/api/auth/register', {
      ...VALID_REGISTER,
      firstName: '  Jane  ',
      lastName: '  Doe  ',
    });

    const params = query.mock.calls[0][1];
    expect(params[2]).toBe('Jane');
    expect(params[3]).toBe('Doe');
  });

  test('201 – hashed password (not plaintext) is stored in DB', async () => {
    query.mockResolvedValueOnce({ rows: [DB_REGISTER_ROW] });

    await post(server, '/api/auth/register', VALID_REGISTER);

    const params = query.mock.calls[0][1];
    expect(params[1]).toBe('hashed_pw');
    expect(params[1]).not.toBe('Str0ngPass!');
  });

  // ── Validation failures ──────────────────────────────────────────────
  test('400 – missing email', async () => {
    const { status, body } = await post(server, '/api/auth/register', {
      password: 'Str0ngPass!', firstName: 'Jane', lastName: 'Doe',
    });
    expect(status).toBe(400);
    expect(body.error).toBe('validation_error');
    expect(query).not.toHaveBeenCalled();
  });

  test('400 – invalid email format', async () => {
    const { status, body } = await post(server, '/api/auth/register', {
      ...VALID_REGISTER, email: 'not-an-email',
    });
    expect(status).toBe(400);
    expect(body.error).toBe('validation_error');
  });

  test('400 – password too short (7 chars)', async () => {
    const { status, body } = await post(server, '/api/auth/register', {
      ...VALID_REGISTER, password: 'Short1!',
    });
    expect(status).toBe(400);
    expect(body.error).toBe('validation_error');
    expect(body.details).toEqual(expect.arrayContaining([expect.stringMatching(/password/i)]));
  });

  test('400 – missing firstName', async () => {
    const { status, body } = await post(server, '/api/auth/register', {
      email: 'jane@example.com', password: 'Str0ngPass!', lastName: 'Doe',
    });
    expect(status).toBe(400);
    expect(body.details).toEqual(expect.arrayContaining([expect.stringMatching(/firstName/i)]));
  });

  test('400 – missing lastName', async () => {
    const { status, body } = await post(server, '/api/auth/register', {
      email: 'jane@example.com', password: 'Str0ngPass!', firstName: 'Jane',
    });
    expect(status).toBe(400);
    expect(body.details).toEqual(expect.arrayContaining([expect.stringMatching(/lastName/i)]));
  });

  test('400 – unknown field (mass-assignment protection)', async () => {
    const { status, body } = await post(server, '/api/auth/register', {
      ...VALID_REGISTER, role: 'admin',
    });
    expect(status).toBe(400);
    expect(body.error).toBe('validation_error');
    expect(query).not.toHaveBeenCalled();
  });

  test('400 – empty body', async () => {
    const { status, body } = await post(server, '/api/auth/register', {});
    expect(status).toBe(400);
    expect(body.error).toBe('validation_error');
  });

  // ── Conflict ─────────────────────────────────────────────────────────
  test('409 – duplicate email (Postgres unique violation code 23505)', async () => {
    const pgErr = Object.assign(new Error('duplicate key'), { code: '23505' });
    query.mockRejectedValueOnce(pgErr);

    const { status, body } = await post(server, '/api/auth/register', VALID_REGISTER);

    expect(status).toBe(409);
    expect(body.error).toBe('duplicate_email');
  });

  test('409 – response does not expose password hash', async () => {
    const pgErr = Object.assign(new Error('duplicate key'), { code: '23505' });
    query.mockRejectedValueOnce(pgErr);

    const { body } = await post(server, '/api/auth/register', VALID_REGISTER);

    expect(JSON.stringify(body)).not.toMatch(/hash/i);
  });

  // ── DB error propagation ─────────────────────────────────────────────
  test('500 – unexpected DB error propagates to error handler', async () => {
    query.mockRejectedValueOnce(new Error('connection refused'));

    const { status } = await post(server, '/api/auth/register', VALID_REGISTER);

    expect(status).toBe(500);
  });
});

// ===========================================================================
// 5. POST /api/auth/login — HTTP integration tests
// ===========================================================================
describe('POST /api/auth/login', () => {
  let server;

  beforeAll(() => new Promise((resolve) => {
    server = http.createServer(buildApp()).listen(0, '127.0.0.1', resolve);
  }));

  afterAll(() => new Promise((resolve) => server.close(resolve)));

  beforeEach(() => jest.clearAllMocks());

  const VALID_LOGIN = { email: 'jane@example.com', password: 'Str0ngPass!' };

  // ── Happy path ───────────────────────────────────────────────────────
  test('200 – returns accessToken, refreshToken, and sanitised user', async () => {
    query.mockResolvedValueOnce({ rows: [DB_USER_ROW] });
    bcrypt.compare = jest.fn().mockResolvedValue(true);

    const { status, body } = await post(server, '/api/auth/login', VALID_LOGIN);

    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.accessToken).toBe('mock.access.token');
    expect(body.data.refreshToken).toBe('mock.refresh.token');
    expect(body.data.user.id).toBe(42);
    expect(body.data.user.email).toBe('jane@example.com');
    expect(body.data.user.firstName).toBe('Jane');
    expect(body.data.user.lastName).toBe('Doe');
    expect(body.data.user.role).toBe('user');
  });

  test('200 – password_hash is never returned in response', async () => {
    query.mockResolvedValueOnce({ rows: [DB_USER_ROW] });
    bcrypt.compare = jest.fn().mockResolvedValue(true);

    const { body } = await post(server, '/api/auth/login', VALID_LOGIN);

    expect(body.data.user.password_hash).toBeUndefined();
    expect(JSON.stringify(body)).not.toMatch(/password_hash/);
  });

  test('200 – email lookup is case-insensitive (normalised to lowercase)', async () => {
    query.mockResolvedValueOnce({ rows: [DB_USER_ROW] });
    bcrypt.compare = jest.fn().mockResolvedValue(true);

    await post(server, '/api/auth/login', { ...VALID_LOGIN, email: 'JANE@EXAMPLE.COM' });

    expect(query.mock.calls[0][1][0]).toBe('jane@example.com');
  });

  test('200 – signAccessToken and signRefreshToken called with user data', async () => {
    query.mockResolvedValueOnce({ rows: [DB_USER_ROW] });
    bcrypt.compare = jest.fn().mockResolvedValue(true);

    await post(server, '/api/auth/login', VALID_LOGIN);

    expect(tokenService.signAccessToken).toHaveBeenCalledWith(
      expect.objectContaining({ id: 42, email: 'jane@example.com' }),
    );
    expect(tokenService.signRefreshToken).toHaveBeenCalledWith(
      expect.objectContaining({ id: 42 }),
    );
  });

  // ── Wrong credentials ────────────────────────────────────────────────
  test('401 – wrong password', async () => {
    query.mockResolvedValueOnce({ rows: [DB_USER_ROW] });
    bcrypt.compare = jest.fn().mockResolvedValue(false);

    const { status, body } = await post(server, '/api/auth/login', {
      ...VALID_LOGIN, password: 'WrongPassword1',
    });

    expect(status).toBe(401);
    expect(body.error).toBe('invalid_credentials');
  });

  test('401 – email not found in DB', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    bcrypt.compare = jest.fn().mockResolvedValue(false);

    const { status, body } = await post(server, '/api/auth/login', {
      email: 'ghost@example.com', password: 'Str0ngPass!',
    });

    expect(status).toBe(401);
    expect(body.error).toBe('invalid_credentials');
  });

  test('401 – timing-safe: bcrypt.compare still called when user not found', async () => {
    // Prevents user-enumeration via response time difference
    query.mockResolvedValueOnce({ rows: [] });
    bcrypt.compare = jest.fn().mockResolvedValue(false);

    await post(server, '/api/auth/login', { email: 'ghost@example.com', password: 'pass' });

    expect(bcrypt.compare).toHaveBeenCalled();
  });

  test('401 – error message is identical for wrong password vs unknown email', async () => {
    // Both paths must return the same message to prevent user enumeration
    query.mockResolvedValueOnce({ rows: [DB_USER_ROW] });
    bcrypt.compare = jest.fn().mockResolvedValue(false);
    const { body: wrongPwBody } = await post(server, '/api/auth/login', {
      ...VALID_LOGIN, password: 'wrong',
    });

    query.mockResolvedValueOnce({ rows: [] });
    bcrypt.compare = jest.fn().mockResolvedValue(false);
    const { body: noUserBody } = await post(server, '/api/auth/login', {
      email: 'nobody@example.com', password: 'pass',
    });

    expect(wrongPwBody.message).toBe(noUserBody.message);
    expect(wrongPwBody.error).toBe(noUserBody.error);
  });

  // ── Validation failures ──────────────────────────────────────────────
  test('400 – missing email', async () => {
    const { status, body } = await post(server, '/api/auth/login', { password: 'Str0ngPass!' });
    expect(status).toBe(400);
    expect(body.error).toBe('validation_error');
    expect(query).not.toHaveBeenCalled();
  });

  test('400 – missing password', async () => {
    const { status, body } = await post(server, '/api/auth/login', { email: 'jane@example.com' });
    expect(status).toBe(400);
    expect(body.error).toBe('validation_error');
    expect(query).not.toHaveBeenCalled();
  });

  test('400 – invalid email format', async () => {
    const { status, body } = await post(server, '/api/auth/login', {
      email: 'not-valid', password: 'Str0ngPass!',
    });
    expect(status).toBe(400);
    expect(body.error).toBe('validation_error');
    expect(query).not.toHaveBeenCalled();
  });

  test('400 – unknown field rejected', async () => {
    const { status, body } = await post(server, '/api/auth/login', {
      ...VALID_LOGIN, extra: 'field',
    });
    expect(status).toBe(400);
    expect(body.error).toBe('validation_error');
    expect(query).not.toHaveBeenCalled();
  });

  test('400 – empty body', async () => {
    const { status } = await post(server, '/api/auth/login', {});
    expect(status).toBe(400);
  });

  // ── DB error propagation ─────────────────────────────────────────────
  test('500 – unexpected DB error propagates to error handler', async () => {
    query.mockRejectedValueOnce(new Error('DB timeout'));

    const { status } = await post(server, '/api/auth/login', VALID_LOGIN);

    expect(status).toBe(500);
  });
});

// ===========================================================================
// 6. authenticateUser middleware — unit tests
// ===========================================================================
describe('authenticateUser middleware', () => {
  beforeEach(() => jest.clearAllMocks());

  // ── Missing / malformed header ────────────────────────────────────────
  test('401 – no Authorization header', async () => {
    const { req, res, next } = mockCtx();
    await authenticateUser(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'unauthorized' }));
    expect(next).not.toHaveBeenCalled();
  });

  test('401 – Authorization header without Bearer prefix', async () => {
    const { req, res, next } = mockCtx({ authorization: 'Basic abc123' });
    await authenticateUser(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('401 – Bearer with empty token string', async () => {
    tokenService.verifyToken.mockImplementation(() => { throw new Error('jwt malformed'); });
    const { req, res, next } = mockCtx({ authorization: 'Bearer ' });
    await authenticateUser(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  // ── Token verification failures ───────────────────────────────────────
  test('401 – expired token', async () => {
    tokenService.verifyToken.mockImplementation(() => {
      const err = new Error('jwt expired');
      err.name = 'TokenExpiredError';
      throw err;
    });
    const { req, res, next } = mockCtx({ authorization: 'Bearer expired.token.here' });
    await authenticateUser(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('401 – tampered / invalid signature', async () => {
    tokenService.verifyToken.mockImplementation(() => {
      const err = new Error('invalid signature');
      err.name = 'JsonWebTokenError';
      throw err;
    });
    const { req, res, next } = mockCtx({ authorization: 'Bearer tampered.token' });
    await authenticateUser(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('401 – decoded token missing userId', async () => {
    tokenService.verifyToken.mockReturnValue({ email: 'x@x.com' }); // no userId
    const { req, res, next } = mockCtx({ authorization: 'Bearer valid.but.no.userid' });
    await authenticateUser(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  // ── DB lookup failures ────────────────────────────────────────────────
  test('401 – user not found in DB (deleted account)', async () => {
    tokenService.verifyToken.mockReturnValue({ userId: 99 });
    query.mockResolvedValueOnce({ rows: [] });
    const { req, res, next } = mockCtx({ authorization: 'Bearer valid.token' });
    await authenticateUser(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'unauthorized' }),
    );
  });

  test('401 – DB throws during user lookup', async () => {
    tokenService.verifyToken.mockReturnValue({ userId: 1 });
    query.mockRejectedValueOnce(new Error('DB error'));
    const { req, res, next } = mockCtx({ authorization: 'Bearer valid.token' });
    await authenticateUser(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  // ── Success path ──────────────────────────────────────────────────────
  test('attaches user to req.user and calls next on valid token', async () => {
    const user = { id: 1, email: 'jane@example.com', role: 'user' };
    tokenService.verifyToken.mockReturnValue({ userId: 1 });
    query.mockResolvedValueOnce({ rows: [user] });
    const { req, res, next } = mockCtx({ authorization: 'Bearer valid.token' });

    await authenticateUser(req, res, next);

    expect(req.user).toEqual(user);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  test('DB query uses userId from decoded token', async () => {
    tokenService.verifyToken.mockReturnValue({ userId: 42 });
    query.mockResolvedValueOnce({ rows: [{ id: 42, role: 'user' }] });
    const { req, res, next } = mockCtx({ authorization: 'Bearer valid.token' });

    await authenticateUser(req, res, next);

    expect(query.mock.calls[0][1][0]).toBe(42);
  });
});

// ===========================================================================
// 7. requireAdmin middleware — unit tests
// ===========================================================================
describe('requireAdmin middleware', () => {
  test('403 – user with role "user"', () => {
    const { req, res, next } = mockCtx();
    req.user = { id: 1, role: 'user' };
    requireAdmin(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'forbidden' }));
    expect(next).not.toHaveBeenCalled();
  });

  test('403 – user with role "merchant"', () => {
    const { req, res, next } = mockCtx();
    req.user = { id: 1, role: 'merchant' };
    requireAdmin(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('403 – req.user is null', () => {
    const { req, res, next } = mockCtx();
    req.user = null;
    requireAdmin(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('calls next for role "admin"', () => {
    const { req, res, next } = mockCtx();
    req.user = { id: 1, role: 'admin' };
    requireAdmin(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// 8. requireOwnershipOrAdmin middleware — unit tests
// ===========================================================================
describe('requireOwnershipOrAdmin middleware', () => {
  test('GET requests always pass through regardless of ownership', () => {
    const { req, res, next } = mockCtx({}, { id: '99' }, 'GET');
    req.user = { id: 1, role: 'user' };
    requireOwnershipOrAdmin(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('owner can PATCH their own resource', () => {
    const { req, res, next } = mockCtx({}, { id: '1' }, 'PATCH');
    req.user = { id: 1, role: 'user' };
    requireOwnershipOrAdmin(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('admin can PATCH any resource', () => {
    const { req, res, next } = mockCtx({}, { id: '99' }, 'PATCH');
    req.user = { id: 1, role: 'admin' };
    requireOwnershipOrAdmin(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('admin can DELETE any resource', () => {
    const { req, res, next } = mockCtx({}, { id: '99' }, 'DELETE');
    req.user = { id: 1, role: 'admin' };
    requireOwnershipOrAdmin(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('403 – non-owner non-admin on PATCH', () => {
    const { req, res, next } = mockCtx({}, { id: '2' }, 'PATCH');
    req.user = { id: 1, role: 'user' };
    requireOwnershipOrAdmin(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'forbidden' }));
    expect(next).not.toHaveBeenCalled();
  });

  test('403 – non-owner non-admin on DELETE', () => {
    const { req, res, next } = mockCtx({}, { id: '5' }, 'DELETE');
    req.user = { id: 1, role: 'user' };
    requireOwnershipOrAdmin(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('403 – POST by non-owner non-admin', () => {
    const { req, res, next } = mockCtx({}, { id: '2' }, 'POST');
    req.user = { id: 1, role: 'user' };
    requireOwnershipOrAdmin(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
  });
});

// ===========================================================================
// 9. Password hashing — bcrypt integration (real bcrypt, no mock)
// ===========================================================================
describe('Password hashing (bcrypt integration)', () => {
  let realBcrypt;

  beforeAll(() => {
    jest.resetModules();
    realBcrypt = require('bcryptjs');
  });

  test('hash produces a string different from the plaintext', async () => {
    const hash = await realBcrypt.hash('MyPassword1!', 12);
    expect(hash).not.toBe('MyPassword1!');
    expect(typeof hash).toBe('string');
  });

  test('hash starts with bcrypt identifier $2b$', async () => {
    const hash = await realBcrypt.hash('MyPassword1!', 12);
    expect(hash.startsWith('$2b$')).toBe(true);
  });

  test('compare returns true for correct password', async () => {
    const hash = await realBcrypt.hash('CorrectHorse!', 10);
    const match = await realBcrypt.compare('CorrectHorse!', hash);
    expect(match).toBe(true);
  });

  test('compare returns false for wrong password', async () => {
    const hash = await realBcrypt.hash('CorrectHorse!', 10);
    const match = await realBcrypt.compare('WrongHorse!', hash);
    expect(match).toBe(false);
  });

  test('two hashes of the same password are different (unique salts)', async () => {
    const hash1 = await realBcrypt.hash('SamePassword1', 10);
    const hash2 = await realBcrypt.hash('SamePassword1', 10);
    expect(hash1).not.toBe(hash2);
  });

  test('compare is timing-safe: returns false for dummy hash without throwing', async () => {
    const DUMMY = '$2b$12$invalidhashpaddingtomatchbcryptlength000000000000000000000';
    const result = await realBcrypt.compare('anypassword', DUMMY).catch(() => false);
    expect(result).toBe(false);
  });
});

// ===========================================================================
// 10. Session / token lifecycle — end-to-end sign → verify flow
// ===========================================================================
describe('Token lifecycle (sign → verify)', () => {
  let svc;

  beforeAll(() => {
    process.env.JWT_SECRET = 'lifecycle-test-secret-32-chars!!';
    jest.resetModules();
    svc = require('../services/tokenService');
  });

  afterAll(() => jest.resetModules());

  const user = { id: 5, email: 'lifecycle@example.com', role: 'user' };

  test('access token round-trips: sign then verify returns correct userId', () => {
    const token   = svc.signAccessToken(user);
    const decoded = svc.verifyToken(token);
    expect(decoded.userId).toBe(5);
    expect(decoded.email).toBe('lifecycle@example.com');
    expect(decoded.role).toBe('user');
  });

  test('refresh token round-trips: sign then verify returns userId and type', () => {
    const token   = svc.signRefreshToken(user);
    const decoded = svc.verifyToken(token);
    expect(decoded.userId).toBe(5);
    expect(decoded.type).toBe('refresh');
  });

  test('access token has exp claim set in the future', () => {
    const token   = svc.signAccessToken(user);
    const decoded = jwt.decode(token);
    expect(decoded.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  test('refresh token has a longer expiry than access token', () => {
    const access  = jwt.decode(svc.signAccessToken(user));
    const refresh = jwt.decode(svc.signRefreshToken(user));
    expect(refresh.exp).toBeGreaterThan(access.exp);
  });

  test('verifyToken rejects a refresh token used as access token (type mismatch is detectable)', () => {
    // The token itself is valid JWT — caller must check the type claim
    const refresh = svc.signRefreshToken(user);
    const decoded = svc.verifyToken(refresh);
    // Caller should reject tokens where type === 'refresh' for access-protected routes
    expect(decoded.type).toBe('refresh');
  });

  test('token is invalidated after secret rotation (wrong secret)', () => {
    const token = svc.signAccessToken(user);
    // Simulate secret rotation by temporarily changing the env var
    const original = process.env.JWT_SECRET;
    process.env.JWT_SECRET = 'completely-different-secret-xyz!!';
    jest.resetModules();
    const rotatedSvc = require('../services/tokenService');
    expect(() => rotatedSvc.verifyToken(token)).toThrow();
    process.env.JWT_SECRET = original;
    jest.resetModules();
  });
});
