# Implementation Plan: Circuit Breaker

## Overview

Implement a from-scratch circuit breaker resilience layer for the Nova-Rewards backend in Node.js. The implementation introduces `lib/circuitBreaker.js` (core state machine) and `lib/circuitBreakerRegistry.js` (singleton registry), then integrates them into the five protected call sites: Stellar/Horizon, Redis, PostgreSQL, Email, and contract event polling. Prometheus metrics are wired into the existing `prom-client` registry. All 19 correctness properties are covered by property-based tests using `fast-check`.

## Tasks

- [ ] 1. Implement `lib/circuitBreaker.js` — core state machine
  - [ ] 1.1 Create `lib/circuitBreaker.js` with the `CircuitBreaker` class
    - Define internal state fields: `_state` (`'CLOSED'|'OPEN'|'HALF_OPEN'`), `_failureCount`, `_resetTimer`, `_probeInFlight`, `_fallback`
    - Implement `constructor(name, config, metrics)` — store name, config, metrics refs; set initial state to `CLOSED`
    - Implement `setFallback(value)` — accepts static value or async function
    - Implement `getState()` — returns `{ state, failureCount, config }`
    - Implement `reset()` — forces `CLOSED`, zeroes `_failureCount`, clears `_resetTimer`
    - _Requirements: 1.1, 8.4, 8.5_

  - [ ] 1.2 Implement `_transitionTo(newState)` private helper
    - Update `_state`, emit structured `warn` log with `{ event: 'circuit_state_change', service, fromState, toState, failureCount, timestamp }`
    - Update the `circuit_breaker_state` Prometheus gauge immediately (`0`=CLOSED, `1`=HALF_OPEN, `2`=OPEN)
    - _Requirements: 7.3, 9.3_

  - [ ] 1.3 Implement `_callWithTimeout(fn, args)` private helper
    - Use `Promise.race` between `fn(...args)` and a timeout `Promise` that rejects after `config.callTimeout` ms
    - Timeout rejection must carry `{ code: 'CALL_TIMEOUT', service: name, durationMs: config.callTimeout }`
    - _Requirements: 5.1, 5.2, 9.2_

  - [ ] 1.4 Implement `_executeWithRetry(fn, args)` private helper
    - Loop `0..retryPolicy.maxAttempts` calling `_callWithTimeout`; on failure compute delay `baseDelayMs * 2^attempt` plus up to 20% random jitter; `await sleep(delay)` before next attempt
    - When `maxAttempts === 0` do not retry — record failure immediately
    - After all attempts exhausted, throw the last error
    - _Requirements: 4.1, 4.2, 4.3, 4.5, 4.6_

  - [ ] 1.5 Implement `fire(fn, ...args)` public method — state-machine dispatch
    - **OPEN**: increment `rejected` counter; invoke fallback if registered, else throw `CircuitOpenError` (`{ code: 'CIRCUIT_OPEN', service, retryAfter: config.resetTimeout }`)
    - **HALF_OPEN**: if `_probeInFlight >= config.probeCount` reject immediately; else increment `_probeInFlight`, call `_executeWithRetry`, on success → `_transitionTo('CLOSED')` + reset counters; on failure → `_transitionTo('OPEN')` + restart reset timer; always decrement `_probeInFlight`
    - **CLOSED**: call `_executeWithRetry`; on success → reset `_failureCount` to 0, increment `success` counter; on failure → increment `_failureCount`, increment `failure` counter; if `_failureCount >= config.failureThreshold` → `_transitionTo('OPEN')` + start reset timer
    - Record `circuit_breaker_call_duration_seconds` histogram for calls that reach the external service (not fallbacks)
    - Increment `circuit_breaker_calls_total` with appropriate `outcome` label for every path
    - _Requirements: 1.2, 1.3, 1.4, 1.5, 1.6, 3.1, 3.3, 3.4, 5.4, 7.2, 7.4, 7.5, 9.1_

  - [ ]* 1.6 Write property tests for CircuitBreaker state machine (Properties 1–6, 8–12, 15–18)
    - **Property 1**: state is always one of `CLOSED`, `OPEN`, `HALF_OPEN` — never any other value
    - **Property 2**: after exactly `failureThreshold` consecutive failures state is `OPEN`
    - **Property 4**: successful probe in `HALF_OPEN` → state `CLOSED`, `failureCount === 0`
    - **Property 5**: failed probe in `HALF_OPEN` → state returns to `OPEN`
    - **Property 6**: successful call in `CLOSED` with non-zero failure count → `failureCount === 0`
    - **Property 8**: `fire()` in `OPEN` with fallback invokes fallback and does not call `fn`
    - **Property 9**: throwing fallback propagates error; state remains `OPEN`
    - **Property 10**: always-failing fn called exactly `maxAttempts + 1` times before failure recorded
    - **Property 11**: retry delay for attempt A is in range `[B*2^(A-1), B*2^(A-1)*1.2]`
    - **Property 12**: never-resolving fn rejects with `code === 'CALL_TIMEOUT'`, correct `service` and `durationMs`
    - **Property 15**: `getState()` always reflects actual internal state and failure count
    - **Property 16**: `reset()` from any state → `CLOSED`, `failureCount === 0`
    - **Property 17**: open-circuit rejection error has `code`, `service`, and numeric `retryAfter`
    - **Property 18**: timeout rejection error has `code`, `service`, and numeric `durationMs`
    - File: `tests/circuitBreakerProperties.test.js`
    - _Requirements: 1.1–1.6, 3.1, 3.4, 4.1, 4.2, 4.5, 5.1, 5.2, 8.4, 8.5, 9.1, 9.2_

