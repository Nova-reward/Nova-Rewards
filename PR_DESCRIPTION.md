# feat: Reward Issuance Engine, API Rate Limiting, Campaign UI, CD Pipeline

Closes #572 · Closes #577 · Closes #594 · Closes #623

---

## Summary

This PR implements four issues from the Stellar Wave milestone in a single branch. All changes are backward-compatible; no existing routes or DB tables are modified.

---

## #572 — Reward Issuance Engine (P0-critical)

**New files**
- `novaRewards/database/019_create_reward_issuances.sql` — migration adding the `reward_issuances` table with `idempotency_key UNIQUE`, `status` (`pending` / `confirmed` / `failed`), `attempts`, `tx_hash`, and `error_message` columns.
- `novaRewards/backend/db/rewardIssuanceRepository.js` — DB layer: `createIssuance` (returns `null` on duplicate key), `markConfirmed`, `markFailed`, `incrementAttempts`.
- `novaRewards/backend/services/rewardIssuanceService.js` — core engine:
  - `enqueueRewardIssuance` — checks for existing record first (idempotency), persists a `pending` row, then enqueues a BullMQ job with `jobId = idempotencyKey` (BullMQ-level deduplication).
  - `processRewardIssuance` — validates campaign eligibility, calls `distributeRewards`, marks `confirmed` or `failed`; re-throws on transient errors so BullMQ retries with exponential backoff (3 attempts, 1 s base delay).
- `novaRewards/backend/jobs/rewardIssuanceWorker.js` — BullMQ worker (configurable concurrency via `REWARD_WORKER_CONCURRENCY`). On final failure, moves job data to a `reward-issuance-dlq` dead-letter queue.

**Modified files**
- `novaRewards/backend/routes/rewards.js` — adds `POST /api/rewards/issue` (returns `202 Queued` or `200 Duplicate`).
- `novaRewards/backend/server.js` — starts the worker on boot.

**Acceptance criteria met**
- ✅ Engine processes action events and checks campaign eligibility rules
- ✅ Idempotency key prevents duplicate reward issuance
- ✅ Failed Stellar transactions retried up to 3 times with exponential backoff
- ✅ Reward issuance recorded in DB with status (pending/confirmed/failed)
- ✅ Dead-letter queue captures permanently failed reward jobs

---

## #577 — API Rate Limiting (P1-high)

**Modified files**
- `novaRewards/backend/middleware/slidingRateLimiter.js` — adds `keyBy: 'api-key'` mode; resolves identifier from `x-api-key` header (falls back to IP).
- `novaRewards/backend/middleware/rateLimiter.js` — adds `webhookApiKeyLimiter` (1 000 req/min per merchant API key, env: `RL_WEBHOOK_API_KEY_MAX`); exports it alongside existing limiters.
- `novaRewards/backend/routes/webhooks.js` — applies `webhookApiKeyLimiter` to `POST /api/webhooks/actions`.
- `novaRewards/backend/routes/rewards.js` — fixes a pre-existing bug: the `distributeRateLimiter` referenced an undefined `getRedisClient()` function; replaced with the existing `slidingRewards` middleware.

**Rate limit summary**

| Endpoint | Limit | Key |
|---|---|---|
| All public routes | 100 req/min | IP |
| `POST /api/auth/login` | 5 req/min | IP |
| `POST /api/webhooks/actions` | 1 000 req/min | `x-api-key` header |
| `POST /api/rewards/distribute` | 20 req/min | IP |

All 429 responses include `Retry-After`, `RateLimit-Limit`, `RateLimit-Remaining`, and `RateLimit-Reset` headers. Limits are externalized to environment variables (`RL_*_MAX`).

**Acceptance criteria met**
- ✅ Redis store for distributed rate limiting (sliding-window Lua script)
- ✅ Default limit: 100 req/min per IP
- ✅ Webhook endpoint: 1 000 req/min per merchant API key
- ✅ 429 response includes `Retry-After` and `X-RateLimit-*` headers
- ✅ Rate limit configuration externalized to environment variables

---

## #594 — Campaign Creation and Management UI (P1-high)

