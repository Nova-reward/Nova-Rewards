# Implementation Plan: Distributed Tracing

## Overview

Implement end-to-end request observability for the Nova-Rewards backend using only Node.js built-ins (`crypto`, `async_hooks`). New modules are added in `lib/` and `middleware/`; existing call sites receive minimal wrapping via `withSpan`. Completed traces are stored in an in-process ring buffer and exposed through an admin-only API.

## Tasks

- [ ] 1. Create core ID generation and tracer singleton (`lib/tracer.js`)
  - Implement `generateTraceId()` — `crypto.randomBytes(16).toString('hex')`, throws `{ code: 'TRACE_ID_GENERATION_FAILED' }` on failure
  - Implement `generateSpanId()` — `crypto.randomBytes(8).toString('hex')`, same error shape
  - Initialise `AsyncLocalStorage` instance; implement `getContext()` returning ALS value or `null`
  - Implement `startRootSpan(traceId, parentSpanId, attrs)` — creates span object, sets ALS context, increments `trace_active_spans` gauge
  - Implement `startChildSpan(name, attrs)` — reads current ALS context, creates child span, updates ALS to child context
  - Implement `endSpan(span, outcome)` — computes `durationMs` via `process.hrtime.bigint()`, sets `error`/`errorMessage`, restores parent ALS context, observes histogram, increments counter, decrements gauge
  - Implement `runInContext(context, fn)` — runs `fn` inside a fresh ALS context (for background jobs)
  - Wire Prometheus metrics on module init: register `trace_span_duration_seconds` (Histogram), `trace_active_spans` (Gauge), `trace_spans_total` (Counter) against existing `registry` from `metricsMiddleware.js`; guard each registration with `registry.getSingleMetric(name)` check
  - _Requirements: 1.1, 1.2, 1.5, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7_

  - [ ]* 1.1 Write property test for ID format invariant
    - **Property 1: ID format invariant** — `generateTraceId()` always matches `/^[0-9a-f]{32}$/`; `generateSpanId()` always matches `/^[0-9a-f]{16}$/`
    - **Validates: Requirements 1.1, 1.2**

  - [ ]* 1.2 Write property test for ID uniqueness
    - **Property 2: ID uniqueness** — batch of independently generated IDs are all distinct
    - **Validates: Requirements 1.3, 1.4**

  - [ ]* 1.3 Write property test for async context propagation round-trip
    - **Property 9: Async context propagation round-trip** — after each `endSpan` the active `spanId` equals the span ID that was active before the corresponding `startChildSpan`
    - **Validates: Requirements 4.2, 4.3, 4.4, 4.5**

  - [ ]* 1.4 Write property test for span metrics round-trip
    - **Property 20: Span metrics round-trip** — `trace_active_spans` net delta is 0 after start+end; `trace_spans_total` increments by 1 with correct status label
    - **Validates: Requirements 10.4, 10.5**

- [ ] 2. Create sensitive-field scrubber (`lib/sanitise.js`)
  - Implement `sanitise(attrs)` — removes keys matching the sensitive list (case-insensitive): `authorization`, `cookie`, `set-cookie`, `password`, `token`, `secret`, `privatekey`, `seed`, and any key containing substring `key` or `secret`
  - Truncate string values longer than 256 chars to 256 chars + `'...[truncated]'`
  - Return a new object (do not mutate input)
  - _Requirements: 11.1, 11.3, 11.4, 11.5, 11.6_

  - [ ]* 2.1 Write property test for sensitive field exclusion
    - **Property 12: Sensitive field exclusion** — `sanitise()` output never contains any sensitive key
    - **Validates: Requirements 11.1, 11.3, 11.4, 11.5**

  - [ ]* 2.2 Write property test for long attribute value truncation
    - **Property 13: Long attribute value truncation** — string values > 256 chars are truncated to exactly 256 chars + `'...[truncated]'` (total 270)
    - **Validates: Requirements 11.6**