- [ ] 2. Implement `lib/circuitBreakerRegistry.js` — singleton registry
  - [ ] 2.1 Create `lib/circuitBreakerRegistry.js` with `CircuitBreakerRegistry` class
    - Define default config: `{ failureThreshold: 5, resetTimeout: 30000, probeCount: 1, callTimeout: 5000, retryPolicy: { maxAttempts: 3, baseDelayMs: 200 } }`
    - Implement `_resolveConfig(serviceName, overrides)` — merge defaults → env vars (`CB_<SERVICE>_<PARAM>`) → per-service overrides; parse env var names using `SERVICE_NAME.toUpperCase().replace(/-/g, '_')`
    - Implement `_validateConfig(name, config)` — throw descriptive `RangeError` if any value is out of range (`failureThreshold < 1`, `resetTimeout < 100`, `probeCount < 1`, `callTimeout < 1`, `maxAttempts < 0`, `baseDelayMs < 0`)
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [ ] 2.2 Implement `init(overrides = {})` method
    - Register three Prometheus metrics on the existing `registry` from `metricsMiddleware.js`: `circuit_breaker_state` (Gauge, label `service`), `circuit_breaker_calls_total` (Counter, labels `service, outcome`), `circuit_breaker_call_duration_seconds` (Histogram, label `service`)
    - Instantiate five `CircuitBreaker` instances: `stellar`, `redis`, `postgres`, `email`, `contract-events`; store in internal `Map`
    - Register per-service fallbacks (see design fallback table)
    - Log name, state, and config for each circuit breaker at startup
    - Wire `SIGTERM` and `SIGINT` handlers: clear all reset timers, log final state for each CB
    - _Requirements: 3.5, 3.6, 3.7, 3.8, 7.1, 7.5, 7.6, 8.1, 8.2, 8.3_

  - [ ] 2.3 Implement `get(name)`, `getState(name)`, and `reset(name)` methods
    - `get(name)` — return the named `CircuitBreaker` instance; throw if name unknown
    - `getState(name)` — delegate to `cb.getState()`
    - `reset(name)` — delegate to `cb.reset()`
    - Export as singleton: `module.exports = new CircuitBreakerRegistry()`
    - _Requirements: 8.4, 8.5_

  - [ ]* 2.4 Write unit tests for registry config resolution and lifecycle
    - Test default config values applied when no overrides or env vars present
    - Test env var resolution for each param using `CB_<SERVICE>_<PARAM>` naming
    - Test `RangeError` thrown for each out-of-range config value
    - Test `SIGTERM`/`SIGINT` handler clears timers and logs final state
    - File: `tests/circuitBreakerRegistry.test.js`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 8.2, 8.3_

  - [ ]* 2.5 Write property test for config validation (Property 7)
    - **Property 7**: any config with at least one out-of-range value throws `RangeError` at `init()`
    - File: `tests/circuitBreakerProperties.test.js`
    - _Requirements: 2.4_

