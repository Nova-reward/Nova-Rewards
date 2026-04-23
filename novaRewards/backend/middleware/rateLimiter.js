/**
 * Rate Limiters
 *
 * Fixed-window limiters (express-rate-limit + Redis):
 *   globalLimiter  — 100 req / 60 s per IP  (applied app-wide)
 *   authLimiter    — 5   req / 60 s per IP  (login, forgot-password)
 *
 * Sliding-window limiters (Redis sorted-set, atomic Lua):
 *   slidingGlobal      — 100 req / 60 s  per IP          (fallback global)
 *   slidingAuth        — 5   req / 60 s  per IP          (auth endpoints)
 *   slidingUser        — 200 req / 60 s  per user-or-IP  (authenticated routes)
 *   slidingSearch      — 30  req / 60 s  per user-or-IP  (search endpoints)
 *   slidingWebhook     — 60  req / 60 s  per IP          (webhook endpoints)
 *   slidingRewards     — 20  req / 60 s  per IP          (reward distribution)
 *   slidingAdmin       — 120 req / 60 s  per user        (admin endpoints)
 */

const rateLimit   = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const { client: redisClient } = require('../lib/redis');
const { slidingRateLimiter } = require('./slidingRateLimiter');

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const WHITELIST = (process.env.RATE_LIMIT_WHITELIST || '')
  .split(',')
  .map((ip) => ip.trim())
  .filter(Boolean);

function skip(req) {
  return WHITELIST.includes(req.ip);
}

function makeStore(prefix) {
  if (!redisClient.isOpen) return undefined;
  return new RedisStore({
    sendCommand: (...args) => redisClient.sendCommand(args),
    prefix,
  });
}

function onLimitReached(req, res) {
  res.setHeader('Retry-After', '60');
  res.status(429).json({
    success: false,
    error:   'too_many_requests',
    message: 'Rate limit exceeded. Please retry after 60 seconds.',
  });
}

// ---------------------------------------------------------------------------
// Fixed-window limiters (kept for backward compatibility)
// ---------------------------------------------------------------------------

const globalLimiter = rateLimit({
  windowMs: 60_000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  skip,
  store: makeStore('rl:global:'),
  handler: onLimitReached,
});

const authLimiter = rateLimit({
  windowMs: 60_000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skip,
  store: makeStore('rl:auth:'),
  handler: onLimitReached,
});

// ---------------------------------------------------------------------------
// Sliding-window limiters
// ---------------------------------------------------------------------------

const w = (s) => s * 1000; // seconds → ms helper

const slidingGlobal = slidingRateLimiter({
  prefix:   'sw:global',
  windowMs: w(60),
  max:      parseInt(process.env.RL_GLOBAL_MAX)  || 100,
  keyBy:    'ip',
});

const slidingAuth = slidingRateLimiter({
  prefix:   'sw:auth',
  windowMs: w(60),
  max:      parseInt(process.env.RL_AUTH_MAX)    || 5,
  keyBy:    'ip',
  message:  'Too many authentication attempts. Retry after 60 seconds.',
});

const slidingUser = slidingRateLimiter({
  prefix:   'sw:user',
  windowMs: w(60),
  max:      parseInt(process.env.RL_USER_MAX)    || 200,
  keyBy:    'user-or-ip',
});

const slidingSearch = slidingRateLimiter({
  prefix:   'sw:search',
  windowMs: w(60),
  max:      parseInt(process.env.RL_SEARCH_MAX)  || 30,
  keyBy:    'user-or-ip',
  message:  'Search rate limit exceeded. Retry after 60 seconds.',
});

const slidingWebhook = slidingRateLimiter({
  prefix:   'sw:webhook',
  windowMs: w(60),
  max:      parseInt(process.env.RL_WEBHOOK_MAX) || 60,
  keyBy:    'ip',
});

/**
 * Webhook endpoint limiter keyed by merchant API key.
 * 1000 req/min per API key (env: RL_WEBHOOK_API_KEY_MAX).
 * Falls back to IP if no x-api-key header is present.
 */
const webhookApiKeyLimiter = slidingRateLimiter({
  prefix:   'sw:webhook-apikey',
  windowMs: w(60),
  max:      parseInt(process.env.RL_WEBHOOK_API_KEY_MAX) || 1000,
  keyBy:    'api-key',
});

const slidingRewards = slidingRateLimiter({
  prefix:   'sw:rewards',
  windowMs: w(60),
  max:      parseInt(process.env.RL_REWARDS_MAX) || 20,
  keyBy:    'ip',
});

const slidingAdmin = slidingRateLimiter({
  prefix:   'sw:admin',
  windowMs: w(60),
  max:      parseInt(process.env.RL_ADMIN_MAX)   || 120,
  keyBy:    'user',
});

module.exports = {
  // fixed-window (legacy)
  globalLimiter,
  authLimiter,
  // sliding-window
  slidingGlobal,
  slidingAuth,
  slidingUser,
  slidingSearch,
  slidingWebhook,
  webhookApiKeyLimiter,
  slidingRewards,
  slidingAdmin,
};
