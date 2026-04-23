# Requirements Document

## Introduction

The Distributed Tracing feature adds end-to-end request observability to the Nova-Rewards backend. Every inbound HTTP request receives a unique trace ID that is propagated through all downstream calls — PostgreSQL queries, Redis operations, Stellar/Horizon API calls, and email dispatch — as well as across background jobs. Each unit of work is recorded as a span with timing, status, and contextual metadata. Completed traces are stored in a lightweight in-process ring buffer and exposed through a visualization API endpoint. A configurable sampling strategy controls overhead in production. All span duration metrics are integrated with the existing `prom-client` registry so that tracing data appears alongside existing Prometheus metrics on the `/metrics` endpoint.

## Glossary

- **Tracer**: The singleton module responsible for creating spans, managing the active context, and writing completed traces to the Trace_Store.
- **Trace**: A directed acyclic graph of Spans that together represent the full lifecycle of a single request or background job, identified by a unique Trace_ID.
- **Trace_ID**: A 32-character lowercase hexadecimal string (128-bit random value) that uniquely identifies a Trace.
- **Span**: A single named unit of work within a Trace, identified by a Span_ID, with a recorded start time, end time, status, and optional attributes.
- **Span_ID**: A 16-character lowercase hexadecimal string (64-bit random value) that uniquely identifies a Span within a Trace.
- **Root_Span**: The first Span in a Trace, created when an inbound HTTP request or background job begins. Its Parent_Span_ID is null.
- **Child_Span**: A Span whose Parent_Span_ID references an existing Span_ID within the same Trace.
- **Parent_Span_ID**: The Span_ID of the Span that causally preceded a Child_Span.
- **Trace_Context**: The immutable object `{ traceId, spanId, parentSpanId }` carried through async boundaries via AsyncLocalStorage.
- **Trace_Store**: The in-process ring buffer that holds the N most recently completed Traces, where N is configurable via `TRACE_STORE_MAX_SIZE` (default 1000).
- **Sampling_Rate**: A number in the range [0.0, 1.0] that controls the fraction of requests for which tracing is active. Configured via `TRACE_SAMPLING_RATE` (default `1.0` in development, `0.1` in production).
- **Sampler**: The component that decides, at the start of each request, whether the request should be traced.
- **Propagation_Headers**: The three HTTP headers used to carry Trace_Context across service boundaries: `X-Trace-ID`, `X-Span-ID`, and `X-Parent-Span-ID`.
- **Span_Attributes**: A key-value map of metadata attached to a Span (e.g. HTTP method, route, status code, DB query type, service name). Must never contain sensitive fields.
- **Sensitive_Fields**: Values that must be excluded from Span_Attributes: `Authorization` header values, passwords, private keys, wallet seed phrases, and full SQL query parameter values.
- **Trace_Middleware**: The Express middleware that extracts or generates Trace_Context for each inbound request and creates the Root_Span.
- **Span_Wrapper**: A higher-order function that wraps an async operation, creates a Child_Span, records the outcome, and ends the span.
- **Background_Job_Tracer**: The utility that creates a synthetic Root_Span for scheduled jobs (leaderboardCacheWarmer, dailyLoginBonus) that have no inbound HTTP request.
- **Metrics_Collector**: The existing `prom-client` registry from `metricsMiddleware.js`, extended with tracing histograms and gauges.
- **Trace_Visualization_API**: The HTTP endpoint `GET /api/traces/:traceId` that returns the full Span tree for a completed Trace.
- **Stellar_Horizon**: The Horizon REST API accessed via `stellar-sdk`.
- **Protected_Service**: Any of the four external dependencies instrumented with a Span_Wrapper: Stellar_Horizon, Redis, PostgreSQL, Email.

## Requirements

### Requirement 1: Trace ID and Span ID Generation

**User Story:** As a backend engineer, I want every trace and span to have a cryptographically random, globally unique identifier, so that traces from concurrent requests never collide.

#### Acceptance Criteria

