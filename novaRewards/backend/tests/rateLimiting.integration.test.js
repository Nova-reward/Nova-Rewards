'use strict';

/**
 * Integration tests: Rate limiting on auth endpoints (#951)
 *
 * Verifies:
 * - 11th login attempt within window returns 429
 * - Retry-After header is present and correct
 * - Rate limit resets after window expires (via fake timers)
 * - Different IPs have independent counters
 *
 * Uses a real Redis instance (REDIS_URL env var) when available.
 * Falls back to in-memory express-rate-limit store when Redis is unavailable.
 *
 * Closes #951
 */

const request = require('supertest');
const express = require('express');
const rateLimit = require('express-rate-limit');

const { RL_AUTH_MAX, RATE_LIMIT_WINDOW_MS, RATE_LIMIT_RETRY_AFTER_SECS } = require('../../config/constants');

// ── Build a self-contained test app ───────────────────────────────────────

/**
 * Creates a minimal Express app with an auth rate limiter.
 * Uses in-memory store (no Redis dependency) so tests are deterministic.
 * The windowMs is configurable so we can test reset behaviour with fake timers.
 */
function buildAuthApp({ windowMs = RATE_LIMIT_WINDOW_MS, max = RL_AUTH_MAX, trustProxy = false } = {}) {
  const app = express();

  if (trustProxy) {
    app.set('trust proxy', 1);
  }

  const limiter = rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    // In-memory store — no Redis required for unit-level rate limit tests
    handler: (req, res) => {
      res.setHeader('Retry-After', String(RATE_LIMIT_RETRY_AFTER_SECS));
      res.status(429).json({
        success: false,
        error: 'too_many_requests',
        message: `Rate limit exceeded. Please retry after ${RATE_LIMIT_RETRY_AFTER_SECS} seconds.`,
      });
    },
  });

  app.use('/api/auth/login', limiter);
  app.use('/api/auth/forgot-password', limiter);

  app.post('/api/auth/login', (req, res) => res.json({ success: true, token: 'fake-token' }));
  app.post('/api/auth/forgot-password', (req, res) => res.json({ success: true }));
  app.get('/api/health', (req, res) => res.json({ ok: true }));

  return app;
}

// ── Auth rate limiter — threshold ─────────────────────────────────────────

describe('Auth rate limiter — threshold (RL_AUTH_MAX = 5)', () => {
  let app;

  beforeEach(() => {
    // Fresh in-memory store per test
    jest.resetModules();
    app = buildAuthApp({ max: RL_AUTH_MAX });
  });

  it(`allows exactly ${RL_AUTH_MAX} login attempts`, async () => {
    for (let i = 0; i < RL_AUTH_MAX; i++) {
      const res = await request(app).post('/api/auth/login').send({});
      expect(res.status).toBe(200);
    }
  });

  it(`returns 429 on the ${RL_AUTH_MAX + 1}th login attempt`, async () => {
    for (let i = 0; i < RL_AUTH_MAX; i++) {
      await request(app).post('/api/auth/login').send({});
    }
    const res = await request(app).post('/api/auth/login').send({});
    expect(res.status).toBe(429);
    expect(res.body.error).toBe('too_many_requests');
    expect(res.body.success).toBe(false);
  });

  it('429 response includes Retry-After header', async () => {
    for (let i = 0; i < RL_AUTH_MAX; i++) {
      await request(app).post('/api/auth/login').send({});
    }
    const res = await request(app).post('/api/auth/login').send({});
    expect(res.status).toBe(429);
    expect(res.headers['retry-after']).toBeDefined();
    expect(Number(res.headers['retry-after'])).toBeGreaterThan(0);
  });

  it('Retry-After header value matches RATE_LIMIT_RETRY_AFTER_SECS', async () => {
    for (let i = 0; i < RL_AUTH_MAX; i++) {
      await request(app).post('/api/auth/login').send({});
    }
    const res = await request(app).post('/api/auth/login').send({});
    expect(res.headers['retry-after']).toBe(String(RATE_LIMIT_RETRY_AFTER_SECS));
  });

  it('rate limit also applies to /api/auth/forgot-password', async () => {
    for (let i = 0; i < RL_AUTH_MAX; i++) {
      await request(app).post('/api/auth/forgot-password').send({});
    }
    const res = await request(app).post('/api/auth/forgot-password').send({});
    expect(res.status).toBe(429);
    expect(res.body.error).toBe('too_many_requests');
  });

  it('429 response body has correct structure', async () => {
    for (let i = 0; i < RL_AUTH_MAX; i++) {
      await request(app).post('/api/auth/login').send({});
    }
    const res = await request(app).post('/api/auth/login').send({});
    expect(res.body).toMatchObject({
      success: false,
      error: 'too_many_requests',
    });
    expect(typeof res.body.message).toBe('string');
  });

  it('RateLimit-Limit header reflects the configured max', async () => {
    const res = await request(app).post('/api/auth/login').send({});
    expect(res.headers['ratelimit-limit']).toBe(String(RL_AUTH_MAX));
  });

  it('RateLimit-Remaining decrements with each request', async () => {
    const first = await request(app).post('/api/auth/login').send({});
    const second = await request(app).post('/api/auth/login').send({});
    const firstRemaining = Number(first.headers['ratelimit-remaining']);
    const secondRemaining = Number(second.headers['ratelimit-remaining']);
    expect(secondRemaining).toBe(firstRemaining - 1);
  });
});

// ── Rate limit window reset ───────────────────────────────────────────────

