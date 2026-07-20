# ADR 0002: PostgreSQL System of Record with Redis Operational Cache

## Status

Accepted

## Context

Nova Rewards must track merchants, users, campaigns, transactions, point
transactions, reward issuances, redemptions, webhooks, and contract events.
These records need relational constraints, historical auditability, migrations,
and queryable state for dashboards and support workflows. The platform also
needs low-latency counters, queues, and cached leaderboard/campaign views.

## Decision

Use PostgreSQL as the system of record and Redis for operational acceleration:

- PostgreSQL stores durable business state through SQL migrations in
  `novaRewards/database`.
- Repository modules in `novaRewards/backend/db` own database access.
- Redis backs BullMQ queues, rate-limit counters, cache entries, and cache
  warmers.
- Background jobs update derived views, retry webhooks, and process async reward
  issuance without changing the database source of truth.

## Consequences

Positive:

- Durable state has constraints, migrations, indexes, and transaction support.
- Redis failures can be treated as degraded cache or queue behavior rather than
  silent loss of canonical business data.
- Expensive leaderboard and campaign lookups can be cached without denormalizing
  the core schema.

Negative:

- Cache invalidation is required after campaign and leaderboard mutations.
- Queue workers need retry, dead-letter, and idempotency controls to avoid
  duplicate settlement.

## Related

- Diagram: [System Design - Component Diagram](../system-design.md#component-diagram)
- Diagram: [Reward Issuance Persistence](../system-design.md#reward-issuance-persistence)
- Code: `novaRewards/database`
- Code: `novaRewards/backend/db`
- Code: `novaRewards/backend/jobs/queues.js`
- Code: `novaRewards/backend/cache/redisClient.js`

