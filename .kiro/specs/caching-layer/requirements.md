# Requirements Document

## Introduction

This feature formalises and extends the Redis caching layer for the Nova-Rewards backend (GitHub issue #358).
The backend already uses Redis for leaderboard caching and rate limiting. This spec covers the full caching
strategy: a unified key-naming convention, per-resource TTL configuration, event-driven cache invalidation,
query-result caching for high-read endpoints, JWT refresh-token revocation tracking, formalised rate-limit
tracking, a cache health monitoring endpoint, and prom-client hit/miss metrics.

The system is a Node.js/Express backend. Redis 4.7.0 is already installed and connected via `lib/redis.js`.
Testing uses Jest + fast-check for property-based tests.

---

## Glossary

- **Cache_Manager**: The module (`lib/cacheManager.js`) that wraps the Redis client and exposes typed
  get/set/del/flush operations with key-naming enforcement and metric recording.
- **Cache_Key**: A string that uniquely identifies a cached value, composed of a namespace prefix, a
  resource type segment, and an identifier segment (e.g. `nova:user:profile:42`).
- **Namespace**: The top-level prefix applied to every Cache_Key managed by the Cache_Manager
  (`nova:` in production, configurable per environment).
- **TTL**: Time-to-live in seconds after which Redis automatically evicts a cached entry.
- **Invalidation_Event**: An application-level event (e.g. a write to the database) that triggers
  explicit deletion of one or more Cache_Keys.
- **Revocation_List**: A Redis set keyed `nova:auth:revoked:<userId>` that stores revoked JWT refresh
  token JTIs for a user.
- **Rate_Limit_Store**: The Redis-backed store used by `express-rate-limit` via `rate-limit-redis`,
  keyed under `rl:global:` and `rl:auth:` prefixes (existing) plus any new limiter prefixes.
- **Cache_Warmer**: A background job that pre-populates cache entries before they are requested.
- **Health_Endpoint**: The HTTP endpoint `GET /api/cache/health` that reports Redis connectivity,
  memory usage, and hit/miss statistics.
- **Metrics_Collector**: The prom-client registry (`middleware/metricsMiddleware.js`) extended with
  cache-specific counters and gauges.
- **Cache_Hit**: A cache read that returns a non-null value from Redis.
- **Cache_Miss**: A cache read that returns null, requiring a database fallback.

---

## Requirements

### Requirement 1: Cache Configuration

**User Story:** As a backend engineer, I want a centralised cache configuration, so that TTLs and key
naming are consistent and easy to change without hunting through individual route files.

#### Acceptance Criteria

1. THE Cache_Manager SHALL enforce a single Namespace prefix (`nova:`) on every Cache_Key it writes
   or reads, rejecting keys that do not begin with the configured Namespace.
2. THE Cache_Manager SHALL define TTL constants for each resource type:
   - `leaderboard` — 300 seconds
   - `campaign` — 600 seconds
   - `user:profile` — 120 seconds
   - `user:tokenBalance` — 30 seconds
   - `merchant` — 600 seconds
   - `drop` — 120 seconds
   - `contractEvent` — 300 seconds
   - `auth:revoked` — 604800 seconds (7 days, matching refresh token lifetime)
3. THE Cache_Manager SHALL construct Cache_Keys using the pattern
   `<namespace>:<resourceType>:<identifier>`, where `identifier` is a non-empty string.
4. IF a caller passes a Cache_Key that does not match the pattern
   `<namespace>:<resourceType>:<identifier>`, THEN THE Cache_Manager SHALL throw a
   `CacheKeyError` before performing any Redis operation.
5. WHERE the environment variable `CACHE_NAMESPACE` is set, THE Cache_Manager SHALL use its value
   as the Namespace prefix instead of the default `nova:`.

---

### Requirement 2: Query Result Caching — High-Read Endpoints

**User Story:** As a backend engineer, I want query results cached for high-read endpoints, so that
repeated reads do not hit the database on every request.

#### Acceptance Criteria

1. WHEN `GET /api/leaderboard` is requested, THE Cache_Manager SHALL return the cached rankings
   for the requested period if a valid Cache_Key exists, without querying the database.
2. WHEN `GET /api/leaderboard` results in a Cache_Miss, THE Cache_Manager SHALL store the
   database result under `nova:leaderboard:<period>` with a TTL of 300 seconds.
3. WHEN `GET /api/campaigns` or `GET /api/campaigns/:merchantId` is requested, THE Cache_Manager
   SHALL return the cached campaign list if a valid Cache_Key exists.
4. WHEN `GET /api/campaigns` results in a Cache_Miss, THE Cache_Manager SHALL store the result
   under `nova:campaign:merchant:<merchantId>` with a TTL of 600 seconds.
5. WHEN `GET /api/users/:id` is requested, THE Cache_Manager SHALL return the cached user profile
   if a valid Cache_Key exists.
6. WHEN `GET /api/users/:id` results in a Cache_Miss, THE Cache_Manager SHALL store the result
   under `nova:user:profile:<userId>` with a TTL of 120 seconds.
7. WHEN `GET /api/users/:id/token-balance` results in a Cache_Miss, THE Cache_Manager SHALL store
   the result under `nova:user:tokenBalance:<userId>` with a TTL of 30 seconds.
8. WHEN `GET /api/drops/eligible` is requested, THE Cache_Manager SHALL return the cached eligible
   drops for the authenticated user if a valid Cache_Key exists.
9. WHEN `GET /api/drops/eligible` results in a Cache_Miss, THE Cache_Manager SHALL store the result
   under `nova:drop:eligible:<userId>` with a TTL of 120 seconds.
10. IF Redis is unavailable during a cache read, THEN THE Cache_Manager SHALL log the error and
    proceed with the database query, returning the result without caching.

---

### Requirement 3: Cache Invalidation Strategy

**User Story:** As a backend engineer, I want a defined invalidation strategy, so that cached data
never serves stale results after a mutation.

#### Acceptance Criteria

1. WHEN a new campaign is created via `POST /api/campaigns`, THE Cache_Manager SHALL delete the
   Cache_Key `nova:campaign:merchant:<merchantId>` for the owning merchant.
2. WHEN a user profile is updated via `PATCH /api/users/:id`, THE Cache_Manager SHALL delete the
   Cache_Key `nova:user:profile:<userId>`.
3. WHEN a user account is deleted via `DELETE /api/users/:id`, THE Cache_Manager SHALL delete the
   Cache_Key `nova:user:profile:<userId>`.
4. WHEN a transaction of type `distribution` is recorded, THE Cache_Manager SHALL delete
   `nova:leaderboard:weekly` and `nova:leaderboard:alltime`.
5. WHEN a drop is claimed via `POST /api/drops/:id/claim`, THE Cache_Manager SHALL delete the
   Cache_Key `nova:drop:eligible:<userId>` for the claiming user.
6. THE Cache_Manager SHALL support a manual flush operation that deletes all Cache_Keys matching a
   given namespace prefix pattern using Redis `SCAN` + `DEL` (not `FLUSHDB`).
7. IF a cache deletion fails due to a Redis error, THEN THE Cache_Manager SHALL log the error and
   allow the originating operation to complete successfully.
8. THE Cache_Manager SHALL rely on Redis TTL-based expiry as the fallback invalidation mechanism
   for all Cache_Keys that are not explicitly invalidated by an Invalidation_Event.

---

### Requirement 4: JWT Refresh Token Revocation

**User Story:** As a security engineer, I want revoked JWT refresh tokens tracked in Redis, so that
logged-out or compromised tokens cannot be reused before they expire.

#### Acceptance Criteria

1. WHEN a user logs out, THE Cache_Manager SHALL add the refresh token's JTI to the Revocation_List
   `nova:auth:revoked:<userId>` with an expiry equal to the token's remaining lifetime in seconds.
2. WHEN a refresh token is presented, THE Cache_Manager SHALL check whether the token's JTI exists
   in `nova:auth:revoked:<userId>` before issuing a new access token.
3. IF the JTI is found in the Revocation_List, THEN THE Cache_Manager SHALL reject the refresh
   request and return HTTP 401.
4. THE Cache_Manager SHALL use Redis `SADD` to add JTIs and `SISMEMBER` to check membership,
   ensuring O(1) lookup regardless of the number of revoked tokens per user.
5. WHEN all refresh tokens for a user are revoked (e.g. password reset), THE Cache_Manager SHALL
   delete the entire Revocation_List key `nova:auth:revoked:<userId>` and recreate it with the
   new set of JTIs.
6. THE Cache_Manager SHALL set the TTL on `nova:auth:revoked:<userId>` to the maximum remaining
   lifetime among all JTIs in the set, so the key self-expires when all tokens have expired.

---

### Requirement 5: Rate Limit Tracking

**User Story:** As a backend engineer, I want rate limit tracking formalised and extended, so that
all limiters use consistent Redis key prefixes and configuration.

#### Acceptance Criteria

1. THE Rate_Limit_Store SHALL use the key prefix `rl:global:` for the global limiter (100 req /
   60 s) and `rl:auth:` for the authentication limiter (5 req / 60 s), matching the existing
   configuration.
2. WHERE a new rate limiter is added, THE Rate_Limit_Store SHALL use a key prefix of the form
   `rl:<limiterName>:` to avoid collisions with other Redis keys.
3. WHEN the Redis client is not connected at module load time, THE Rate_Limit_Store SHALL fall back
   to the in-memory store provided by `express-rate-limit`, logging a warning.
4. WHEN a request exceeds the configured limit, THE Rate_Limit_Store SHALL return HTTP 429 with a
   `Retry-After` header set to the window duration in seconds.
5. THE Rate_Limit_Store SHALL expose the current request count and window reset time via the
   `RateLimit-*` standard response headers (`RateLimit-Limit`, `RateLimit-Remaining`,
   `RateLimit-Reset`).
6. WHERE the environment variable `RATE_LIMIT_WHITELIST` is set, THE Rate_Limit_Store SHALL skip
   rate limiting for the listed IP addresses, matching the existing whitelist behaviour.

---

### Requirement 6: Cache Health Monitoring Endpoint

**User Story:** As an operator, I want a cache health endpoint, so that I can monitor Redis
connectivity and cache efficiency without accessing the Redis CLI.

#### Acceptance Criteria

1. THE Health_Endpoint SHALL respond to `GET /api/cache/health` and return HTTP 200 with a JSON
   body when Redis is connected.
2. THE Health_Endpoint response SHALL include the following fields:
   - `status`: `"ok"` when Redis is connected, `"degraded"` when Redis is unreachable.
   - `connected`: boolean reflecting `redisClient.isOpen`.
   - `memoryUsedBytes`: integer from Redis `INFO memory` (`used_memory`).
   - `memoryPeakBytes`: integer from Redis `INFO memory` (`used_memory_peak`).
   - `uptimeSeconds`: integer from Redis `INFO server` (`uptime_in_seconds`).
   - `hitRate`: float (0–1) computed as `hits / (hits + misses)` from the Metrics_Collector counters.
   - `totalHits`: integer total Cache_Hit count since process start.
   - `totalMisses`: integer total Cache_Miss count since process start.
3. IF Redis is unreachable when `GET /api/cache/health` is called, THEN THE Health_Endpoint SHALL
   return HTTP 200 with `status: "degraded"` and `connected: false`, omitting memory and uptime
   fields.
4. THE Health_Endpoint SHALL be accessible without authentication so that monitoring tools can
   scrape it.
5. IF the Redis `INFO` command fails, THEN THE Health_Endpoint SHALL return `status: "degraded"`
   and include an `error` field with the failure message.

---

### Requirement 7: Cache Hit/Miss Metrics

**User Story:** As an operator, I want cache hit/miss counters exposed via Prometheus, so that I
can alert on low hit rates and track caching effectiveness over time.

#### Acceptance Criteria

1. THE Metrics_Collector SHALL register a `cache_hits_total` counter with label `resource` (e.g.
   `leaderboard`, `campaign`, `user_profile`) in the existing prom-client registry.
2. THE Metrics_Collector SHALL register a `cache_misses_total` counter with label `resource` in
   the existing prom-client registry.
3. WHEN a Cache_Hit occurs, THE Cache_Manager SHALL increment `cache_hits_total` with the
   appropriate `resource` label.
4. WHEN a Cache_Miss occurs, THE Cache_Manager SHALL increment `cache_misses_total` with the
   appropriate `resource` label.
5. THE Metrics_Collector SHALL register a `cache_operation_duration_seconds` histogram with labels
   `operation` (`get`, `set`, `del`) and `resource`, recording the duration of each Redis call.
6. THE Metrics_Collector SHALL expose all cache metrics via the existing `GET /metrics` endpoint
   alongside the existing HTTP duration histogram.

---

### Requirement 8: Cache Warmer

**User Story:** As a backend engineer, I want the cache warmer extended to cover all cacheable
resources, so that cold-start latency is minimised after a deployment or Redis restart.

#### Acceptance Criteria

1. THE Cache_Warmer SHALL pre-populate `nova:leaderboard:weekly` and `nova:leaderboard:alltime`
   on startup and every 300 seconds, matching the existing `leaderboardCacheWarmer` behaviour.
2. WHEN the Cache_Warmer runs, THE Cache_Manager SHALL use `setEx` with the configured TTL for
   each resource type, overwriting any existing cached value.
3. IF a database query fails during warming, THEN THE Cache_Warmer SHALL log the error and
   continue warming the remaining resources without aborting.
4. THE Cache_Warmer SHALL be idempotent: running it multiple times with the same database state
   SHALL produce identical cached values.

---

### Requirement 9: Correctness Properties (Property-Based Testing)

**User Story:** As a backend engineer, I want property-based tests for the caching layer, so that
correctness invariants are verified across a wide range of inputs using fast-check.

#### Acceptance Criteria

1. FOR ALL valid `(resourceType, identifier)` pairs, THE Cache_Manager SHALL produce a Cache_Key
   that starts with the configured Namespace prefix and contains exactly two `:` separators
   (round-trip key construction property).
2. FOR ALL values `v` written to a Cache_Key `k`, reading `k` before TTL expiry SHALL return a
   value equal to `v` (cache round-trip property: `get(set(k, v)) === v`).
3. FOR ALL Cache_Keys `k`, calling `del(k)` followed by `get(k)` SHALL return null
   (invalidation correctness property).
4. FOR ALL sequences of `set` operations on the same Cache_Key `k`, the final `get(k)` SHALL
   return the value from the last `set` (last-write-wins invariant).
5. FOR ALL users `u` with a revoked JTI `j`, `isRevoked(u, j)` SHALL return `true` regardless of
   the order in which other JTIs were added or removed (Revocation_List membership invariant).
6. FOR ALL valid cache write sequences, the `cache_hits_total` counter SHALL be monotonically
   non-decreasing and SHALL equal the number of observed Cache_Hit events (metrics invariant).
7. FOR ALL valid cache write sequences, the `cache_misses_total` counter SHALL be monotonically
   non-decreasing and SHALL equal the number of observed Cache_Miss events (metrics invariant).
8. FOR ALL Cache_Keys written by the Cache_Warmer with the same database state, running the
   warmer twice SHALL produce identical cached values (idempotence property).