1. THE Tracer SHALL generate each Trace_ID as a 32-character lowercase hexadecimal string derived from 16 bytes of cryptographic randomness (`crypto.randomBytes(16)`).
2. THE Tracer SHALL generate each Span_ID as a 16-character lowercase hexadecimal string derived from 8 bytes of cryptographic randomness (`crypto.randomBytes(8)`).
3. FOR ALL pairs of independently generated Trace_IDs, THE Tracer SHALL produce values that are not equal (collision-free property).
4. FOR ALL pairs of independently generated Span_IDs within a single Trace, THE Tracer SHALL produce values that are not equal (collision-free property).
5. IF a Trace_ID or Span_ID generation call fails, THEN THE Tracer SHALL throw an error with code `TRACE_ID_GENERATION_FAILED` and allow the request to proceed without tracing.

---

### Requirement 2: Trace Context Propagation via HTTP Headers

**User Story:** As a backend engineer, I want incoming requests to carry trace context in standard headers, so that distributed calls across services share the same trace.

#### Acceptance Criteria

1. WHEN an inbound HTTP request contains a valid `X-Trace-ID` header (32 lowercase hex characters), THE Trace_Middleware SHALL use that value as the Trace_ID for the request's Trace_Context.
2. WHEN an inbound HTTP request does not contain an `X-Trace-ID` header, THE Trace_Middleware SHALL generate a new Trace_ID and use it as the Trace_ID for the request's Trace_Context.
3. WHEN an inbound HTTP request contains an `X-Span-ID` header, THE Trace_Middleware SHALL use that value as the Parent_Span_ID of the Root_Span.
4. THE Trace_Middleware SHALL attach the `X-Trace-ID` header to every HTTP response, set to the Trace_ID of the active Trace_Context.
5. IF an inbound `X-Trace-ID` header value does not match the pattern `/^[0-9a-f]{32}$/`, THEN THE Trace_Middleware SHALL discard it and generate a new Trace_ID.
6. WHEN the Sampler determines that a request should not be traced, THE Trace_Middleware SHALL still attach the `X-Trace-ID` response header but SHALL NOT create any Spans or store any Trace data.

---

### Requirement 3: Root Span Creation for Inbound HTTP Requests

**User Story:** As a backend engineer, I want every sampled HTTP request to produce a root span with accurate timing and metadata, so that I can measure end-to-end request latency.

#### Acceptance Criteria

1. WHEN a sampled inbound HTTP request is received, THE Trace_Middleware SHALL create a Root_Span with the following Span_Attributes: `http.method`, `http.route`, `http.status_code`, `http.url` (path only, no query string).
2. THE Trace_Middleware SHALL record the Root_Span start time using `process.hrtime.bigint()` for sub-millisecond precision.
3. WHEN the HTTP response is sent (`res.on('finish')`), THE Trace_Middleware SHALL end the Root_Span, compute the duration in milliseconds, and set `http.status_code` on the span.
4. THE Root_Span duration SHALL be greater than or equal to zero milliseconds for all requests.
5. WHEN the HTTP response status code is 4xx or 5xx, THE Trace_Middleware SHALL set `span.error = true` on the Root_Span.
6. THE Trace_Middleware SHALL store the completed Root_Span in the Trace_Store under its Trace_ID after the response is sent.

---

### Requirement 4: Async Context Propagation

**User Story:** As a backend engineer, I want the active trace context to be automatically available in all async continuations of a request, so that child spans can be created without manually threading context through every function call.

#### Acceptance Criteria

