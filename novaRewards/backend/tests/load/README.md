# Nova Rewards — k6 Load Tests

Issue [#638](https://github.com/milah-247/Nova-Rewards/issues/638)

## Overview

k6 load test scripts for the three critical API endpoints:

| Script | Endpoint |
|--------|----------|
| `scenarios/webhook-actions.js` | `POST /api/webhooks/actions` |
| `scenarios/user-balance.js` | `GET /api/users/:id/balance` |
| `scenarios/campaigns-list.js` | `GET /api/campaigns` |
| `full-suite.js` | All three concurrently |

## Load profile

- Ramp from **0 → 100 VUs** over 5 minutes
- Sustain **100 VUs** for 10 minutes
- Ramp down to 0 over 1 minute

## SLA thresholds

| Metric | Target |
|--------|--------|
| p95 response time | < 500 ms |
| Error rate | < 0.1 % |

## Prerequisites

1. **k6** installed — [https://k6.io/docs/get-started/installation/](https://k6.io/docs/get-started/installation/)
2. Backend running locally or pointing to a staging environment
3. DB seeded with load-test fixtures (see below)

## Quick start

```bash
# 1. Seed the DB and get credentials
npm run load:seed
# Follow the printed export instructions, e.g.:
export LOAD_TEST_USER_TOKEN="eyJ..."
export LOAD_TEST_MERCHANT_KEYS="load-test-merchant-key-1,load-test-merchant-key-2,load-test-merchant-key-3"

# 2. Start the backend (separate terminal)
npm run dev

# 3. Run individual scenarios
npm run load:webhook
npm run load:balance
npm run load:campaigns

# 4. Or run the full suite (all three concurrently, ~300 peak VUs)
npm run load:all
```

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `BASE_URL` | `http://localhost:3001` | Backend base URL |
| `WEBHOOK_SECRET` | `test_secret` | `INBOUND_WEBHOOK_SECRET` value |
| `USER_TOKEN` | _(required)_ | JWT for `GET /users/:id/balance` |
| `USER_ID_MIN` | `1` | Lower bound of user ID pool |
| `USER_ID_MAX` | `500` | Upper bound of user ID pool |
| `MERCHANT_API_KEYS` | `test-api-key` | Comma-separated merchant API keys |

## CI artifacts

The CI `load-test` job uploads all results to the **`load-test-results`** artifact (retained 30 days):

```
test-results/load/
├── webhook-actions-raw.json      # k6 raw JSON output
├── webhook-actions-summary.json  # handleSummary output
├── user-balance-raw.json
├── user-balance-summary.json
├── campaigns-list-raw.json
├── campaigns-list-summary.json
├── full-suite-raw.json
└── full-suite-summary.json
```

## Bottleneck analysis

See [`BOTTLENECKS.md`](./BOTTLENECKS.md) for identified performance bottlenecks and remediation recommendations for each endpoint.