- [ ] 3. Create ring buffer trace store (`lib/traceStore.js`)
  - Implement `TraceStore` class with `_map` (Map), `_order` (string[]), `_maxSize`
  - `add(trace)` — evict oldest (shift `_order`, delete from `_map`) when at capacity, then insert
  - `get(traceId)` — O(1) Map lookup, return `null` if not found
  - `list({ limit, offset })` — return summaries from `_order` reversed (newest first), sliced by offset/limit
  - `get size()` — return `_map.size`
  - Export singleton: `new TraceStore(Number(process.env.TRACE_STORE_MAX_SIZE) || 1000)`
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_

  - [ ]* 3.1 Write property test for ring buffer capacity invariant
    - **Property 14: Ring buffer capacity invariant** — `size` never exceeds `maxSize`; oldest traces are evicted first (FIFO)
    - **Validates: Requirements 7.1, 7.2, 7.5**

  - [ ]* 3.2 Write property test for trace store round-trip
    - **Property 15: Trace store round-trip** — `store.get(trace.traceId).traceId` equals the queried Trace_ID for any non-evicted trace
    - **Validates: Requirements 7.4**

- [ ] 4. Create sampling decision module (`lib/sampler.js`)
  - Read `TRACE_SAMPLING_RATE` env var; clamp to [0.0, 1.0] with `console.warn` if out of range; default to `1.0` (non-prod) or `0.1` (prod)
  - `shouldSample({ hasUpstreamTraceId })` — return `true` immediately if `hasUpstreamTraceId`; otherwise `Math.random() < rate`
  - Expose `get rate()` for inspection
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7_

  - [ ]* 4.1 Write property test for sampler convergence
    - **Property 16: Sampler convergence** — over 10 000 trials the sampled fraction is within ±5% of the configured rate
    - **Validates: Requirements 9.4**

  - [ ]* 4.2 Write property test for sampler boundary values
    - **Property 17: Sampler boundary values** — rate `0.0` always returns `false`; rate `1.0` always returns `true`
    - **Validates: Requirements 9.2, 9.3**

  - [ ]* 4.3 Write property test for sampler out-of-range clamping
    - **Property 18: Sampler out-of-range clamping** — any value outside [0.0, 1.0] is clamped to `0.0` or `1.0`
    - **Validates: Requirements 9.5**

  - [ ]* 4.4 Write property test for upstream trace ID forces sampling
    - **Property 19: Upstream trace ID forces sampling** — `shouldSample({ hasUpstreamTraceId: true })` returns `true` regardless of rate
    - **Validates: Requirements 9.7**

- [ ] 5. Create span wrapper higher-order function (`lib/spanWrapper.js`)
  - Implement `async withSpan(spanName, attrs, fn)`:
    - If `tracer.getContext() === null`, execute `fn()` directly and return (no-op on unsampled paths)
    - Otherwise call `tracer.startChildSpan(spanName, sanitise(attrs))`
    - `await fn()` in try/catch; on error set `span.error = true`, `span.errorMessage`, re-throw
    - Call `tracer.endSpan(span, outcome)` in finally
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8_

  - [ ]* 5.1 Write property test for span wrapper child span attributes
    - **Property 10: Span wrapper sets correct child span attributes** — `span.name === name`, `span.parentSpanId` equals active ALS spanId, `span.attrs` equals `sanitise(attrs)`
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.7**

  - [ ]* 5.2 Write property test for span wrapper error propagation
    - **Property 11: Span wrapper error propagation** — wrapped function that throws causes `span.error = true`, `span.errorMessage` set, original error re-thrown unchanged
    - **Validates: Requirements 5.5**