1. THE Tracer SHALL use Node.js `AsyncLocalStorage` to store and retrieve the active Trace_Context within a request's async execution tree.
2. WHEN an async function is called within a traced request (including `await`, `Promise.all`, `Promise.allSettled`, and `setImmediate`), THE Tracer SHALL make the same Trace_Context available via `Tracer.getContext()`.
3. WHEN a new Child_Span is created, THE Tracer SHALL automatically set its Parent_Span_ID to the Span_ID of the currently active Span retrieved from AsyncLocalStorage.
4. WHEN a Child_Span is created, THE Tracer SHALL update AsyncLocalStorage so that any further nested spans use the Child_Span's Span_ID as their Parent_Span_ID.
5. WHEN the Child_Span ends, THE Tracer SHALL restore the previous Span_ID in AsyncLocalStorage so that sibling spans receive the correct Parent_Span_ID.
6. IF `Tracer.getContext()` is called outside of any traced execution context, THEN THE Tracer SHALL return `null` without throwing.

---

### Requirement 5: Child Span Creation for Outbound External Calls

**User Story:** As a backend engineer, I want every call to an external service to produce a child span linked to the active trace, so that I can identify which downstream calls contribute most to request latency.

#### Acceptance Criteria

1. WHEN a PostgreSQL query is executed via `db/index.js`, THE Span_Wrapper SHALL create a Child_Span with `span.name = 'postgres.query'` and Span_Attributes `{ db.type: 'postgresql', db.operation: <SELECT|INSERT|UPDATE|DELETE> }`.
2. WHEN a Redis command is executed via `lib/redis.js`, THE Span_Wrapper SHALL create a Child_Span with `span.name = 'redis.<command>'` (e.g. `redis.get`, `redis.set`) and Span_Attribute `{ db.type: 'redis' }`.
3. WHEN a Stellar/Horizon API call is made via `stellar-sdk`, THE Span_Wrapper SHALL create a Child_Span with `span.name = 'stellar.<operation>'` (e.g. `stellar.loadAccount`, `stellar.submitTransaction`) and Span_Attribute `{ peer.service: 'stellar-horizon' }`.
4. WHEN an email is dispatched via `nodemailer` or SendGrid, THE Span_Wrapper SHALL create a Child_Span with `span.name = 'email.send'` and Span_Attribute `{ messaging.system: 'email' }`.
5. WHEN a Child_Span's wrapped operation throws an error, THE Span_Wrapper SHALL set `span.error = true` and `span.error_message` to the error message, then re-throw the original error.
6. THE Child_Span duration SHALL be greater than or equal to zero milliseconds for all operations.
7. THE Child_Span's Parent_Span_ID SHALL equal the Span_ID of the currently active Span in AsyncLocalStorage at the time the Child_Span was created.
8. THE Span_Wrapper SHALL NOT include SQL query parameter values, Redis key values, or email recipient addresses in Span_Attributes.

---

### Requirement 6: Background Job Tracing

**User Story:** As a backend engineer, I want background jobs to produce their own root spans, so that I can trace the performance of scheduled work independently of HTTP requests.

#### Acceptance Criteria

1. WHEN `leaderboardCacheWarmer` executes, THE Background_Job_Tracer SHALL create a Root_Span with `span.name = 'job.leaderboardCacheWarmer'` and Span_Attribute `{ job.type: 'scheduled' }`.
2. WHEN `dailyLoginBonus` executes, THE Background_Job_Tracer SHALL create a Root_Span with `span.name = 'job.dailyLoginBonus'` and Span_Attribute `{ job.type: 'scheduled' }`.
3. THE Background_Job_Tracer SHALL generate a new Trace_ID for each job execution, independent of any HTTP request context.
4. WHEN a background job completes successfully, THE Background_Job_Tracer SHALL end the Root_Span with `span.error = false` and store the Trace in the Trace_Store.
5. WHEN a background job throws an unhandled error, THE Background_Job_Tracer SHALL set `span.error = true` and `span.error_message` on the Root_Span before storing the Trace.
6. THE Background_Job_Tracer SHALL record all Child_Spans created during the job execution (e.g. Redis and PostgreSQL calls) as part of the same Trace.

---

### Requirement 7: Trace Storage

**User Story:** As a backend engineer, I want completed traces stored in an in-process ring buffer, so that recent traces are available for visualization without requiring an external tracing backend.

#### Acceptance Criteria

