const Redis = require('ioredis');

let client = null;

/**
 * Returns a singleton ioredis client connected to ElastiCache.
 *
 * REDIS_URL format expected: rediss://:<auth_token>@<host>:6379
 * The "rediss://" scheme enables TLS, satisfying in-transit encryption.
 *
 * If REDIS_URL is not set the function returns null so the app can
 * degrade gracefully (in-memory rate limiting, no caching) during
 * local development without Redis.
 *
 * @returns {import('ioredis').Redis | null}
 */
function getRedisClient() {
  if (client) return client;
  if (!process.env.REDIS_URL) return null;

  client = new Redis(process.env.REDIS_URL, {
    // ioredis enables TLS automatically when the scheme is rediss://
    // No explicit tls:{} needed — adding it alongside rediss:// causes conflicts
    enableReadyCheck: true,
    maxRetriesPerRequest: 3,
    retryStrategy: (times) => Math.min(times * 100, 3000),
  });

  client.on('error', (err) => {
    console.error('[redis] connection error:', err.message);
  });

  client.on('ready', () => {
    console.log('[redis] connected to ElastiCache');
  });

  return client;
}

module.exports = { getRedisClient };
