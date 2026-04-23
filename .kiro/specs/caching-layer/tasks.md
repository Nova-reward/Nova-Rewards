# Implementation Plan: Caching Layer

## Overview

Introduce `lib/cacheKeys.js` and `lib/cacheManager.js` as the single source of truth for all
Redis cache operations, then migrate every ad-hoc `client.get/setEx/del` call across routes,
jobs, and repositories to use the new API. Add JWT refresh-token revocation, a cache health
endpoint, Prometheus metrics, and property-based tests covering all 10 correctness properties.

## Tasks

- [ ] 1. Create `lib/cacheKeys.js` — TTL constants and key-builder functions
  - Export a `TTL` object with constants for all 8 resource types (leaderboard 300 s, campaign
    600 s, userProfile 120 s, userTokenBalance 30 s, merchant 600 s, drop 120 s,
    contractEvent 300 s, authRevoked 604800 s)
  - Export `NAMESPACE` derived from `process.env.CACHE_NAMESPACE || 'nova:'`
  - Export pure key-builder functions: `leaderboardKey(period)`, `campaignKey(merchantId)`,
    `userProfileKey(userId)`, `userTokenBalanceKey(userId)`, `merchantKey(merchantId)`,
    `dropEligibleKey(userId)`, `contractEventKey(id)`, `authRevokedKey(userId)`
  - Each builder returns `${NAMESPACE}<resourceType>:<identifier>`
  - _Requirements: 1.2, 1.3, 1.5_

  - [ ]* 1.1 Write unit tests for `lib/cacheKeys.js`
    - Assert each builder returns the expected fully-qualified key for known inputs
    - Assert all TTL constants match spec values
    - Assert `NAMESPACE` respects `CACHE_NAMESPACE` env var
    - _Requirements: 1.2, 1.3, 1.5_

- [ ] 2. Register cache metrics in `middleware/metricsMiddleware.js`
  - Add `cache_hits_total` Counter with label `resource`
  - Add `cache_misses_total` Counter with label `resource`
  - Add `cache_operation_duration_seconds` Histogram with labels `operation` and `resource`
  - Export all three instruments alongside the existing `registry` and `metricsMiddleware`
  - _Requirements: 7.1, 7.2, 7.5, 7.6_

  - [ ]* 2.1 Write unit tests for new metrics exports
    - Assert the three instruments are registered in the shared registry
    - Assert label names are correct
    - _Requirements: 7.1, 7.2, 7.5_

- [ ] 3. Create `lib/cacheManager.js` — namespace-enforcing Redis wrapper
  - Import `client` from `lib/redis.js` and the three metric instruments from
    `middleware/metricsMiddleware.js`
  - Define `CacheKeyError` class (extends `Error`, name `'CacheKeyError'`)
  - Implement `validateKey(key)` — throws `CacheKeyError` if key does not start with
    `NAMESPACE` or has fewer than two `:` separators after the namespace
  - Implement `cache.get(key, resource)` — validate key, start histogram timer, call
    `client.get`, JSON-parse result, increment hit/miss counter, return value or `null`
    on miss/error
  - Implement `cache.set(key, value, ttlSeconds, resource)` — validate key, start timer,
    call `client.setEx` with `JSON.stringify(value)`, observe histogram
  - Implement `cache.del(key)` — validate key, call `client.del`, log on error (swallow)
  - Implement `cache.flush(namespacePrefix)` — SCAN + DEL loop (never FLUSHDB), log on error
  - Implement `cache.sAdd(key, member, ttlSeconds)` — validate key, call `client.sAdd`,
    then `client.expire` to refresh TTL
  - Implement `cache.sIsMember(key, member)` — validate key, call `client.sIsMember`;
    on Redis error log and **return `true`** (fail-closed for security)
  - Implement `cache.sDeleteKey(key)` — validate key, call `client.del`
  - All methods except `sIsMember` swallow Redis errors (log + return null/false/void)
  - _Requirements: 1.1, 1.3, 1.4, 2.10, 3.6, 3.7, 4.4, 7.3, 7.4, 7.5_

  - [ ]* 3.1 Write unit tests for `lib/cacheManager.js` (mocked Redis client)
    - `get` returns parsed value on hit, `null` on miss, `null` on Redis error
    - `set` calls `setEx` with correct key, TTL, and JSON-stringified value
    - `del` calls `del` on the correct key; swallows Redis error
    - `flush` uses SCAN + DEL, never calls FLUSHDB
    - `sAdd` calls `sAdd` then `expire`; `sIsMember` returns `true` on Redis error (fail-closed)
    - `sDeleteKey` calls `del`
    - `CacheKeyError` thrown for keys missing namespace, empty identifier, or too few separators
    - Hit/miss counters incremented correctly
    - _Requirements: 1.1, 1.4, 2.10, 3.6, 3.7, 4.4, 7.3, 7.4_

