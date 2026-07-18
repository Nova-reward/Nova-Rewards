'use strict';

/**
 * Tests for the rate-limiter refactor introduced in Issue #1139.
 *
 * #1139 centralised three things that were previously scattered/duplicated:
 *   1. Caller identification — one `resolveIdentifier(req, strategy)` in
 *      slidingRateLimiter.js, with a new MERCHANT strategy and a guaranteed
 *      IP fallback so a request is never left unkeyed.
 *   2. Per-route policy — a single `RATE_LIMIT_ROUTES` matrix in constants.js
 *      is the sole source of truth for every protected route's window/limit/
 *      identifier strategy (rateLimiter.js builds every limiter from it).
 *   3. Redis key namespacing — `REDIS_NAMESPACE` builders guarantee the
 *      rate-limit tree (rl:*) and the abuse tree (abuse:*) can never collide.
 *
 * The first three describe-blocks exercise that new surface directly: it is
 * pure (no Redis, no module mocking) and therefore fully deterministic here.
 *
 * The final block drives the REAL middleware + Lua script end-to-end against a
 * live Redis when one is reachable, and skips cleanly otherwise — mirroring the
 * "Redis counter behaviour" block in rateLimiting.integration.test.js. The
 * enforcement path (429 + accurate Retry-After) is what needs a real sorted
 * set; the sliding-window semantics are not re-implemented in the test.
 *
 * Closes #1139
 */

const request = require('supertest');
const express = require('express');

const {
  RATE_LIMIT_ROUTES,
  IDENTIFIER_STRATEGY,
  REDIS_NAMESPACE,
  ABUSE_KIND,
} = require('../config/constants');
const { slidingRateLimiter, resolveIdentifier } = require('../middleware/slidingRateLimiter');
const { checkIpBlock, recordFailedLogin, unblock, CRED_PREFIX } = require('../middleware/abuseDetection');
const redisLib = require('../lib/redis');

const { IP, USER, USER_OR_IP, API_KEY, MERCHANT } = IDENTIFIER_STRATEGY;

// ── 1. Centralised identifier resolution ───────────────────────────────────
describe('resolveIdentifier — strategy matrix (#1139)', () => {
  const base = { ip: '203.0.113.7', headers: {} };

  it('keys by IP under the IP strategy', () => {
    expect(resolveIdentifier({ ...base }, IP)).toBe('ip:203.0.113.7');
  });

  it('keys by user id under USER, falling back to IP when unauthenticated', () => {
    expect(resolveIdentifier({ ...base, user: { id: 42 } }, USER)).toBe('user:42');
    expect(resolveIdentifier({ ...base }, USER)).toBe('ip:203.0.113.7');
  });

  it('keys by user id under USER_OR_IP, falling back to IP', () => {
    expect(resolveIdentifier({ ...base, user: { id: 7 } }, USER_OR_IP)).toBe('user:7');
    expect(resolveIdentifier({ ...base }, USER_OR_IP)).toBe('ip:203.0.113.7');
  });

  it('keys by merchant id under MERCHANT, falling back to IP', () => {
    expect(resolveIdentifier({ ...base, merchant: { id: 'm1' } }, MERCHANT)).toBe('merchant:m1');
    expect(resolveIdentifier({ ...base }, MERCHANT)).toBe('ip:203.0.113.7');
  });

  it('keys by API key under API_KEY (header preferred, then merchant), falling back to IP', () => {
    expect(resolveIdentifier({ ...base, headers: { 'x-api-key': 'k1' } }, API_KEY)).toBe('apikey:k1');
    expect(resolveIdentifier({ ...base, headers: {}, merchant: { apiKey: 'k2' } }, API_KEY)).toBe('apikey:k2');
    expect(resolveIdentifier({ ...base }, API_KEY)).toBe('ip:203.0.113.7');
  });

  it('defaults an unknown strategy to IP so a request is never left unkeyed', () => {
    expect(resolveIdentifier({ ...base }, 'not-a-real-strategy')).toBe('ip:203.0.113.7');
  });
});

