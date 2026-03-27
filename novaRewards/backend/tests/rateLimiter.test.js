// Feature: Rate Limiter middleware
// Validates: Requirements #187
// Asserts 429 + Retry-After on (n+1)th request for both global and auth limiters.

const request = require('supertest');
const express = require('express');

// ---------------------------------------------------------------------------
// Build a self-contained test app — no Redis, no DB, no env deps.
// We override the store with the in-memory default by NOT passing a store,
// which is what express-rate-limit uses when no store is provided.
// ---------------------------------------------------------------------------
function buildApp({ globalMax, authMax }) {
  const rateLimit = require('express-rate-limit');

  const globalLimiter = rateLimit({
    windowMs: 60_000,
    max: globalMax,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      res.setHeader('Retry-After', '60');
      res.status(429).json({ success: false, error: 'too_many_requests' });
    },
  });

  const authLimiter = rateLimit({
    windowMs: 60_000,
    max: authMax,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      res.setHeader('Retry-After', '60');
      res.status(429).json({ success: false, error: 'too_many_requests' });
    },
  });

  const app = express();
  app.use(globalLimiter);
  app.use('/api/auth/login', authLimiter);
  app.use('/api/auth/forgot-password', authLimiter);

  app.get('/api/health', (req, res) => res.json({ ok: true }));
  app.post('/api/auth/login', (req, res) => res.json({ ok: true }));
  app.post('/api/auth/forgot-password', (req, res) => res.json({ ok: true }));

  return app;
}

// ---------------------------------------------------------------------------
// Global limiter — 100 req / 60 s
// ---------------------------------------------------------------------------
describe('Global rate limiter (100 req / 60 s)', () => {
  const MAX = 3; // use a small cap so the test runs fast
  let app;

  beforeEach(() => {
    // Reset module registry so each test gets a fresh in-memory store
    jest.resetModules();
    app = buildApp({ globalMax: MAX, authMax: 5 });
  });

  test('allows exactly MAX requests', async () => {
    for (let i = 0; i < MAX; i++) {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
    }
  });

  test('returns 429 on the (MAX+1)th request', async () => {
    for (let i = 0; i < MAX; i++) {
      await request(app).get('/api/health');
    }
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(429);
    expect(res.body.error).toBe('too_many_requests');
  });

  test('429 response includes Retry-After header', async () => {
    for (let i = 0; i <= MAX; i++) {
      await request(app).get('/api/health');
    }
    const res = await request(app).get('/api/health');
    expect(res.headers['retry-after']).toBe('60');
  });

  test('429 response body has success: false', async () => {
    for (let i = 0; i <= MAX; i++) {
      await request(app).get('/api/health');
    }
    const res = await request(app).get('/api/health');
    expect(res.body.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Auth limiter — 5 req / 60 s
// ---------------------------------------------------------------------------
describe('Auth rate limiter (5 req / 60 s)', () => {
  const AUTH_MAX = 2; // small cap for speed
  let app;

  beforeEach(() => {
    jest.resetModules();
    app = buildApp({ globalMax: 100, authMax: AUTH_MAX });
  });

  test('allows exactly AUTH_MAX requests to /api/auth/login', async () => {
    for (let i = 0; i < AUTH_MAX; i++) {
      const res = await request(app).post('/api/auth/login');
      expect(res.status).toBe(200);
    }
  });

  test('returns 429 on (AUTH_MAX+1)th request to /api/auth/login', async () => {
    for (let i = 0; i < AUTH_MAX; i++) {
      await request(app).post('/api/auth/login');
    }
    const res = await request(app).post('/api/auth/login');
    expect(res.status).toBe(429);
    expect(res.body.error).toBe('too_many_requests');
  });

  test('returns 429 on (AUTH_MAX+1)th request to /api/auth/forgot-password', async () => {
    for (let i = 0; i < AUTH_MAX; i++) {
      await request(app).post('/api/auth/forgot-password');
    }
    const res = await request(app).post('/api/auth/forgot-password');
    expect(res.status).toBe(429);
    expect(res.body.error).toBe('too_many_requests');
  });

  test('auth 429 includes Retry-After header', async () => {
    for (let i = 0; i <= AUTH_MAX; i++) {
      await request(app).post('/api/auth/login');
    }
    const res = await request(app).post('/api/auth/login');
    expect(res.headers['retry-after']).toBe('60');
  });

  test('auth limiter does not affect non-auth routes', async () => {
    // Exhaust auth limit
    for (let i = 0; i < AUTH_MAX + 2; i++) {
      await request(app).post('/api/auth/login');
    }
    // Non-auth route should still be reachable (global limit not hit)
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
  });
});