- [ ] 4. Checkpoint — core modules complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Refactor `routes/leaderboard.js` — migrate to `cache.get/set`
  - Replace `client.get(cacheKey)` with `cache.get(leaderboardKey(period), 'leaderboard')`
  - Replace `client.setEx(cacheKey, CACHE_TTL, ...)` with
    `cache.set(leaderboardKey(period), rankings, TTL.leaderboard, 'leaderboard')`
  - Remove direct `client` import; import `cache` from `lib/cacheManager.js` and
    `{ leaderboardKey, TTL }` from `lib/cacheKeys.js`
  - _Requirements: 2.1, 2.2_

- [ ] 6. Refactor `jobs/leaderboardCacheWarmer.js` — migrate to `cache.set`
  - Replace `client.setEx(...)` with `cache.set(leaderboardKey(period), rankings, TTL.leaderboard, 'leaderboard')`
  - Remove direct `client` import; import `cache` and key builders
  - _Requirements: 8.1, 8.2, 8.3_

- [ ] 7. Refactor `db/transactionRepository.js` — migrate to `cache.del`
  - Replace `redisClient.del('leaderboard:weekly')` and `redisClient.del('leaderboard:alltime')`
    with `cache.del(leaderboardKey('weekly'))` and `cache.del(leaderboardKey('alltime'))`
  - Remove direct `redisClient` import; import `cache` and `leaderboardKey`
  - _Requirements: 3.4_

- [ ] 8. Update `routes/campaigns.js` — add cache-aside and invalidation
  - `GET /` and `GET /:merchantId`: wrap DB call with cache-aside using
    `campaignKey(merchantId)` and `TTL.campaign`; resource label `'campaign'`
  - `POST /`: after successful `createCampaign`, call `cache.del(campaignKey(merchantId))`
  - Import `cache`, `campaignKey`, `TTL` from the new modules
  - _Requirements: 2.3, 2.4, 3.1_

- [ ] 9. Update `routes/users.js` — cache-aside on GET, invalidation on PATCH/DELETE
  - `GET /:id`: cache-aside with `userProfileKey(userId)`, TTL `TTL.userProfile`,
    resource label `'user_profile'`
  - `GET /:id/token-balance`: replace ad-hoc `redisClient.get/setEx` with
    `cache.get(userTokenBalanceKey(userId), 'user_token_balance')` /
    `cache.set(userTokenBalanceKey(userId), tokenBalance, TTL.userTokenBalance, 'user_token_balance')`
  - `PATCH /:id`: after successful update call `cache.del(userProfileKey(userId))`
  - `DELETE /:id`: after successful soft-delete call `cache.del(userProfileKey(userId))`
  - Remove direct `redisClient` import; import `cache`, key builders, `TTL`
  - _Requirements: 2.5, 2.6, 2.7, 3.2, 3.3_

- [ ] 10. Update `routes/drops.js` — cache-aside on GET eligible, invalidation on claim
  - `GET /eligible`: cache-aside with `dropEligibleKey(req.user.id)`, TTL `TTL.drop`,
    resource label `'drop'`
  - `POST /:id/claim`: after successful claim call `cache.del(dropEligibleKey(req.user.id))`
  - Import `cache`, `dropEligibleKey`, `TTL`
  - _Requirements: 2.8, 2.9, 3.5_

- [ ] 11. Update `routes/auth.js` — add logout revocation and refresh check
  - Add `POST /logout` handler: decode the refresh token to extract `jti` and `userId`,
    compute remaining TTL (`exp - now`), call
    `cache.sAdd(authRevokedKey(userId), jti, remainingTtl)`; return 200
  - Add revocation check to `POST /refresh` (create handler if absent): call
    `cache.sIsMember(authRevokedKey(userId), jti)`; return 401 if `true`
  - Import `cache`, `authRevokedKey`, `TTL` and the existing `tokenService`
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [ ] 12. Checkpoint — route migrations complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 13. Create `routes/cacheHealth.js` — `GET /api/cache/health`
  - No auth middleware
  - When Redis is connected: call `client.info('memory')` and `client.info('server')`,
    parse `used_memory`, `used_memory_peak`, `uptime_in_seconds`; read `totalHits` and
    `totalMisses` from the prom-client counters; compute `hitRate`; return 200 with full schema
  - When Redis is unreachable or `INFO` fails: return 200 with
    `{ status: 'degraded', connected: false, error? }`
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [ ]* 13.1 Write unit tests for `routes/cacheHealth.js`
    - Returns 200 `status: 'ok'` with all fields when Redis is connected
    - Returns 200 `status: 'degraded'` with `connected: false` when Redis is unreachable
    - Returns 200 `status: 'degraded'` with `error` field when `INFO` throws
    - Endpoint requires no auth (assert no 401 on unauthenticated request)
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [ ] 14. Mount cache health route in `server.js`
  - Add `app.use('/api/cache', require('./routes/cacheHealth'))` before the global error handler
  - _Requirements: 6.1, 6.4_