- [ ] 6. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Create Express trace middleware (`middleware/traceMiddleware.js`)
  - Extract `X-Trace-ID` header; validate against `/^[0-9a-f]{32}$/`; generate new ID if absent or invalid
  - Extract `X-Span-ID` as `parentSpanId`
  - Set `res.setHeader('X-Trace-ID', traceId)` unconditionally
  - Call `sampler.shouldSample({ hasUpstreamTraceId: !!validIncomingTraceId })`; if not sampled call `next()` and return
  - Create root span via `tracer.startRootSpan(traceId, parentSpanId, { 'http.method', 'http.url': req.path, 'http.route': '' })`
  - Initialise `res.locals.traceSpans = [rootSpan]` for child span collection
  - Hook `res.on('finish', ...)` — set `http.status_code`, set `span.error` for 4xx/5xx, call `tracer.endSpan`, then `traceStore.add(buildTrace(...))`
  - Wrap entire setup in try/catch; on `TRACE_ID_GENERATION_FAILED` log and call `next()` without tracing
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 11.2_

  - [ ]* 7.1 Write property test for valid header passthrough
    - **Property 3: Valid header passthrough** — valid 32-char hex `X-Trace-ID` is used as-is
    - **Validates: Requirements 2.1**

  - [ ]* 7.2 Write property test for invalid header replacement
    - **Property 4: Invalid header replacement** — invalid `X-Trace-ID` is discarded; fresh valid ID generated
    - **Validates: Requirements 2.5**

  - [ ]* 7.3 Write property test for X-Trace-ID response header always present
    - **Property 5: X-Trace-ID response header always present** — every response (sampled or not) contains `X-Trace-ID` matching `/^[0-9a-f]{32}$/`
    - **Validates: Requirements 2.4, 2.6**

  - [ ]* 7.4 Write property test for root span attributes completeness
    - **Property 6: Root span attributes completeness** — root span contains `http.method`, `http.url` (path only), `http.status_code`
    - **Validates: Requirements 3.1, 11.2**

  - [ ]* 7.5 Write property test for error flag on 4xx/5xx responses
    - **Property 7: Error flag on 4xx/5xx responses** — status [400,599] → `span.error = true`; [200,399] → `span.error = false`
    - **Validates: Requirements 3.5**

  - [ ]* 7.6 Write property test for non-negative span duration
    - **Property 8: Non-negative span duration** — `durationMs >= 0` for all spans
    - **Validates: Requirements 3.4, 5.6, 12.6**

- [ ] 8. Create traces visualization API route (`routes/traces.js`)
  - `GET /api/traces` — require `authenticateUser` + `requireAdmin`; call `traceStore.list({ limit, offset })`; return paginated summary response
  - `GET /api/traces/:traceId` — validate `:traceId` against `/^[0-9a-f]{32}$/`, return 400 with `error: 'invalid_trace_id'` if invalid; call `traceStore.get(traceId)`, return 404 with `error: 'trace_not_found'` if null; return 200 with full span tree
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8_

  - [ ]* 8.1 Write property test for API response traceId invariant
    - **Property 22: API response traceId invariant** — every span in `GET /api/traces/:traceId` response has `traceId` equal to the path parameter
    - **Validates: Requirements 8.2, 8.7**

  - [ ]* 8.2 Write property test for API invalid traceId format returns 400
    - **Property 23: API invalid traceId format returns 400** — any non-hex-32 path param returns HTTP 400 with `error: 'invalid_trace_id'`
    - **Validates: Requirements 8.4**

- [ ] 9. Wire traceMiddleware and traces route into `server.js`
  - `require('./middleware/traceMiddleware')` and add `app.use(traceMiddleware)` before all route registrations (after `metricsMiddleware`)
  - Add `app.use('/api/traces', require('./routes/traces'))` with the other route registrations
  - _Requirements: 3.6, 8.1, 8.5_

- [ ] 10. Instrument `db/index.js` with `withSpan`
  - Wrap `pool.query(text, params)` inside `withSpan('postgres.query', { 'db.type': 'postgresql', 'db.operation': op }, ...)` where `op = text.trim().split(' ')[0].toUpperCase()`
  - Do not pass `params` values into attrs (SQL parameter values must not appear in spans)
  - _Requirements: 5.1, 5.8, 11.3_

- [ ] 11. Instrument `lib/redis.js` with `withSpan`
  - Add a `tracedCommand(command, fn)` helper that calls `withSpan('redis.' + command, { 'db.type': 'redis' }, fn)`
  - Wrap exported Redis operations (e.g. `get`, `set`, `del`, `expire`) using `tracedCommand`
  - Do not include key names or values in attrs
  - _Requirements: 5.2, 5.8, 11.4_

- [ ] 12. Instrument `services/emailService.js` with `withSpan`
  - Wrap the internal send call inside `withSpan('email.send', { 'messaging.system': 'email' }, () => _sendEmail(opts))`
  - Do not include recipient address, subject, or body in attrs
  - _Requirements: 5.4, 5.8, 11.5_

- [ ] 13. Instrument `blockchain/sendRewards.js` and `blockchain/trustline.js` with `withSpan`
  - In `sendRewards.js` wrap `server.submitTransaction(transaction)` with `withSpan('stellar.submitTransaction', { 'peer.service': 'stellar-horizon' }, ...)`
  - In `trustline.js` wrap `loadAccount` calls with `withSpan('stellar.loadAccount', { 'peer.service': 'stellar-horizon' }, ...)`
  - _Requirements: 5.3, 5.8_