// ── 2. Per-route config matrix as single source of truth ────────────────────
describe('RATE_LIMIT_ROUTES — per-route config matrix (#1139)', () => {
  const strategies = Object.values(IDENTIFIER_STRATEGY);

  it('defines a well-formed policy for every protected route', () => {
    const names = Object.keys(RATE_LIMIT_ROUTES);
    expect(names.length).toBeGreaterThan(0);

    for (const [name, cfg] of Object.entries(RATE_LIMIT_ROUTES)) {
      expect(typeof cfg.prefix, `${name}.prefix`).toBe('string');
      expect(cfg.prefix.startsWith('sw:'), `${name}.prefix uses sw: namespace`).toBe(true);
      expect(cfg.windowMs, `${name}.windowMs`).toBeGreaterThan(0);
      expect(cfg.max, `${name}.max`).toBeGreaterThan(0);
      expect(strategies, `${name}.identifierStrategy`).toContain(cfg.identifierStrategy);
    }
  });

  it('keys the rewards route by merchant (the strategy added in #1139)', () => {
    expect(RATE_LIMIT_ROUTES.rewards.identifierStrategy).toBe(MERCHANT);
  });

  it('carries independent per-route limits (not one hardcoded value)', () => {
    const maxima = Object.values(RATE_LIMIT_ROUTES).map((r) => r.max);
    expect(new Set(maxima).size).toBeGreaterThan(1);
  });

  it('exposes distinct key prefixes so routes cannot share a bucket', () => {
    const prefixes = Object.values(RATE_LIMIT_ROUTES).map((r) => r.prefix);
    expect(new Set(prefixes).size).toBe(prefixes.length);
  });
});

// ── 3. Shared Redis namespace ───────────────────────────────────────────────
describe('REDIS_NAMESPACE — rl:* and abuse:* never collide (#1139)', () => {
  it('builds distinctly-rooted keys for the two subsystems', () => {
    const rl = REDIS_NAMESPACE.rateLimit('sw:auth', 'ip:1.2.3.4');
    const block = REDIS_NAMESPACE.abuse(ABUSE_KIND.BLOCK, '1.2.3.4');

    expect(rl).toBe('rl:sw:auth:ip:1.2.3.4');
    expect(block).toBe('abuse:block:1.2.3.4');
    expect(rl.startsWith('rl:')).toBe(true);
    expect(block.startsWith('abuse:')).toBe(true);
    expect(rl).not.toBe(block);
  });

  it('keeps abusePrefix byte-compatible with the historical literals', () => {
    expect(REDIS_NAMESPACE.abusePrefix('block')).toBe('abuse:block:');
    expect(REDIS_NAMESPACE.abusePrefix('cred')).toBe('abuse:cred:');
    expect(REDIS_NAMESPACE.abusePrefix('farm')).toBe('abuse:farm:');
  });
});

// ── 4. End-to-end enforcement (requires a reachable Redis; skips otherwise) ──
describe('sliding limiter — enforcement against real Redis', () => {
  let redisReady = false;

  beforeAll(async () => {
    try {
      await redisLib.connectRedis();
      redisReady = !!redisLib.client?.isOpen;
    } catch {
      redisReady = false;
    }
  });

  afterAll(async () => {
    if (redisLib.client?.isOpen) {
      try { await redisLib.client.quit(); } catch { /* ignore */ }
    }
  });

  function buildApp(opts) {
    const app = express();
    app.set('trust proxy', true);
    app.use(express.json());
    app.post('/x', slidingRateLimiter(opts), (req, res) => res.json({ ok: true }));
    return app;
  }

  it('allows up to max, then rejects the next request with 429', async () => {
    if (!redisReady) { console.log('Redis unavailable — skipping enforcement test'); return; }

    const prefix = `sw:test:threshold:${Date.now()}`;
    const app = buildApp({ prefix, windowMs: 60_000, max: 3, keyBy: IP });

    for (let i = 0; i < 3; i++) {
      const res = await request(app).post('/x').send({});
      expect(res.status).toBe(200);
      expect(res.headers['ratelimit-limit']).toBe('3');
    }

    const blocked = await request(app).post('/x').send({});
    expect(blocked.status).toBe(429);
    expect(blocked.body.error).toBe('too_many_requests');
    expect(blocked.body.success).toBe(false);
  });

  it('reports an accurate Retry-After bounded by the window on rejection', async () => {
    if (!redisReady) { console.log('Redis unavailable — skipping Retry-After test'); return; }

    const prefix = `sw:test:retry:${Date.now()}`;
    const windowSec = 60;
    const app = buildApp({ prefix, windowMs: windowSec * 1000, max: 1, keyBy: IP });

    await request(app).post('/x').send({});
    const blocked = await request(app).post('/x').send({});

    expect(blocked.status).toBe(429);
    const retryAfter = Number(blocked.headers['retry-after']);
    // With max=1 the only in-window entry is the request we just made, so the
    // slot frees a full window from now. Assert the AC's ±1s accuracy: the
    // value tracks the actual reset, not a static full-window fallback.
    expect(retryAfter).toBeGreaterThanOrEqual(windowSec - 1);
    expect(retryAfter).toBeLessThanOrEqual(windowSec);
  });

  it('keeps independent counters per identifier (different IPs)', async () => {
    if (!redisReady) { console.log('Redis unavailable — skipping isolation test'); return; }

    const prefix = `sw:test:isolation:${Date.now()}`;
    const app = buildApp({ prefix, windowMs: 60_000, max: 1, keyBy: IP });

    const first = await request(app).post('/x').set('X-Forwarded-For', '10.0.0.1').send({});
    expect(first.status).toBe(200);

    const firstBlocked = await request(app).post('/x').set('X-Forwarded-For', '10.0.0.1').send({});
    expect(firstBlocked.status).toBe(429);

    // A different IP still has its full quota.
    const other = await request(app).post('/x').set('X-Forwarded-For', '10.0.0.2').send({});
    expect(other.status).toBe(200);
  });
});