- [ ] 15. Write property-based tests in `tests/cachingLayerProperties.test.js`
  - Use `fast-check` with minimum 100 runs per property
  - Tag each test with `// Feature: caching-layer, Property N: <title>`

  - [ ]* 15.1 Property 1 — Key construction correctness
    - Arbitraries: `fc.string()` filtered to non-empty, no `:` for resourceType and identifier
    - Assert output starts with namespace and matches `<ns><type>:<id>` pattern
    - **Property 1: Key Construction Correctness**
    - **Validates: Requirements 1.1, 1.3, 9.1**

  - [ ]* 15.2 Property 2 — Cache round-trip
    - Arbitraries: valid key string, `fc.jsonValue()` for value; use in-memory Redis stub
    - Assert `get(set(k, v)) deepEqual v`
    - **Property 2: Cache Round-Trip**
    - **Validates: Requirements 2.1–2.9, 9.2**

  - [ ]* 15.3 Property 3 — Invalidation correctness
    - Assert `get(del(set(k, v))) === null`
    - **Property 3: Invalidation Correctness**
    - **Validates: Requirements 3.1–3.5, 9.3**

  - [ ]* 15.4 Property 4 — Last-write-wins
    - Arbitraries: `fc.array(fc.jsonValue(), { minLength: 2 })` for value sequence
    - Assert `get(k)` returns last written value
    - **Property 4: Last-Write-Wins**
    - **Validates: Requirements 9.4**

  - [ ]* 15.5 Property 5 — Revocation membership invariant
    - Arbitraries: `fc.uuid()` for userId, `fc.array(fc.uuid())` for other JTIs, `fc.uuid()` for target JTI
    - Assert `sIsMember` returns `true` for added JTI regardless of insertion order
    - **Property 5: Revocation Membership Invariant**
    - **Validates: Requirements 4.1, 4.2, 9.5**

  - [ ]* 15.6 Property 6 — Revocation set replacement
    - Arbitraries: two `fc.array(fc.uuid(), { minLength: 1 })` for old/new JTI sets
    - After `sDeleteKey` + re-`sAdd` with new set: new JTIs present, old-only JTIs absent
    - **Property 6: Revocation Set Replacement**
    - **Validates: Requirements 4.5**

  - [ ]* 15.7 Property 7 — Namespace flush clears all matching keys
    - Arbitraries: `fc.array` of valid keys under a prefix
    - Assert all keys return `null` after `cache.flush(prefix)`
    - **Property 7: Namespace Flush Clears All Matching Keys**
    - **Validates: Requirements 3.6**

  - [ ]* 15.8 Property 8 — Metrics counter monotonicity
    - Arbitraries: `fc.array(fc.oneof(fc.constant('hit'), fc.constant('miss')))`
    - Assert counters non-decreasing; `totalHits + totalMisses === get call count`
    - **Property 8: Metrics Counter Monotonicity**
    - **Validates: Requirements 7.3, 7.4, 9.6, 9.7**

  - [ ]* 15.9 Property 9 — Cache warmer idempotence
    - Fixed DB mock returning deterministic data
    - Run warmer twice; assert both runs produce identical cached values
    - **Property 9: Cache Warmer Idempotence**
    - **Validates: Requirements 8.4, 9.8**

  - [ ]* 15.10 Property 10 — Invalid key throws CacheKeyError
    - Arbitraries: `fc.string()` filtered to strings missing namespace, empty identifier,
      or fewer than two `:` separators
    - Assert every `cacheManager` method throws `CacheKeyError` synchronously
    - **Property 10: Invalid Key Throws CacheKeyError**
    - **Validates: Requirements 1.4**

- [ ] 16. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- All property tests (15.1–15.10) use an in-memory Map-based Redis stub — no live Redis required
- `sIsMember` is deliberately fail-closed: Redis errors return `true` to deny the refresh request
- `cache.flush` uses SCAN + DEL; FLUSHDB is never called
- Metrics instruments are exported from `metricsMiddleware.js` to avoid circular imports
  (`metricsMiddleware` never imports `cacheManager`)
- Rate-limit keys (`rl:global:`, `rl:auth:`) are managed by `rate-limit-redis` and are not
  touched by `cacheManager`
