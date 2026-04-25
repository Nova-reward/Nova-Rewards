# Requirements Document

## Introduction

The Circuit Breaker feature adds resilience to the Nova-Rewards backend by wrapping all external service calls (Stellar/Horizon blockchain API, Redis, PostgreSQL, email via SMTP/SendGrid, and smart contract event listeners) with a circuit breaker pattern. When an external dependency experiences repeated failures, the circuit opens and subsequent calls fail fast with a configurable fallback response, preventing cascading failures and reducing latency. The circuit periodically allows probe requests through (half-open state) to detect recovery. Retry logic with exponential backoff and per-call timeout enforcement are included. All circuit state transitions and call outcomes are exposed as Prometheus metrics via the existing `prom-client` registry.

## Glossary

- **Circuit_Breaker**: A stateful wrapper around an external service call that transitions between Closed, Open, and Half-Open states based on observed failure rates.
- **Closed_State**: The normal operating state; calls pass through to the external service and failures are counted.
- **Open_State**: The tripped state; calls fail immediately without reaching the external service and the configured fallback is returned.
- **Half_Open_State**: The recovery-probe state; a limited number of probe calls are allowed through to test whether the external service has recovered.
- **Failure_Threshold**: The number of consecutive failures within a rolling window that causes the Circuit_Breaker to transition from Closed_State to Open_State.
- **Reset_Timeout**: The duration the Circuit_Breaker remains in Open_State before transitioning to Half_Open_State.
- **Probe_Count**: The maximum number of concurrent calls allowed through in Half_Open_State.
- **Fallback**: A pre-configured response or function returned to callers when the Circuit_Breaker is in Open_State or when all retries are exhausted.
- **Retry_Policy**: Configuration specifying the maximum number of retry attempts and the base delay used to compute exponential backoff.
- **Exponential_Backoff**: A retry delay strategy where each successive delay is `base_delay * 2^(attempt - 1)`, optionally with jitter.
- **Call_Timeout**: The maximum wall-clock time allowed for a single external service call before it is aborted and counted as a failure.
- **Circuit_Breaker_Registry**: A singleton that holds named Circuit_Breaker instances, one per protected service.
- **Protected_Service**: Any of the five external dependencies: Stellar_Horizon, Redis, PostgreSQL, Email, Contract_Event_Listener.
- **Stellar_Horizon**: The Horizon REST API accessed via `stellar-sdk` for reward distribution and trustline verification.
- **Metrics_Collector**: The existing `prom-client` registry (`metricsMiddleware.js`) extended with circuit-breaker counters and gauges.

## Requirements

### Requirement 1: Circuit Breaker State Machine

**User Story:** As a backend engineer, I want each external service call wrapped in a circuit breaker with well-defined state transitions, so that repeated failures do not cascade through the system.

#### Acceptance Criteria

1. THE Circuit_Breaker SHALL maintain exactly one of three states at any time: Closed_State, Open_State, or Half_Open_State.
2. WHEN the number of consecutive failures within the rolling window reaches the Failure_Threshold, THE Circuit_Breaker SHALL transition from Closed_State to Open_State.
3. WHEN the Reset_Timeout elapses after entering Open_State, THE Circuit_Breaker SHALL transition from Open_State to Half_Open_State.
4. WHEN a probe call in Half_Open_State succeeds, THE Circuit_Breaker SHALL transition from Half_Open_State to Closed_State and reset the failure counter to zero.
5. WHEN a probe call in Half_Open_State fails, THE Circuit_Breaker SHALL transition from Half_Open_State back to Open_State and restart the Reset_Timeout.
6. WHEN the Circuit_Breaker is in Closed_State and a call succeeds, THE Circuit_Breaker SHALL reset the consecutive failure counter to zero.

---

### Requirement 2: Configurable Thresholds

**User Story:** As a backend engineer, I want each circuit breaker to have independently configurable thresholds, so that I can tune resilience behaviour per service without redeploying.

#### Acceptance Criteria

1. THE Circuit_Breaker_Registry SHALL accept a configuration object per named Circuit_Breaker containing at minimum: `failureThreshold` (integer ≥ 1), `resetTimeout` (milliseconds ≥ 100), `probeCount` (integer ≥ 1), `callTimeout` (milliseconds ≥ 1), and `retryPolicy` (`{ maxAttempts: integer ≥ 0, baseDelayMs: integer ≥ 0 }`).
2. WHERE a per-service configuration value is absent, THE Circuit_Breaker_Registry SHALL apply a default configuration: `failureThreshold = 5`, `resetTimeout = 30000`, `probeCount = 1`, `callTimeout = 5000`, `retryPolicy = { maxAttempts: 3, baseDelayMs: 200 }`.
3. THE Circuit_Breaker_Registry SHALL allow configuration values to be supplied via environment variables using the naming convention `CB_<SERVICE_NAME>_<PARAM>` (e.g. `CB_STELLAR_FAILURE_THRESHOLD`).
4. IF a configuration value is outside its valid range, THEN THE Circuit_Breaker_Registry SHALL throw a descriptive `RangeError` at initialisation time.