- [ ] 14. Add background job root spans to `jobs/leaderboardCacheWarmer.js` and `jobs/dailyLoginBonus.js`
  - In each job: generate a new `traceId`, call `tracer.startRootSpan(traceId, null, { 'job.type': 'scheduled' })`, set `rootSpan.name` to the job span name
  - Wrap the job body in `tracer.runInContext(...)` with a try/catch; call `tracer.endSpan(rootSpan, { error: false })` on success or `{ error: true, errorMessage: err.message }` on failure; call `traceStore.add(...)` in both cases
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

- [ ] 15. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 16. Write unit tests for tracer singleton (`tests/tracer.test.js`)
  - Test ID generation failure path (mock `crypto.randomBytes` to throw; verify error code `TRACE_ID_GENERATION_FAILED`)
  - Test `getContext()` returns `null` outside any ALS context
  - Test metrics registration does not throw on double-init (call init twice, verify no duplicate registration error)
  - _Requirements: 1.5, 4.6, 10.6_

- [ ] 17. Write unit tests for trace store (`tests/traceStore.test.js`)
  - Test `get()` returns `null` for unknown Trace_ID
  - Test `add()` with `maxSize = 1` — second add evicts first
  - Test `list()` returns newest first
  - _Requirements: 7.3, 7.7_

- [ ] 18. Write unit tests for sampler (`tests/sampler.test.js`)
  - Test default rate is `1.0` when `NODE_ENV !== 'production'`
  - Test default rate is `0.1` when `NODE_ENV === 'production'`
  - Test upstream `X-Trace-ID` forces sampling even when rate is `0.0`
  - _Requirements: 9.1, 9.7_

- [ ] 19. Write unit tests for trace middleware (`tests/traceMiddleware.test.js`)
  - Test unsampled request — no spans created, `X-Trace-ID` header still present
  - Test `TRACE_ID_GENERATION_FAILED` error — middleware calls `next()` without tracing
  - _Requirements: 2.6, 1.5_

- [ ] 20. Write unit tests for traces route (`tests/tracesRoute.test.js`)
  - Test `GET /api/traces` returns 401 without auth token
  - Test `GET /api/traces` returns 403 for non-admin user
  - Test `GET /api/traces/:traceId` returns 404 for missing trace
  - _Requirements: 8.3, 8.5_

- [ ] 21. Write unit tests for background job tracer (`tests/jobTracer.test.js`)
  - Test `leaderboardCacheWarmer` root span has `name = 'job.leaderboardCacheWarmer'` and `attrs['job.type'] = 'scheduled'`
  - Test `dailyLoginBonus` root span has `name = 'job.dailyLoginBonus'` and `attrs['job.type'] = 'scheduled'`
  - Test job error sets `span.error = true` and `span.errorMessage` before storing trace
  - _Requirements: 6.1, 6.2, 6.4, 6.5_

- [ ] 22. Write all 23 property-based tests (`tests/distributedTracingProperties.test.js`)
  - Define shared arbitraries: `validTraceId`, `invalidTraceId`, `validSpanId`, `spanName`, `httpStatusCode`, `samplingRate`, `outOfRangeRate`, `attrObject`, `sensitiveAttrObject`, `traceWithSpans`
  - Implement one `fc.assert` / `fc.property` block per property (Properties 1–23), each annotated with `// Feature: distributed-tracing, Property N: <text>`
  - Use `numRuns: 100` for all properties except Property 16 (sampler convergence) which uses `numRuns: 10000`
  - Property 21 (span tree structural validity) must verify: all `traceId` fields match, exactly one root span, no dangling `parentSpanId` references, all `spanId` values unique, graph is acyclic
  - _Requirements: 1.1–1.4, 2.1, 2.4, 2.5, 2.6, 3.1, 3.4, 3.5, 4.2–4.5, 5.1–5.5, 5.7, 7.1, 7.2, 7.4, 7.5, 8.2, 8.4, 8.7, 8.8, 9.2–9.5, 9.7, 10.4, 10.5, 11.1, 11.3–11.6, 12.1–12.6_

- [ ] 23. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties (Properties 1–23 from design.md)
- Unit tests validate specific examples, edge cases, and integration points
- No new npm packages required — only `crypto` and `async_hooks` (Node.js built-ins) plus `fast-check` already in `devDependencies`