- [ ] 3. Checkpoint — core library complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Integrate circuit breaker into Prometheus metrics
  - [ ] 4.1 Verify metrics registration in `metricsMiddleware.js`
    - Confirm the existing `registry` export is used by `circuitBreakerRegistry.init()` — no changes to `metricsMiddleware.js` itself are needed; the registry imports it
    - Confirm `circuit_breaker_state`, `circuit_breaker_calls_total`, and `circuit_breaker_call_duration_seconds` appear in `/metrics` output after `init()` is called
    - _Requirements: 7.1, 7.2, 7.5, 7.6_

  - [ ]* 4.2 Write unit tests for metrics registration
    - Test that all three metrics are registered on the existing `registry` after `init()`
    - Test that state gauge updates immediately on each state transition
    - Test that `calls_total` counter increments with correct `outcome` label for each outcome type
    - File: `tests/circuitBreakerMetrics.test.js`
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [ ]* 4.3 Write property tests for metrics correctness (Properties 13–14)
    - **Property 13**: `circuit_breaker_state` gauge equals `0/1/2` matching `CLOSED/HALF_OPEN/OPEN` after every transition
    - **Property 14**: `circuit_breaker_calls_total` increments by exactly 1 per call outcome
    - File: `tests/circuitBreakerProperties.test.js`
    - _Requirements: 7.3, 7.4_

- [ ] 5. Integrate circuit breaker into `db/index.js` (postgres)
  - [ ] 5.1 Modify `db/index.js` to wrap `pool.query` with the `postgres` circuit breaker
    - `require` the registry singleton at the top of the file
    - In the `query(text, params)` function, replace `pool.query(text, params)` with `registry.get('postgres').fire(() => pool.query(text, params))`
    - The public `query` API is unchanged; callers receive `DB_UNAVAILABLE` error when circuit is open
    - _Requirements: 6.1, 6.4, 6.8_

  - [ ]* 5.2 Write unit tests for postgres circuit breaker integration
    - Test that `query()` delegates to the `postgres` circuit breaker
    - Test that a `DB_UNAVAILABLE` error propagates when the circuit is open
    - File: `tests/circuitBreaker.test.js`
    - _Requirements: 6.4, 6.8, 3.7_

- [ ] 6. Integrate circuit breaker into `lib/redis.js` (redis)
  - [ ] 6.1 Modify `lib/redis.js` to wrap Redis operations with the `redis` circuit breaker
    - Add named wrapper functions `get(key)`, `set(key, value, options)`, `del(key)`, `expire(key, seconds)` that each call `registry.get('redis').fire(() => client.<op>(...))` 
    - Export the new wrapper functions alongside the existing `client` and `connectRedis` exports
    - The `redis` fallback (returns `null` for reads, no-op for writes) is registered in the registry — no per-call fallback needed here
    - _Requirements: 6.1, 6.3_

  - [ ]* 6.2 Write unit tests for redis circuit breaker integration
    - Test that each wrapper function (`get`, `set`, `del`, `expire`) delegates to the `redis` circuit breaker
    - Test that `null` is returned for a read when the circuit is open
    - File: `tests/circuitBreaker.test.js`
    - _Requirements: 6.3, 3.6_

- [ ] 7. Integrate circuit breaker into `blockchain/sendRewards.js` and `blockchain/trustline.js` (stellar)
  - [ ] 7.1 Modify `blockchain/sendRewards.js` to wrap the Horizon submit call
    - `require` the registry: `const registry = require('../backend/lib/circuitBreakerRegistry')`
    - Wrap `server.submitTransaction(transaction)` inside `distributeRewards`: `await registry.get('stellar').fire(() => server.submitTransaction(transaction))`
    - _Requirements: 6.1, 6.2_

  - [ ] 7.2 Modify `blockchain/trustline.js` to wrap Horizon account-load calls
    - Wrap `server.loadAccount(walletAddress)` in `verifyTrustline` with `registry.get('stellar').fire(() => server.loadAccount(walletAddress))`
    - Wrap `server.loadAccount(walletAddress)` in `buildTrustlineXDR` with the same pattern
    - _Requirements: 6.1, 6.2_

  - [ ]* 7.3 Write unit tests for stellar circuit breaker integration
    - Test that `distributeRewards` delegates the submit call to the `stellar` circuit breaker
    - Test that `verifyTrustline` delegates the account-load call to the `stellar` circuit breaker
    - File: `tests/circuitBreaker.test.js`
    - _Requirements: 6.2_

- [ ] 8. Integrate circuit breaker into `services/emailService.js` (email)
  - [ ] 8.1 Modify `services/emailService.js` to wrap the outbound send call
    - In `sendEmail`, wrap the SendGrid `fetch(...)` call and the `smtpTransporter.sendMail(...)` call with `registry.get('email').fire(() => <send call>)`
    - The `email` fallback (enqueue to `email:retry_queue` via `client.lPush`) is registered in the registry
    - _Requirements: 6.1, 6.5, 3.8_

  - [ ]* 8.2 Write unit tests for email circuit breaker fallback
    - Test that when the `email` circuit is open, the payload is enqueued to `email:retry_queue`
    - File: `tests/circuitBreakerFallbacks.test.js`
    - _Requirements: 6.5, 3.8_