---

### Requirement 3: Fallback Mechanisms

**User Story:** As a backend engineer, I want each circuit breaker to return a meaningful fallback when the circuit is open, so that callers receive a predictable response instead of hanging or crashing.

#### Acceptance Criteria

1. WHEN the Circuit_Breaker is in Open_State and a call is attempted, THE Circuit_Breaker SHALL invoke the registered Fallback without calling the external service.
2. THE Circuit_Breaker SHALL support two fallback types: a static value and an async function that receives the original call arguments.
3. IF no Fallback is registered and the Circuit_Breaker is in Open_State, THEN THE Circuit_Breaker SHALL throw an error with code `CIRCUIT_OPEN`.
4. WHEN the Fallback function itself throws, THE Circuit_Breaker SHALL propagate the fallback error to the caller without altering circuit state.
5. THE Stellar_Horizon Circuit_Breaker SHALL have a Fallback that returns `{ success: false, error: 'stellar_unavailable', retryAfter: <reset_timeout_ms> }`.
6. THE Redis Circuit_Breaker SHALL have a Fallback that returns `null` for cache-read operations and a no-op success for cache-write operations.
7. THE PostgreSQL Circuit_Breaker SHALL have a Fallback that throws an error with code `DB_UNAVAILABLE` so that route handlers return HTTP 503.
8. THE Email Circuit_Breaker SHALL have a Fallback that enqueues the email payload to a Redis list `email:retry_queue` for deferred delivery.

---

### Requirement 4: Retry Logic with Exponential Backoff

**User Story:** As a backend engineer, I want transient failures to be retried automatically with exponential backoff, so that brief network hiccups do not immediately trip the circuit breaker.

#### Acceptance Criteria

1. WHEN a call fails and the Circuit_Breaker is in Closed_State, THE Circuit_Breaker SHALL retry the call up to `retryPolicy.maxAttempts` additional times before recording a failure against the Failure_Threshold.
2. THE Circuit_Breaker SHALL wait `retryPolicy.baseDelayMs * 2^(attempt - 1)` milliseconds between retry attempts (exponential backoff).
3. WHERE `retryPolicy.maxAttempts` is zero, THE Circuit_Breaker SHALL not retry and SHALL record the failure immediately.
4. WHEN all retry attempts are exhausted without success, THE Circuit_Breaker SHALL increment the consecutive failure counter by one and invoke the Fallback.
5. THE Circuit_Breaker SHALL add a random jitter of up to 20% of the computed backoff delay to each retry interval to reduce thundering-herd effects.
6. IF the Call_Timeout elapses during a retry attempt, THEN THE Circuit_Breaker SHALL abort that attempt, count it as a failure, and proceed to the next retry or record the failure.

---

### Requirement 5: Timeout Handling

**User Story:** As a backend engineer, I want each external call to be bounded by a configurable timeout, so that slow dependencies do not exhaust the Node.js event loop or connection pools.

#### Acceptance Criteria

1. WHEN a call to a Protected_Service is initiated, THE Circuit_Breaker SHALL enforce the configured Call_Timeout using `Promise.race` between the call and a timeout rejection.
2. WHEN the Call_Timeout elapses before the call resolves, THE Circuit_Breaker SHALL reject with an error of code `CALL_TIMEOUT` and treat the call as a failure.
3. THE Circuit_Breaker SHALL cancel any pending I/O associated with a timed-out call where the underlying client supports cancellation (e.g. AbortController for fetch-based calls).
4. WHILE the Circuit_Breaker is in Half_Open_State, THE Circuit_Breaker SHALL apply the same Call_Timeout to probe calls as to normal calls.

---

### Requirement 6: Per-Service Circuit Breaker Instances

**User Story:** As a backend engineer, I want a dedicated circuit breaker for each external dependency, so that a failure in one service does not affect the availability of others.

#### Acceptance Criteria