**Modified files**
- `novaRewards/frontend/components/MultiStepForm.js` — adds `urlParamKey` prop; syncs the current step index to a URL search parameter on every step change (using `window.history.replaceState`), and reads it back on mount so the form survives a page refresh.
- `novaRewards/frontend/components/CampaignForm.js` — fully rewritten with **5 steps**:
  1. **Basic Info** — campaign name + description (both required)
  2. **Token Config** — token symbol + reward rate (positive number required)
  3. **Rules** — eligible action, optional min spend, optional max reward per user
  4. **Budget** — total budget + start/end dates (end must be after start)
  5. **Review** — read-only summary of all fields
  - After the review step a **transaction confirmation modal** is shown with the estimated Soroban fee and network before the API call is made.
  - Supports `editData` prop to pre-populate fields for editing an existing campaign.
- `novaRewards/frontend/components/CampaignManager.js` — rewritten to use `CampaignForm` for both create and edit flows. Adds a **Pause** action (calls `DELETE /api/campaigns/:id`) for active campaigns. Switches between `list`, `create`, and `edit` views without a page navigation.

**Acceptance criteria met**
- ✅ Multi-step form: Basic Info → Token Config → Rules → Budget → Review
- ✅ All fields validated client-side before advancing
- ✅ Transaction confirmation modal shows fee estimate before signing
- ✅ Form state persisted in URL params (`?step=N`) to survive page refresh
- ✅ Edit and pause actions available on existing campaigns

---

## #623 — CD Pipeline for Staging (P1-high)

**New file**
- `.github/workflows/cd-staging.yml` — triggers on every push to `main`. Five jobs:

| Job | What it does |
|---|---|
| `deploy-backend` | Runs `railway up` targeting the `nova-rewards-backend` service in the `staging` environment; polls until `SUCCESS` or times out after 4 min |
| `deploy-frontend` | Runs `vercel deploy` with `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_STELLAR_NETWORK=TESTNET`; outputs the preview URL |
| `smoke-tests` | `curl` checks: `/health`, `/metrics`, `/api/docs`, `POST /api/auth/login` (expects 400/401/422, not 404/500), and the Vercel preview URL |
| `rollback` | Runs `railway rollback` if smoke tests fail; posts a `failure` commit status |
| `report-success` | Posts a `success` commit status with the staging URL |

**Required secrets**

| Secret | Used by |
|---|---|
| `RAILWAY_TOKEN` | Railway CLI auth |
| `VERCEL_TOKEN` | Vercel CLI auth |
| `VERCEL_ORG_ID` | Vercel project scope |
| `VERCEL_PROJECT_ID` | Vercel project scope |
| `STAGING_BACKEND_URL` | Smoke tests + commit status URL |

**Acceptance criteria met**
- ✅ CD triggers on merge to `main`
- ✅ Backend deployed to Railway staging
- ✅ Frontend deployed to Vercel preview/staging
- ✅ Post-deployment smoke tests run against staging URLs
- ✅ Automatic rollback triggered if smoke tests fail

---

## Files changed

```
.github/workflows/cd-staging.yml                         (new)
novaRewards/backend/db/rewardIssuanceRepository.js       (new)
novaRewards/backend/jobs/rewardIssuanceWorker.js         (new)
novaRewards/backend/middleware/rateLimiter.js            (modified)
novaRewards/backend/middleware/slidingRateLimiter.js     (modified)
novaRewards/backend/routes/rewards.js                   (modified)
novaRewards/backend/routes/webhooks.js                  (modified)
novaRewards/backend/server.js                           (modified)
novaRewards/backend/services/rewardIssuanceService.js   (new)
novaRewards/database/019_create_reward_issuances.sql    (new)
novaRewards/frontend/components/CampaignForm.js         (modified)
novaRewards/frontend/components/CampaignManager.js      (modified)
novaRewards/frontend/components/MultiStepForm.js        (modified)
```

## Testing checklist

- [ ] Run `novaRewards/database/019_create_reward_issuances.sql` against staging DB
- [ ] `POST /api/rewards/issue` with same `idempotencyKey` twice → second call returns `200 duplicate: true`
- [ ] Kill Redis mid-request → rate limiter fails open (no 500)
- [ ] Campaign form: refresh browser mid-step → URL param restores correct step
- [ ] Campaign form: submit on Review → confirmation modal appears before API call
- [ ] Pause button on active campaign → campaign status changes to `paused`
- [ ] Push to `main` → CD workflow runs, smoke tests pass, commit status turns green