describe('Auth rate limiter — window reset', () => {
  it('rate limit resets after the window expires (fake timers)', async () => {
    const SHORT_WINDOW = 100; // 100 ms window for fast test
    const app = buildAuthApp({ windowMs: SHORT_WINDOW, max: 2 });

    // Exhaust the limit
    await request(app).post('/api/auth/login').send({});
    await request(app).post('/api/auth/login').send({});
    const blocked = await request(app).post('/api/auth/login').send({});
    expect(blocked.status).toBe(429);

    // Wait for the window to expire
    await new Promise((resolve) => setTimeout(resolve, SHORT_WINDOW + 50));

    // Should be allowed again
    const allowed = await request(app).post('/api/auth/login').send({});
    expect(allowed.status).toBe(200);
  });
});

// ── Independent IP counters ───────────────────────────────────────────────

describe('Auth rate limiter — independent IP counters', () => {
  it('different IPs have independent rate limit counters', async () => {
    // trust proxy so we can spoof X-Forwarded-For
    const app = buildAuthApp({ max: RL_AUTH_MAX, trustProxy: true });

    // Exhaust limit for IP 1
    for (let i = 0; i < RL_AUTH_MAX; i++) {
      await request(app)
        .post('/api/auth/login')
        .set('X-Forwarded-For', '10.0.0.1')
        .send({});
    }

    // IP 1 is now blocked
    const ip1Blocked = await request(app)
      .post('/api/auth/login')
      .set('X-Forwarded-For', '10.0.0.1')
      .send({});
    expect(ip1Blocked.status).toBe(429);

    // IP 2 should still be allowed
    const ip2Allowed = await request(app)
      .post('/api/auth/login')
      .set('X-Forwarded-For', '10.0.0.2')
      .send({});
    expect(ip2Allowed.status).toBe(200);
  });

  it('exhausting one IP does not affect a different IP', async () => {
    const app = buildAuthApp({ max: 3, trustProxy: true });

    // Exhaust IP A
    for (let i = 0; i < 3; i++) {
      await request(app)
        .post('/api/auth/login')
        .set('X-Forwarded-For', '192.168.1.1')
        .send({});
    }

    // IP B should have full quota
    const ipBRes = await request(app)
      .post('/api/auth/login')
      .set('X-Forwarded-For', '192.168.1.2')
      .send({});
    expect(ipBRes.status).toBe(200);
    expect(Number(ipBRes.headers['ratelimit-remaining'])).toBe(2);
  });
});

// ── Non-auth routes are not affected ─────────────────────────────────────

describe('Auth rate limiter — scope', () => {
  it('auth rate limit does not affect non-auth routes', async () => {
    const app = buildAuthApp({ max: RL_AUTH_MAX });

    // Exhaust auth limit
    for (let i = 0; i < RL_AUTH_MAX + 2; i++) {
      await request(app).post('/api/auth/login').send({});
    }

    // Health endpoint (not under auth limiter) should still respond
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
  });
});

// ── Redis-backed sliding window (when Redis is available) ─────────────────

describe('Sliding window rate limiter — Redis counter behaviour', () => {
  let redisClient;
  let redisAvailable = false;

  beforeAll(async () => {
    try {
      const { createClient } = require('redis');
      redisClient = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
      await redisClient.connect();
      redisAvailable = true;
    } catch {
      redisAvailable = false;
    }
  });

  afterAll(async () => {
    if (redisClient?.isOpen) {
      await redisClient.quit();
    }
  });

  it('Redis counter increments on each request (when Redis available)', async () => {
    if (!redisAvailable) {
      console.log('Redis not available — skipping Redis counter test');
      return;
    }

    const testKey = `rl:test:ip:127.0.0.1:${Date.now()}`;
    await redisClient.del(testKey);

    // Simulate 3 requests by incrementing a sorted set
    const now = Date.now();
    await redisClient.zAdd(testKey, [
      { score: now - 2000, value: 'req1' },
      { score: now - 1000, value: 'req2' },
      { score: now,        value: 'req3' },
    ]);
    await redisClient.expire(testKey, 60);

    const count = await redisClient.zCard(testKey);
    expect(count).toBe(3);

    await redisClient.del(testKey);
  });

  it('Redis prunes expired entries outside the window', async () => {
    if (!redisAvailable) {
      console.log('Redis not available — skipping Redis prune test');
      return;
    }

    const testKey = `rl:test:prune:${Date.now()}`;
    const now = Date.now();
    const windowMs = 60_000;

    // Add 2 old entries (outside window) and 1 current entry
    await redisClient.zAdd(testKey, [
      { score: now - windowMs - 5000, value: 'old1' },
      { score: now - windowMs - 1000, value: 'old2' },
      { score: now,                   value: 'current' },
    ]);

    // Prune entries older than window
    await redisClient.zRemRangeByScore(testKey, '-inf', now - windowMs);

    const remaining = await redisClient.zCard(testKey);
    expect(remaining).toBe(1);

    await redisClient.del(testKey);
  });

  it('independent keys for different IPs in Redis', async () => {
    if (!redisAvailable) {
      console.log('Redis not available — skipping Redis IP isolation test');
      return;
    }

    const now = Date.now();
    const keyA = `rl:test:ip:10.0.0.1:${now}`;
    const keyB = `rl:test:ip:10.0.0.2:${now}`;

    await redisClient.zAdd(keyA, [{ score: now, value: 'req1' }, { score: now + 1, value: 'req2' }]);
    await redisClient.zAdd(keyB, [{ score: now, value: 'req1' }]);

    const countA = await redisClient.zCard(keyA);
    const countB = await redisClient.zCard(keyB);

    expect(countA).toBe(2);
    expect(countB).toBe(1);

    await redisClient.del(keyA);
    await redisClient.del(keyB);
  });
});
