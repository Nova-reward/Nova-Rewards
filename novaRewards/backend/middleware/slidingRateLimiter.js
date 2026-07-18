const logger = require('../lib/logger');
/**
 * Sliding Window Rate Limiter
 *
 * Uses a Redis sorted set per key:
 *   - Key:    rl:<prefix>:<identifier>
 *   - Member: <uuid> (unique per request)
 *   - Score:  request timestamp (ms)
 *
 * On each request:
 *   1. Remove all members older than (now - windowMs)   → prune expired
 *   2. Count remaining members                          → current usage
 *   3. If count >= max → reject with 429
 *   4. Otherwise add current request and set key TTL
 *
 * All four steps run in a single Lua script for atomicity.
 *
 * Headers returned (aligned with the RateLimit header draft-6):
 *   RateLimit-Limit     — max requests in window
 *   RateLimit-Remaining — requests left
 *   RateLimit-Reset     — Unix timestamp (seconds) when window resets
 *   Retry-After         — seconds to wait (only on 429), derived from the
 *                         oldest in-window request so it reflects the true
 *                         time until a slot frees up (accurate to ±1s)
 */

const { randomUUID } = require('crypto');
const { client: redisClient } = require('../lib/redis');
const { IDENTIFIER_STRATEGY, REDIS_NAMESPACE } = require('../config/constants');

// Lua script — atomic prune + count + conditional insert
const SLIDING_WINDOW_SCRIPT = `
local key      = KEYS[1]
local now      = tonumber(ARGV[1])
local window   = tonumber(ARGV[2])
local max      = tonumber(ARGV[3])
local uuid     = ARGV[4]
local ttl      = tonumber(ARGV[5])

-- Remove requests outside the current window
redis.call('ZREMRANGEBYSCORE', key, '-inf', now - window)

-- Count requests in window
local count = redis.call('ZCARD', key)

if count >= max then
  -- Return current count without adding (rejected)
  return {count, 0}
end

-- Add this request
redis.call('ZADD', key, now, uuid)
redis.call('PEXPIRE', key, ttl)

return {count + 1, 1}
`;

// IPs exempt from all rate limiting
const WHITELIST = (process.env.RATE_LIMIT_WHITELIST || '')
  .split(',')
  .map((ip) => ip.trim())
  .filter(Boolean);

const { IP, USER, USER_OR_IP, API_KEY, MERCHANT } = IDENTIFIER_STRATEGY;

/**
 * Derives the rate-limit identifier for a request under the given strategy.
 * Every strategy falls back to the client IP so a request is never left
 * unkeyed (which would let it dodge the limit entirely).
 *
 * @param {import('express').Request} req
 * @param {string} strategy  one of IDENTIFIER_STRATEGY
 * @returns {string} `<scope>:<value>` — the identifier segment of the Redis key
 */
function resolveIdentifier(req, strategy) {
  const byIp = `ip:${req.ip}`;

  switch (strategy) {
    case USER:
      return req.user?.id ? `user:${req.user.id}` : byIp;
    case USER_OR_IP:
      return req.user?.id ? `user:${req.user.id}` : byIp;
    case MERCHANT:
      return req.merchant?.id ? `merchant:${req.merchant.id}` : byIp;
    case API_KEY: {
      const apiKey = req.headers['x-api-key'] || req.merchant?.apiKey;
      return apiKey ? `apikey:${apiKey}` : byIp;
    }
    case IP:
    default:
      return byIp;
  }
}

/**
 * Computes an accurate Retry-After (seconds) for a rejected request.
 *
 * A slot frees up when the oldest request still inside the window ages out, so
 * `retryAfter = (oldestScore + windowMs) - now`. This is read with a single
 * ZRANGE on the reject path only — the Lua script is intentionally left
 * untouched. Falls back to the full window when the bucket can't be read.
 *
 * @returns {Promise<number>} seconds to wait, clamped to [1, ceil(windowMs/1000)]
 */
async function computeRetryAfter(key, windowMs, now, fallbackSec) {
  try {
    // Rank 0 = lowest score = oldest request still inside the window.
    const oldest = await redisClient.zRangeWithScores(key, 0, 0);
    const oldestScore = Array.isArray(oldest) && oldest.length
      ? Number(oldest[0].score)
      : null;

    if (oldestScore == null || Number.isNaN(oldestScore)) return fallbackSec;

    const msUntilFree = oldestScore + windowMs - now;
    const secUntilFree = Math.ceil(msUntilFree / 1000);
    return Math.min(fallbackSec, Math.max(1, secUntilFree));
  } catch {
    return fallbackSec;
  }
}

/**
 * Factory — returns an Express middleware that enforces a sliding window limit.
 *
 * @param {{
 *   prefix:    string,   — unique key prefix, e.g. 'sw:global', 'sw:auth'
 *   windowMs:  number,   — window size in milliseconds
 *   max:       number,   — max requests per window
 *   keyBy?:    string,   — one of IDENTIFIER_STRATEGY (default: 'ip')
 *   message?:  string,
 * }} opts
 */
function slidingRateLimiter({ prefix, windowMs, max, keyBy = IP, message }) {
  const windowSec = Math.ceil(windowMs / 1000);

  return async function rateLimitMiddleware(req, res, next) {
    // Whitelist bypass
    if (WHITELIST.includes(req.ip)) return next();

    const identifier = resolveIdentifier(req, keyBy);
    const key = REDIS_NAMESPACE.rateLimit(prefix, identifier);
    const now = Date.now();

    // Fall back to in-memory if Redis is not connected (e.g. tests)
    if (!redisClient.isOpen) return next();

    try {
      const [current, allowed] = await redisClient.eval(
        SLIDING_WINDOW_SCRIPT,
        { keys: [key], arguments: [String(now), String(windowMs), String(max), randomUUID(), String(windowMs + 1000)] }
      );

      const remaining = Math.max(0, max - Number(current));

      if (!Number(allowed)) {
        // Reject: report when the oldest in-window request ages out so the
        // client is told the real wait, not a static full-window value.
        const retryAfterSec = await computeRetryAfter(key, windowMs, now, windowSec);
        res.setHeader('RateLimit-Limit',     max);
        res.setHeader('RateLimit-Remaining', 0);
        res.setHeader('RateLimit-Reset',     Math.ceil(now / 1000) + retryAfterSec);
        res.setHeader('RateLimit-Policy',    `${max};w=${windowSec}`);
        res.setHeader('Retry-After',         retryAfterSec);
        return res.status(429).json({
          success: false,
          error:   'too_many_requests',
          message: message || `Rate limit exceeded. Retry after ${retryAfterSec} seconds.`,
        });
      }

      // Allow: standard RateLimit headers (draft-6). Reset is the far edge of
      // the window for a fresh request — the conservative upper bound.
      res.setHeader('RateLimit-Limit',     max);
      res.setHeader('RateLimit-Remaining', remaining);
      res.setHeader('RateLimit-Reset',     Math.ceil(now / 1000) + windowSec);
      res.setHeader('RateLimit-Policy',    `${max};w=${windowSec}`);

      next();
    } catch (err) {
      // Redis error — fail open to avoid blocking legitimate traffic
      logger.error('[slidingRateLimiter] Redis error, failing open:', err.message);
      next();
    }
  };
}

module.exports = { slidingRateLimiter, resolveIdentifier };
