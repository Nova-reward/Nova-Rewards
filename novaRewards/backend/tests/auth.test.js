/**
 * Unit tests for POST /api/auth/register and POST /api/auth/login
 *
 * Covers:
 *  - register: 201 happy path, 400 validation failures, 409 duplicate email
 *  - login:    200 happy path (access + refresh tokens), 400 validation, 401 wrong password, 401 unknown email
 */

jest.mock('../db/index', () => ({ query: jest.fn() }));
jest.mock('bcryptjs');
jest.mock('../services/tokenService', () => ({
  signAccessToken:  jest.fn(() => 'mock.access.token'),
  signRefreshToken: jest.fn(() => 'mock.refresh.token'),
}));

const http    = require('http');
const express = require('express');
const bcrypt  = require('bcryptjs');
const { query } = require('../db/index');

// ---------------------------------------------------------------------------
// Minimal app — avoids pulling in server.js / validateEnv
// ---------------------------------------------------------------------------
function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', require('../routes/auth'));
  app.use((err, req, res, _next) => {
    res.status(err.status || 500).json({
      success: false,
      error: err.code || 'internal_error',
      message: err.message || 'An unexpected error occurred',
    });
  });
  return app;
}

// ---------------------------------------------------------------------------
// HTTP helper
// ---------------------------------------------------------------------------
function request(server, method, path, payload) {
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
        res.on('data', c => { raw += c; });
        res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(raw) }));
      }
    );
    req.on('error', reject);
    req.write(bodyStr);
    req.end();
  });
}

