# ADR 0010: Redis Multi-Layer Caching Strategy

## Status

Accepted

## Context

Several read paths in Nova Rewards are expensive or latency-sensitive:

- **Leaderboard rankings** require a ranked aggregate query across all users,
  which is O(n log n) and grows with the user base.
- **Rate limiting** needs sub-millisecond counter increments on every request
  across all API endpoints.
- **JWT revocation** needs a fast lookup on every authenticated request to check
  whether a token has been invalidated.
- **Refresh token rotation** needs atomic read-then-delete semantics to prevent
  replay.
- **Session and feature-flag data** benefit from a fast in-memory store to avoid
  repeated database round-trips.

Considered options:

1. **In-process memory cache (node-cache, lru-cache)** — zero latency, but not
   shared across multiple backend instances and lost on restart.
2. **PostgreSQL materialized views** — durable and queryable, but refresh is
   expensive and not real-time; adds write load to the primary.
3. **Redis** — shared across all backend instances, supports TTL-based
   expiration, atomic operations (INCR, SETNX, sorted sets), Lua scripting for
   sliding-window rate limits, and pub/sub for real-time invalidation.
4. **Memcached** — fast key-value cache, but lacks sorted sets, Lua scripting,
   persistence, and pub/sub needed by the platform.

## Decision

Use Redis as the single shared cache layer with distinct key namespaces and TTL
policies per use case:

| Use case | Key pattern | TTL | Invalidation |
|---|---|---|---|
| Leaderboard rankings | `leaderboard:<period>` | 300 s (5 min) | Overwritten by cache warmer job |
| JWT revocation blocklist | `blocklist:<jti>` | Token remaining lifetime | Automatic (TTL expiry) |
| Refresh token store | `refresh:<jti>` | 7 days | Consumed (deleted) on use |
| Rate limit counters (fixed-window) | `rl:<scope>:<ip>` | Window duration | Automatic (TTL expiry) |
| Rate limit counters (sliding-window) | `sw:<scope>:<key>` | Window duration | Atomic Lua sorted-set trim |
| Feature flags | `ff:<flag>` | Configurable | Manual or TTL |

The Redis client (`ioredis`) connects via `REDIS_URL`. In production the URL
uses the `rediss://` scheme, which enables TLS automatically for ElastiCache
in-transit encryption. The client degrades gracefully: if `REDIS_URL` is unset,
the application falls back to in-memory rate limiting and skips cache writes,
allowing local development without a Redis instance.

The leaderboard cache is populated by the `leaderboardCacheWarmer` background
job (BullMQ repeatable, every 5 minutes) rather than on-demand to avoid cache
stampedes under load. The current user's rank is always resolved live from
PostgreSQL because it is personalised and cannot be shared across users.

## Consequences

Positive:

- Leaderboard reads are O(1) cache hits instead of O(n log n) database queries.
- Rate limit counters are atomic and consistent across all backend replicas.
- JWT revocation is fast and does not require a database lookup on every request.
- TTL-based expiry means stale entries are cleaned up automatically without
  explicit invalidation logic for most use cases.
- Graceful degradation allows local development without Redis.

Negative:

- Cache invalidation for leaderboard mutations (e.g., manual point adjustments)
  must be triggered explicitly or waited out until the next warmer cycle.
- Redis memory must be monitored; `maxmemory-policy` must be set to `noeviction`
  or `volatile-lru` to prevent silent eviction of blocklist or rate-limit keys.
- If Redis is unavailable, revocation checks fail open: revoked tokens remain
  accepted until Redis recovers.
- The sliding-window Lua script must be tested for correctness under concurrent
  load.

## Related

- Code: `novaRewards/backend/cache/redisClient.js`
- Code: `novaRewards/backend/lib/redis.js`
- Code: `novaRewards/backend/middleware/rateLimiter.js`
- Code: `novaRewards/backend/middleware/slidingRateLimiter.js`
- Code: `novaRewards/backend/services/tokenService.js`
- Code: `novaRewards/backend/jobs/leaderboardCacheWarmer.js`
- ADR: [0002 — PostgreSQL and Redis](0002-postgresql-system-of-record-with-redis-operational-cache.md)
- ADR: [0007 — JWT RS256 Authentication Strategy](0007-jwt-rs256-authentication-strategy.md)
- ADR: [0009 — BullMQ Redis Job Queue](0009-bullmq-redis-job-queue.md)
