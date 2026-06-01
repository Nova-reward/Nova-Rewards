# ADR 0009: BullMQ on Redis for Asynchronous Job Queue

## Status

Accepted

## Context

Several platform operations cannot complete synchronously within an HTTP
request: Stellar transaction submission (network latency, finality delays),
webhook delivery to merchant endpoints (external HTTP calls, retries), and
daily login bonus calculation (fan-out across all active users). These
operations need reliable execution, retry on failure, and visibility into
queue depth and job status.

Considered options:

1. **In-process async (Promise / setTimeout)** — no infrastructure dependency,
   but jobs are lost on process restart and there is no retry, dead-letter, or
   observability.
2. **PostgreSQL-backed queue (pg-boss, Graphile Worker)** — durable, uses the
   existing database, but adds write load to the primary and lacks the
   real-time push semantics needed for low-latency job pickup.
3. **BullMQ on Redis** — battle-tested Node.js queue library backed by Redis
   sorted sets and lists. Supports retries, exponential backoff, job
   deduplication by `jobId`, dead-letter queues, concurrency controls, and a
   built-in admin dashboard (Bull Board).
4. **AWS SQS / managed queue** — fully managed, highly durable, but adds an
   external cloud dependency and increases latency for local development.
5. **RabbitMQ / AMQP** — powerful routing and exchange model, but adds a new
   infrastructure component with its own operational overhead.

## Decision

Use BullMQ backed by the existing Redis instance for all asynchronous job
processing:

- **`reward-issuance` queue** — processes reward issuance jobs with 3 attempts
  and exponential backoff starting at 1 second. Uses the merchant-supplied
  `idempotencyKey` as `jobId` to prevent duplicate processing on retry (see
  ADR-0004).
- **`transaction-submission` queue** — submits signed Stellar transactions to
  Horizon with 5 attempts and 2-second initial backoff to handle transient
  network errors and Stellar rate limits.
- **`webhook-delivery` queue** — delivers event payloads to merchant webhook
  endpoints with 5 attempts and 5-second initial backoff. Exhausted jobs are
  moved to a dead-letter queue for manual inspection.
- **Cron workers** — `leaderboardCacheWarmer` (every 5 minutes),
  `dailyLoginBonus` (daily), and `webhookRetry` run as BullMQ repeatable jobs.
- **Bull Board** is mounted at `/api/admin/queues` behind `authenticateUser` +
  `requireAdmin` middleware, providing a real-time UI for queue inspection and
  job management.

All queues share the same Redis connection configuration (`REDIS_HOST` /
`REDIS_PORT` or `REDIS_URL`). In production, this is the ElastiCache instance
used for caching and rate limiting.

## Consequences

Positive:

- Jobs survive process restarts; Redis persistence (AOF or RDB) provides
  durability.
- Exponential backoff prevents thundering-herd retries against Stellar or
  merchant endpoints.
- `jobId` deduplication at the queue level is a second line of defence
  alongside the database-level `idempotency_key` unique constraint.
- Bull Board gives operators real-time visibility without custom tooling.
- BullMQ workers run in the same Node.js process, simplifying deployment.

Negative:

- Queue availability depends on Redis availability. If Redis is down, new jobs
  cannot be enqueued and workers stall.
- Redis is not a traditional message broker; very high job volumes may require
  tuning `maxmemory-policy` to avoid eviction of pending jobs.
- Workers must be deployed with sufficient concurrency to avoid settlement lag
  during traffic spikes.
- Dead-letter queue monitoring requires an operational runbook to prevent
  silent job loss.

## Related

- Code: `novaRewards/backend/jobs/queues.js`
- Code: `novaRewards/backend/jobs/rewardIssuanceWorker.js`
- Code: `novaRewards/backend/jobs/webhookHandler.js`
- Code: `novaRewards/backend/jobs/webhookRetry.js`
- Code: `novaRewards/backend/jobs/leaderboardCacheWarmer.js`
- Code: `novaRewards/backend/jobs/dailyLoginBonus.js`
- ADR: [0002 — PostgreSQL and Redis](0002-postgresql-system-of-record-with-redis-operational-cache.md)
- ADR: [0004 — Idempotent Asynchronous Reward Issuance](0004-idempotent-asynchronous-reward-issuance.md)