const post = (server, path, payload) => request(server, 'POST', path, payload);

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------
describe('Auth routes', () => {
  let server;

  beforeAll(() => new Promise(resolve => {
    server = http.createServer(buildApp()).listen(0, '127.0.0.1', resolve);
  }));

  afterAll(() => new Promise(resolve => server.close(resolve)));

  beforeEach(() => jest.clearAllMocks());

  // -------------------------------------------------------------------------
  // POST /api/auth/register
  // -------------------------------------------------------------------------
  describe('POST /api/auth/register', () => {
    const validBody = {
      email: 'jane@example.com',
      password: 'Str0ngPass!',
      firstName: 'Jane',
      lastName: 'Doe',
    };

    const dbRow = {
      id: 1,
      email: 'jane@example.com',
      first_name: 'Jane',
      last_name: 'Doe',
      role: 'user',
      created_at: new Date().toISOString(),
    };

    test('201 – happy path returns new user without password hash', async () => {
      bcrypt.hash = jest.fn().mockResolvedValue('hashed_password');
      query.mockResolvedValueOnce({ rows: [dbRow] });

      const { status, body } = await post(server, '/api/auth/register', validBody);

      expect(status).toBe(201);
      expect(body.success).toBe(true);
      expect(body.data.email).toBe('jane@example.com');
      expect(body.data.password_hash).toBeUndefined();
      // bcrypt called with salt rounds >= 12
      expect(bcrypt.hash).toHaveBeenCalledWith('Str0ngPass!', 12);
    });

    test('201 – email is normalised to lowercase before insert', async () => {
      bcrypt.hash = jest.fn().mockResolvedValue('hashed_password');
      query.mockResolvedValueOnce({ rows: [dbRow] });

      await post(server, '/api/auth/register', { ...validBody, email: 'JANE@EXAMPLE.COM' });

      expect(query.mock.calls[0][1][0]).toBe('jane@example.com');
    });

    test('400 – missing email', async () => {
      const { status, body } = await post(server, '/api/auth/register', {
        password: 'Str0ngPass!', firstName: 'Jane', lastName: 'Doe',
      });
      expect(status).toBe(400);
      expect(body.error).toBe('validation_error');
      expect(body.details).toEqual(expect.arrayContaining([expect.stringMatching(/email/i)]));
      expect(query).not.toHaveBeenCalled();
    });

    test('400 – invalid email format', async () => {
      const { status, body } = await post(server, '/api/auth/register', {
        ...validBody, email: 'not-an-email',
      });
      expect(status).toBe(400);
      expect(body.error).toBe('validation_error');
      expect(body.details).toEqual(expect.arrayContaining([expect.stringMatching(/email/i)]));
    });

    test('400 – password shorter than 8 characters', async () => {
      const { status, body } = await post(server, '/api/auth/register', {
        ...validBody, password: 'short',
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
      expect(body.error).toBe('validation_error');
      expect(body.details).toEqual(expect.arrayContaining([expect.stringMatching(/firstName/i)]));
    });

    test('400 – missing lastName', async () => {
      const { status, body } = await post(server, '/api/auth/register', {
        email: 'jane@example.com', password: 'Str0ngPass!', firstName: 'Jane',
      });
      expect(status).toBe(400);
      expect(body.error).toBe('validation_error');
      expect(body.details).toEqual(expect.arrayContaining([expect.stringMatching(/lastName/i)]));
    });

    test('400 – unknown fields rejected', async () => {
      const { status, body } = await post(server, '/api/auth/register', {
        ...validBody, hackerField: 'evil',
      });
      expect(status).toBe(400);
      expect(body.error).toBe('validation_error');
    });

    test('409 – duplicate email returns conflict', async () => {
      bcrypt.hash = jest.fn().mockResolvedValue('hashed_password');
      const pgUniqueError = Object.assign(new Error('duplicate key'), { code: '23505' });
      query.mockRejectedValueOnce(pgUniqueError);

      const { status, body } = await post(server, '/api/auth/register', validBody);

      expect(status).toBe(409);
      expect(body.error).toBe('duplicate_email');
    });
  });

  // -------------------------------------------------------------------------
  // POST /api/auth/login
  // -------------------------------------------------------------------------
  describe('POST /api/auth/login', () => {
    const validBody = { email: 'jane@example.com', password: 'Str0ngPass!' };

    const dbUser = {
      id: 1,
      email: 'jane@example.com',
      password_hash: '$2b$12$hashedpassword',
      first_name: 'Jane',
      last_name: 'Doe',
      role: 'user',
    };

    test('200 – happy path returns accessToken, refreshToken, and user', async () => {
      query.mockResolvedValueOnce({ rows: [dbUser] });
      bcrypt.compare = jest.fn().mockResolvedValue(true);

      const { status, body } = await post(server, '/api/auth/login', validBody);

      expect(status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.accessToken).toBe('mock.access.token');
      expect(body.data.refreshToken).toBe('mock.refresh.token');
      expect(body.data.user.email).toBe('jane@example.com');
      expect(body.data.user.password_hash).toBeUndefined();
    });

    test('200 – email lookup is case-insensitive', async () => {
      query.mockResolvedValueOnce({ rows: [dbUser] });
      bcrypt.compare = jest.fn().mockResolvedValue(true);

      await post(server, '/api/auth/login', { ...validBody, email: 'JANE@EXAMPLE.COM' });

      expect(query.mock.calls[0][1][0]).toBe('jane@example.com');
    });

    test('401 – wrong password', async () => {
      query.mockResolvedValueOnce({ rows: [dbUser] });
      bcrypt.compare = jest.fn().mockResolvedValue(false);

      const { status, body } = await post(server, '/api/auth/login', {
        ...validBody, password: 'WrongPassword1',
      });

      expect(status).toBe(401);
      expect(body.error).toBe('invalid_credentials');
    });

    test('401 – email not found', async () => {
      query.mockResolvedValueOnce({ rows: [] });
      // compare still called (timing attack mitigation) but resolves false
      bcrypt.compare = jest.fn().mockResolvedValue(false);

      const { status, body } = await post(server, '/api/auth/login', {
        email: 'ghost@example.com', password: 'Str0ngPass!',
      });

      expect(status).toBe(401);
      expect(body.error).toBe('invalid_credentials');
    });

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

    test('400 – unknown fields rejected', async () => {
      const { status, body } = await post(server, '/api/auth/login', {
        ...validBody, extra: 'field',
      });
      expect(status).toBe(400);
      expect(body.error).toBe('validation_error');
    });
  });
});