- [ ] 9. Integrate circuit breaker into `services/contractEventService.js` (contract-events)
  - [ ] 9.1 Modify `services/contractEventService.js` to wrap the Horizon events poll call
    - In `pollForEvents`, wrap the Horizon events fetch inside the `setInterval` callback with `registry.get('contract-events').fire(() => <horizon fetch>)`
    - The `contract-events` fallback (log warning, return `[]`) is registered in the registry
    - _Requirements: 6.1, 6.6_

  - [ ]* 9.2 Write unit tests for contract-events circuit breaker integration
    - Test that the polling call is wrapped by the `contract-events` circuit breaker
    - Test that `[]` is returned and a warning is logged when the circuit is open
    - File: `tests/circuitBreaker.test.js`
    - _Requirements: 6.6_

- [ ] 10. Checkpoint — all call sites integrated
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 11. Wire registry initialisation into `server.js`
  - [ ] 11.1 Modify `server.js` to initialise the registry before routes are registered
    - Add `const registry = require('./lib/circuitBreakerRegistry')` near the top of `server.js`, after `metricsMiddleware` is imported
    - Call `registry.init()` immediately after `metricsMiddleware` is set up and before any `app.use('/api/...')` route registration
    - _Requirements: 8.1, 8.2_

  - [ ]* 11.2 Write unit tests for server startup order
    - Test that `registry.init()` is called before any route handler that uses a protected service
    - File: `tests/circuitBreakerRegistry.test.js`
    - _Requirements: 8.1_

- [ ] 12. Add HTTP 503 handling in route handlers for circuit-open errors
  - [ ] 12.1 Update `routes/rewards.js` to catch `CIRCUIT_OPEN` and `DB_UNAVAILABLE` errors
    - In the `POST /distribute` handler catch block, check `err.code === 'CIRCUIT_OPEN' || err.code === 'DB_UNAVAILABLE'` and return `res.status(503).json({ success: false, error: err.code, message: 'Service temporarily unavailable', retryAfter: err.retryAfter ?? 30000 })`
    - _Requirements: 6.7, 9.4_

  - [ ] 12.2 Update `routes/trustline.js` to catch `CIRCUIT_OPEN` errors
    - In the `verify` and `build-xdr` handlers (or the router-level error handler), check for `CIRCUIT_OPEN` and return HTTP 503 with the standard body
    - _Requirements: 6.7, 9.4_

  - [ ] 12.3 Update the global error handler in `server.js` to handle `CIRCUIT_OPEN` and `DB_UNAVAILABLE`
    - In the global `app.use((err, req, res, _next) => ...)` handler, add a check: if `err.code === 'CIRCUIT_OPEN' || err.code === 'DB_UNAVAILABLE'`, respond with HTTP 503 and the standard body
    - This acts as a safety net for any route that does not catch circuit errors explicitly
    - _Requirements: 9.4_

  - [ ]* 12.4 Write integration tests for HTTP 503 responses
    - Test `POST /api/rewards/distribute` returns 503 with correct body when `stellar` circuit is open
    - Test `POST /api/trustline/verify` returns 503 with correct body when `stellar` circuit is open
    - Test any DB-backed route returns 503 when `postgres` circuit is open
    - File: `tests/circuitBreakerRoutes.test.js`
    - _Requirements: 6.7, 6.8, 9.4_

- [ ] 13. Write service-specific fallback unit tests
  - [ ]* 13.1 Write unit tests for all per-service fallbacks
    - Test `stellar` fallback returns `{ success: false, error: 'stellar_unavailable', retryAfter: <resetTimeout> }`
    - Test `redis` fallback returns `null` for a read operation and `undefined` (no-op) for a write
    - Test `postgres` fallback throws an error with `code === 'DB_UNAVAILABLE'`
    - Test `email` fallback enqueues payload to `email:retry_queue` via `client.lPush`
    - Test `contract-events` fallback returns `[]`
    - File: `tests/circuitBreakerFallbacks.test.js`
    - _Requirements: 3.5, 3.6, 3.7, 3.8_

- [ ] 14. Final checkpoint — full integration complete
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Property tests use `fast-check` (`^3.23.2`, already in `devDependencies`) with `numRuns: 100`
- Each property test file must include the tag comment: `// Feature: circuit-breaker, Property <N>: <text>`
- The registry singleton is initialised once in `server.js`; tests that need a fresh instance should call `registry.init(overrides)` with test-specific config overrides
- No new npm packages are required
- The `blockchain/` directory is at `Nova-Rewards/novaRewards/blockchain/` — registry require path from there is `'../backend/lib/circuitBreakerRegistry'`