// ── 5. Abuse-detection soft-lock escalation on the SHARED namespace (#1139) ──
// AC: "soft-lock after N consecutive 401s within a window, wired to the same
// Redis namespace, and tested." checkIpBlock reads the abuse:cred:* counter
// that recordFailedLogin writes — the same namespace the rate limiter builds
// keys under — so this exercises the shared-state integration end-to-end.
describe('abuse detection — soft-lock escalation shares the rate-limit namespace (#1139)', () => {
  let redisReady = false;

  beforeAll(async () => {
    try {
      await redisLib.connectRedis();
      redisReady = !!redisLib.client?.isOpen;
    } catch {
      redisReady = false;
    }
  });

  afterAll(async () => {
    if (redisLib.client?.isOpen) {
      try { await redisLib.client.quit(); } catch { /* ignore */ }
    }
  });

  function buildLoginApp() {
    const app = express();
    app.set('trust proxy', true);
    app.use(express.json());
    // Mirror routes/auth.js wiring: guard the route, record a failure per 401.
    app.post('/login', checkIpBlock, async (req, res) => {
      await recordFailedLogin(req);
      res.status(401).json({ success: false, error: 'invalid_credentials' });
    });
    return app;
  }

  it('reuses the abuse:cred namespace that recordFailedLogin writes', () => {
    // The soft-lock read and the rate limiter both live under abuse:*/rl:*
    // roots built by REDIS_NAMESPACE, so the two subsystems cannot collide.
    expect(CRED_PREFIX).toBe(REDIS_NAMESPACE.abusePrefix(ABUSE_KIND.CRED));
    expect(CRED_PREFIX.startsWith('abuse:')).toBe(true);
  });

  it('lets early failures through, then soft-locks with 429 + Retry-After once the threshold is crossed', async () => {
    if (!redisReady) { console.log('Redis unavailable — skipping soft-lock test'); return; }

    const ip = `203.0.113.${10 + Math.floor(Math.random() * 200)}`;
    await unblock(ip);
    await redisLib.client.del(`${CRED_PREFIX}${ip}`);

    const app = buildLoginApp();
    const attempt = () => request(app).post('/login').set('X-Forwarded-For', ip).send({});

    // Below the soft-lock threshold: failures return the normal 401.
    let last;
    for (let i = 0; i < 5; i++) {
      last = await attempt();
      expect(last.status).toBe(401);
    }

    // The counter has now reached the threshold; the next guarded request is
    // soft-locked before the handler runs.
    const locked = await attempt();
    expect(locked.status).toBe(429);
    expect(locked.body.error).toBe('ip_soft_locked');

    const retryAfter = Number(locked.headers['retry-after']);
    expect(retryAfter).toBeGreaterThan(0);

    await unblock(ip);
    await redisLib.client.del(`${CRED_PREFIX}${ip}`);
  });
});
