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
const {
  RATE_LIMIT_WINDOW_MS,
  RATE_LIMIT_RETRY_AFTER_SECS,
  RL_GLOBAL_MAX,
  RL_AUTH_MAX,
  RATE_LIMIT_ROUTES,
} = require('../config/constants');

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
  res.setHeader('Retry-After', String(RATE_LIMIT_RETRY_AFTER_SECS));
  res.status(429).json({
    success: false,
    error:   'too_many_requests',
    message: `Rate limit exceeded. Please retry after ${RATE_LIMIT_RETRY_AFTER_SECS} seconds.`,
  });
}

// ---------------------------------------------------------------------------
// Fixed-window limiters (kept for backward compatibility)
// ---------------------------------------------------------------------------

const globalLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: RL_GLOBAL_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  skip,
  store: makeStore('rl:global:'),
  handler: onLimitReached,
});

const authLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: RL_AUTH_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  skip,
  store: makeStore('rl:auth:'),
  handler: onLimitReached,
});

// ---------------------------------------------------------------------------
// Sliding-window limiters — built from the per-route configuration matrix
// (config/constants.js → RATE_LIMIT_ROUTES). No limits are hardcoded here.
// ---------------------------------------------------------------------------

/**
 * Resolves a route's effective `max`, honouring an optional env override so
 * ops can retune a single route's limit without a code change or redeploy.
 *
 * @param {{ max: number, envMax?: string }} route
 * @returns {number}
 */
function resolveMax({ max, envMax }) {
  const override = envMax ? parseInt(process.env[envMax], 10) : NaN;
  return Number.isNaN(override) ? max : override;
}

/**
 * Instantiates a sliding-window limiter from a matrix entry, mapping the
 * declarative config onto the factory's options.
 *
 * @param {string} routeName  key in RATE_LIMIT_ROUTES
 * @returns {import('express').RequestHandler}
 */
function buildSlidingLimiter(routeName) {
  const route = RATE_LIMIT_ROUTES[routeName];
  if (!route) {
    throw new Error(`[rateLimiter] unknown rate-limit route: ${routeName}`);
  }
  return slidingRateLimiter({
    prefix:   route.prefix,
    windowMs: route.windowMs,
    max:      resolveMax(route),
    keyBy:    route.identifierStrategy,
    message:  route.message,
  });
}

const slidingGlobal        = buildSlidingLimiter('global');
const slidingAuth          = buildSlidingLimiter('auth');
const slidingUser          = buildSlidingLimiter('user');
const slidingSearch        = buildSlidingLimiter('search');
const slidingWebhook       = buildSlidingLimiter('webhook');
/** Webhook limiter keyed by merchant API key (falls back to IP). */
const webhookApiKeyLimiter = buildSlidingLimiter('webhookApiKey');
/** Reward distribution limiter, keyed per merchant (falls back to IP). */
const slidingRewards       = buildSlidingLimiter('rewards');
const slidingAdmin         = buildSlidingLimiter('admin');

// Auth-specific 15-minute-window limiters — Issue #861.
/** Login endpoint: per-IP, longer window. */
const loginLimiter         = buildSlidingLimiter('login');
/** Token refresh endpoint: per-IP, longer window. */
const refreshLimiter       = buildSlidingLimiter('refresh');

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
  // auth-specific (15-minute window)
  loginLimiter,
  refreshLimiter,
};