1. THE Circuit_Breaker_Registry SHALL provide a named Circuit_Breaker instance for each of the following services: `stellar`, `redis`, `postgres`, `email`, `contract-events`.
2. WHEN `distributeRewards` or `verifyTrustline` in the Stellar/Horizon integration is called, THE Circuit_Breaker for `stellar` SHALL wrap the outbound Horizon API call.
3. WHEN any Redis `GET`, `SET`, `DEL`, or `EXPIRE` operation is performed via `lib/redis.js`, THE Circuit_Breaker for `redis` SHALL wrap the operation.
4. WHEN any PostgreSQL query is executed via `db/index.js`, THE Circuit_Breaker for `postgres` SHALL wrap the `query` call.
5. WHEN `sendEmail` in `emailService.js` dispatches to SendGrid or SMTP, THE Circuit_Breaker for `email` SHALL wrap the outbound call.
6. WHEN the contract event polling loop in `contractEventService.js` calls the Horizon events endpoint, THE Circuit_Breaker for `contract-events` SHALL wrap the call.
7. IF the `stellar` Circuit_Breaker is in Open_State, THEN the `/api/rewards/distribute` and `/api/trustline` routes SHALL return HTTP 503 with the Stellar Fallback response.
8. IF the `postgres` Circuit_Breaker is in Open_State, THEN all routes that perform database queries SHALL return HTTP 503.

---

### Requirement 7: Metrics and Observability

**User Story:** As a site reliability engineer, I want circuit breaker state and call outcomes exposed as Prometheus metrics, so that I can alert on open circuits and track failure rates.

#### Acceptance Criteria

1. THE Metrics_Collector SHALL register a Prometheus gauge `circuit_breaker_state` with labels `{ service }` where the value is `0` for Closed_State, `1` for Half_Open_State, and `2` for Open_State.
2. THE Metrics_Collector SHALL register a Prometheus counter `circuit_breaker_calls_total` with labels `{ service, outcome }` where `outcome` is one of `success`, `failure`, `fallback`, `timeout`, `rejected`.
3. WHEN a Circuit_Breaker transitions between states, THE Metrics_Collector SHALL update the `circuit_breaker_state` gauge for that service immediately.
4. WHEN a call outcome is determined (success, failure, fallback invocation, timeout, or open-circuit rejection), THE Metrics_Collector SHALL increment `circuit_breaker_calls_total` with the appropriate labels.
5. THE Metrics_Collector SHALL register a Prometheus histogram `circuit_breaker_call_duration_seconds` with labels `{ service }` to record the latency of calls that reach the external service (not fallbacks).
6. THE Metrics_Collector SHALL use the existing `registry` instance from `metricsMiddleware.js` so that all metrics are exposed on the existing `/metrics` endpoint.

---

### Requirement 8: Circuit Breaker Initialisation and Lifecycle

**User Story:** As a backend engineer, I want the circuit breaker registry to initialise at server startup and shut down cleanly, so that no calls bypass protection and no resources are leaked.

#### Acceptance Criteria

1. THE Circuit_Breaker_Registry SHALL be initialised before any route handler or service that calls a Protected_Service is registered.
2. WHEN `server.js` starts, THE Circuit_Breaker_Registry SHALL log the name, state, and configuration of each registered Circuit_Breaker.
3. WHEN the process receives `SIGTERM` or `SIGINT`, THE Circuit_Breaker_Registry SHALL flush any pending timers and log final state for each Circuit_Breaker.
4. THE Circuit_Breaker_Registry SHALL expose a `getState(serviceName)` method that returns the current state and failure count for a named Circuit_Breaker.
5. THE Circuit_Breaker_Registry SHALL expose a `reset(serviceName)` method that forces a named Circuit_Breaker back to Closed_State and resets all counters, for use in administrative endpoints and tests.

---

### Requirement 9: Error Propagation and Logging

**User Story:** As a backend engineer, I want circuit breaker errors to be clearly distinguishable in logs and API responses, so that operators can diagnose failures quickly.

#### Acceptance Criteria

1. WHEN the Circuit_Breaker rejects a call due to Open_State, THE Circuit_Breaker SHALL attach `{ code: 'CIRCUIT_OPEN', service: <name>, retryAfter: <ms> }` to the thrown error.
2. WHEN the Circuit_Breaker rejects a call due to timeout, THE Circuit_Breaker SHALL attach `{ code: 'CALL_TIMEOUT', service: <name>, durationMs: <elapsed> }` to the thrown error.
3. WHEN a state transition occurs, THE Circuit_Breaker SHALL emit a structured log entry at `warn` level containing `{ event: 'circuit_state_change', service, fromState, toState, failureCount, timestamp }`.
4. IF a route handler receives a `CIRCUIT_OPEN` or `DB_UNAVAILABLE` error, THEN THE route handler SHALL return HTTP 503 with body `{ success: false, error: <code>, message: <human-readable>, retryAfter: <ms> }`.
5. THE Circuit_Breaker SHALL not log individual call payloads or response bodies to avoid leaking sensitive data such as wallet addresses or email content.