1. THE Trace_Store SHALL hold at most `TRACE_STORE_MAX_SIZE` completed Traces in memory (default 1000, configurable via environment variable).
2. WHEN a new Trace is added and the Trace_Store is at capacity, THE Trace_Store SHALL evict the oldest Trace to make room for the new one (FIFO eviction).
3. THE Trace_Store SHALL allow retrieval of a Trace by its Trace_ID in O(1) average time.
4. FOR ALL Traces stored and then retrieved by Trace_ID, THE Trace_Store SHALL return a Trace whose `traceId` field equals the queried Trace_ID (round-trip property).
5. WHILE the Trace_Store size is at or below `TRACE_STORE_MAX_SIZE`, THE Trace_Store SHALL not evict any Trace.
6. THE Trace_Store SHALL be thread-safe within the single-threaded Node.js event loop (no external locking required) and SHALL NOT persist traces to disk or Redis.
7. IF a Trace_ID is not found in the Trace_Store, THEN THE Trace_Store SHALL return `null` without throwing.

---

### Requirement 8: Trace Visualization API

**User Story:** As a backend engineer, I want an API endpoint that returns the full span tree for a trace, so that I can inspect request performance and identify bottlenecks.

#### Acceptance Criteria

1. THE Trace_Visualization_API SHALL expose `GET /api/traces/:traceId` that returns the full Span tree for the requested Trace.
2. WHEN a valid Trace_ID is provided and the Trace exists in the Trace_Store, THE Trace_Visualization_API SHALL return HTTP 200 with body `{ success: true, data: { traceId, spans: [...], durationMs, spanCount } }`.
3. WHEN the requested Trace_ID is not found in the Trace_Store, THE Trace_Visualization_API SHALL return HTTP 404 with body `{ success: false, error: 'trace_not_found', message: 'Trace not found or has been evicted' }`.
4. IF the `:traceId` path parameter does not match the pattern `/^[0-9a-f]{32}$/`, THEN THE Trace_Visualization_API SHALL return HTTP 400 with body `{ success: false, error: 'invalid_trace_id', message: 'Trace ID must be a 32-character lowercase hex string' }`.
5. THE Trace_Visualization_API SHALL require authentication via the existing `authenticateUser` middleware and SHALL restrict access to users with `role = 'admin'`.
6. THE Trace_Visualization_API SHALL expose `GET /api/traces` that returns a paginated list of recent Trace summaries `{ traceId, rootSpanName, durationMs, spanCount, startTime, hasError }` from the Trace_Store, ordered by start time descending.
7. FOR ALL Traces returned by `GET /api/traces/:traceId`, every Span in the `spans` array SHALL have a `traceId` field equal to the `:traceId` path parameter (invariant).
8. FOR ALL Traces returned by `GET /api/traces/:traceId`, every Child_Span's `parentSpanId` SHALL reference a `spanId` that exists within the same `spans` array (tree validity invariant).

---

### Requirement 9: Sampling Strategy

**User Story:** As a backend engineer, I want a configurable sampling rate, so that I can capture all traces in development while limiting overhead in production.

#### Acceptance Criteria

1. THE Sampler SHALL read the sampling rate from the `TRACE_SAMPLING_RATE` environment variable as a float in [0.0, 1.0]; if absent, it SHALL default to `1.0` when `NODE_ENV` is not `production` and `0.1` when `NODE_ENV` is `production`.
2. WHEN `TRACE_SAMPLING_RATE` is `1.0`, THE Sampler SHALL sample every request.
3. WHEN `TRACE_SAMPLING_RATE` is `0.0`, THE Sampler SHALL sample no requests.
4. FOR ALL values of `TRACE_SAMPLING_RATE` in (0.0, 1.0), THE Sampler SHALL produce a sampled fraction that converges to the configured rate over a large number of independent decisions (statistical property, tolerance ±5% over 10 000 trials).
5. IF `TRACE_SAMPLING_RATE` is set to a value outside [0.0, 1.0], THEN THE Sampler SHALL log a warning and clamp the value to the nearest valid bound.
6. THE Sampler SHALL make its sampling decision once per request at the point the Root_Span would be created, and that decision SHALL be immutable for the lifetime of the request.
7. WHEN a request arrives with an `X-Trace-ID` header from an upstream caller, THE Sampler SHALL honour the upstream sampling decision and always trace the request regardless of the local Sampling_Rate.

