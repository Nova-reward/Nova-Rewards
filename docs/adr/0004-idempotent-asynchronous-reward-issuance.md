# ADR 0004: Idempotent Asynchronous Reward Issuance

## Status

Accepted

## Context

Reward issuance can involve network calls to Stellar, campaign eligibility
checks, trustline validation, retries, and merchant-facing status reporting. The
API must avoid duplicate rewards when merchants retry requests after timeouts or
client failures.

## Decision

Use an idempotent asynchronous issuance engine:

- `POST /api/rewards/issue` requires an `idempotencyKey`.
- `reward_issuances.idempotency_key` is unique in PostgreSQL.
- The API writes a `pending` record before enqueueing work.
- BullMQ uses the idempotency key as `jobId`.
- `rewardIssuanceWorker` increments attempts, validates the campaign, submits
  Stellar distribution, and marks the record `confirmed` or `failed`.
- Exhausted jobs are copied to `reward-issuance-dlq`.

## Consequences

Positive:

- Merchant retries return the existing issuance instead of issuing twice.
- The API can respond quickly with `202 queued` while settlement continues.
- Settlement status is queryable from the database and auditable by transaction
  hash.
- Worker retry behavior is centralized in BullMQ.

Negative:

- Clients need a status polling or webhook pattern for final settlement.
- Queue availability becomes part of issuance availability.
- Workers must be deployed with enough concurrency to avoid settlement lag.

## Related

- Diagram: [System Design - Reward Issuance Data Flow](../system-design.md#reward-issuance-data-flow)
- Code: `novaRewards/backend/routes/rewards.js`
- Code: `novaRewards/backend/services/rewardIssuanceService.js`
- Code: `novaRewards/backend/jobs/rewardIssuanceWorker.js`
- Code: `novaRewards/database/019_create_reward_issuances.sql`

