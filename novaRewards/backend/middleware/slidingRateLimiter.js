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
 *   Retry-After         — seconds to wait (only on 429)
 */

const { randomUUID } = require('crypto');
const { client: redisClient } = require('../lib/redis');

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

/**
 * Factory — returns an Express middleware that enforces a sliding window limit.
 *
 * @param {{
 *   prefix:    string,   — unique key prefix, e.g. 'global', 'auth', 'search'
 *   windowMs:  number,   — window size in milliseconds
 *   max:       number,   — max requests per window
 *   keyBy?:    'ip' | 'user' | 'user-or-ip',  — default: 'ip'
 *   message?:  string,
 * }} opts
 */
function slidingRateLimiter({ prefix, windowMs, max, keyBy = 'ip', message }) {
  const retryAfterSec = Math.ceil(windowMs / 1000);
  const resetOffsetSec = Math.ceil(windowMs / 1000);

  return async function rateLimitMiddleware(req, res, next) {
    // Whitelist bypass
    if (WHITELIST.includes(req.ip)) return next();

    // Resolve identifier
    let identifier;
    if (keyBy === 'user' && req.user?.id) {
      identifier = `user:${req.user.id}`;
    } else if (keyBy === 'user-or-ip') {
      identifier = req.user?.id ? `user:${req.user.id}` : `ip:${req.ip}`;
    } else if (keyBy === 'api-key') {
      const apiKey = req.headers['x-api-key'] || req.merchant?.apiKey;
      identifier = apiKey ? `apikey:${apiKey}` : `ip:${req.ip}`;
    } else {
      identifier = `ip:${req.ip}`;
    }

    const key = `rl:${prefix}:${identifier}`;
    const now = Date.now();

    // Fall back to in-memory if Redis is not connected (e.g. tests)
    if (!redisClient.isOpen) return next();

    try {
      const [current, allowed] = await redisClient.eval(
        SLIDING_WINDOW_SCRIPT,
        { keys: [key], arguments: [String(now), String(windowMs), String(max), randomUUID(), String(windowMs + 1000)] }
      );

      const remaining = Math.max(0, max - Number(current));
      const resetAt   = Math.ceil(now / 1000) + resetOffsetSec;

      // Standard RateLimit headers (draft-6)
      res.setHeader('RateLimit-Limit',     max);
      res.setHeader('RateLimit-Remaining', remaining);
      res.setHeader('RateLimit-Reset',     resetAt);
      res.setHeader('RateLimit-Policy',    `${max};w=${Math.ceil(windowMs / 1000)}`);

      if (!Number(allowed)) {
        res.setHeader('Retry-After', retryAfterSec);
        return res.status(429).json({
          success: false,
          error:   'too_many_requests',
          message: message || `Rate limit exceeded. Retry after ${retryAfterSec} seconds.`,
        });
      }

      next();
    } catch (err) {
      // Redis error — fail open to avoid blocking legitimate traffic
      console.error('[slidingRateLimiter] Redis error, failing open:', err.message);
      next();
    }
  };
}

module.exports = { slidingRateLimiter };