---

### Requirement 10: Integration with Prometheus Metrics

**User Story:** As a site reliability engineer, I want span duration and active span counts exposed as Prometheus metrics, so that I can build dashboards and alerts without a separate tracing backend.

#### Acceptance Criteria

1. THE Metrics_Collector SHALL register a Prometheus histogram `trace_span_duration_seconds` with labels `{ span_name, service }` on the existing `registry` from `metricsMiddleware.js`.
2. THE Metrics_Collector SHALL register a Prometheus gauge `trace_active_spans` with label `{ span_name }` that reflects the number of currently open (not yet ended) Spans.
3. THE Metrics_Collector SHALL register a Prometheus counter `trace_spans_total` with labels `{ span_name, status }` where `status` is `success` or `error`.
4. WHEN a Span ends, THE Metrics_Collector SHALL observe its duration in `trace_span_duration_seconds` and increment `trace_spans_total` with the appropriate status label.
5. WHEN a Span is created, THE Metrics_Collector SHALL increment `trace_active_spans` for that span name; WHEN the Span ends, THE Metrics_Collector SHALL decrement `trace_active_spans`.
6. THE Metrics_Collector SHALL NOT register duplicate metric names; if the registry already contains a metric with the same name, THE Metrics_Collector SHALL reuse the existing registration.
7. THE Metrics_Collector SHALL expose all tracing metrics on the existing `/metrics` endpoint without requiring any additional configuration.

---

### Requirement 11: Sensitive Data Exclusion

**User Story:** As a security engineer, I want span attributes to never contain sensitive data, so that trace logs and the visualization API do not leak credentials or personal information.

#### Acceptance Criteria

1. THE Span_Wrapper SHALL exclude the following fields from all Span_Attributes: `Authorization`, `Cookie`, `Set-Cookie`, `password`, `token`, `secret`, `privateKey`, `seed`, and any field whose name contains the substring `key` or `secret` (case-insensitive).
2. THE Trace_Middleware SHALL record only the URL path component in `http.url` and SHALL NOT record query string parameters.
3. THE Span_Wrapper SHALL NOT record SQL query parameter values (`$1`, `$2`, … bindings) in Span_Attributes; only the query template string (with placeholders) is permitted.
4. THE Span_Wrapper SHALL NOT record Redis key names or values in Span_Attributes; only the command name is permitted.
5. THE Span_Wrapper SHALL NOT record email recipient addresses, subject lines, or body content in Span_Attributes.
6. IF a Span_Attribute value is a string longer than 256 characters, THEN THE Span_Wrapper SHALL truncate it to 256 characters and append `'...[truncated]'`.

---

### Requirement 12: Span Tree Structural Validity

**User Story:** As a backend engineer, I want every completed trace to form a valid tree, so that visualization tools can render the span hierarchy without errors.

#### Acceptance Criteria

1. FOR ALL completed Traces in the Trace_Store, every Span SHALL have a `traceId` field equal to the Trace's Trace_ID (invariant).
2. FOR ALL completed Traces, exactly one Span SHALL have `parentSpanId = null` (the Root_Span).
3. FOR ALL completed Traces, every Child_Span's `parentSpanId` SHALL reference a `spanId` that exists within the same Trace (no dangling references).
4. FOR ALL completed Traces, the Span graph SHALL contain no cycles (acyclic invariant).
5. FOR ALL Spans within a Trace, each `spanId` SHALL be unique within that Trace (no duplicate Span_IDs).
6. FOR ALL Spans, the `endTime` SHALL be greater than or equal to the `startTime` (non-negative duration invariant).
