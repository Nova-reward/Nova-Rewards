const rateLimit = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const { client: redisClient } = require('../lib/redis');

// IPs exempt from all rate limiting (health-check / monitoring)
const WHITELIST = (process.env.RATE_LIMIT_WHITELIST || '')
  .split(',')
  .map((ip) => ip.trim())
  .filter(Boolean);

function skip(req) {
  return WHITELIST.includes(req.ip);
}

/**
 * Returns a RedisStore when the client is connected, otherwise undefined
 * (express-rate-limit falls back to its in-memory store).
 * This prevents a crash at module-load time when Redis is unavailable (e.g. in tests / CI).
 */
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
    error: 'too_many_requests',
    message: 'Rate limit exceeded. Please retry after 60 seconds.',
  });
}

/** Default limiter: 100 req / 60 s — applied globally */
const globalLimiter = rateLimit({
  windowMs: 60_000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  skip,
  store: makeStore('rl:global:'),
  handler: onLimitReached,
});

/** Strict limiter: 5 req / 60 s — applied to auth endpoints */
const authLimiter = rateLimit({
  windowMs: 60_000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skip,
  store: makeStore('rl:auth:'),
  handler: onLimitReached,
});

module.exports = { globalLimiter, authLimiter };
