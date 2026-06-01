# ADR 0008: Cursor-Based Pagination for List Endpoints

## Status

Accepted

## Context

Nova Rewards exposes several list endpoints — transactions, reward history,
campaign lists, redemptions, and contract events — that can grow to millions of
rows. Clients need stable, efficient pagination that works correctly under
concurrent writes.

Considered options:

1. **Offset/limit pagination** — `OFFSET n LIMIT k` in SQL. Simple to implement
   and supports random page access, but performance degrades as `OFFSET` grows
   because the database must scan and discard all preceding rows. Results also
   shift when rows are inserted or deleted between pages, causing duplicates or
   skipped rows.
2. **Cursor-based (keyset) pagination** — uses a stable column value (typically
   `id` or `created_at`) as a cursor. The query becomes
   `WHERE id < :cursor ORDER BY id DESC LIMIT k`. Performance is constant
   regardless of page depth because the index seek is O(log n). Results are
   stable under concurrent writes.
3. **Page-number pagination** — a UX wrapper over offset/limit; inherits the
   same performance and consistency problems.
4. **Relay-style cursor pagination** — opaque base64-encoded cursors as used by
   GraphQL Relay. More portable but adds encoding/decoding overhead for a REST
   API.

## Decision

Use cursor-based (keyset) pagination as the default for all high-volume list
endpoints:

- Responses include a `nextCursor` field (the `id` of the last returned row,
  base64-encoded) and a `hasMore` boolean.
- Clients pass `cursor=<value>` on subsequent requests; the backend decodes it
  and applies `WHERE id < :cursor`.
- `limit` is accepted as a query parameter, capped at `MAX_PAGE_SIZE` (100) and
  defaulting to `DEFAULT_PAGE_SIZE` (20), both defined in
  `backend/config/constants.js`.
- Offset/limit is retained for admin and analytics endpoints where random page
  access is required and the dataset is bounded.
- The leaderboard endpoint is a special case: rankings are pre-computed and
  cached in Redis by a background job; the current user's rank is always
  resolved live from PostgreSQL to avoid stale personalised data.

## Consequences

Positive:

- Consistent O(log n) query performance regardless of how deep into the result
  set the client is.
- No duplicate or skipped rows when new records are inserted between page
  fetches.
- Cursor values are opaque to clients, allowing the backend to change the
  underlying sort key without a breaking API change.

Negative:

- Clients cannot jump to an arbitrary page number; navigation is strictly
  forward (or backward with a `prevCursor`).
- Sorting must be on an indexed, unique, or monotonically increasing column.
  Multi-column sort keys require composite cursors.
- Admin and reporting UIs that need "go to page N" must use offset pagination
  with the associated performance trade-offs.

## Related

- Code: `novaRewards/backend/config/constants.js` (`MAX_PAGE_SIZE`, `DEFAULT_PAGE_SIZE`)
- Code: `novaRewards/backend/routes/transactions.js`
- Code: `novaRewards/backend/routes/rewards.js`
- Code: `novaRewards/backend/db/transactionRepository.js`
- Code: `novaRewards/frontend/pages/rewards.js` (infinite scroll consumer)
- ADR: [0002 — PostgreSQL and Redis](0002-postgresql-system-of-record-with-redis-operational-cache.md)
