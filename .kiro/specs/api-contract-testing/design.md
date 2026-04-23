# Design Document: API Contract Testing with Pact

## Overview

This design introduces consumer-driven contract testing between the Nova Rewards frontend (Next.js, consumer) and backend (Express, provider) using the [Pact](https://docs.pact.io/) framework. The goal is to detect breaking API changes automatically before they reach integration testing or production.

The approach works in two halves:

1. **Consumer side** — the frontend test suite uses a Pact mock server to record every HTTP interaction it depends on, producing a JSON contract file.
2. **Provider side** — the backend CI replays those recorded interactions against the real running server and asserts the responses match.

A self-hosted [Pact Broker](https://docs.pact.io/pact_broker) acts as the shared store for contracts and verification results, and the `can-i-deploy` CLI command gates PR merges.

### Key Design Decisions

- **Pact v4 (JS SDK `@pact-foundation/pact`)** — the current major version with first-class support for both consumer and provider in JavaScript/TypeScript. Chosen over Pact v2/v3 for improved matching DSL and better async support.
- **Self-hosted Pact Broker** — deployed as a Docker container (official `pactfoundation/pact-broker` image) rather than PactFlow SaaS, keeping costs zero and data on-premises.
- **Flexible body matching** — provider verification uses Pact's type-based matchers (`like`, `eachLike`, `integer`, `string`) rather than exact value matching, so test data differences do not cause false failures.
- **Webhook-triggered provider verification** — the Pact Broker fires an HTTP webhook to the GitHub Actions API when a new contract is published, triggering the provider verification job without polling.
- **Isolated consumer job** — consumer tests run with no network access to the real backend; the Pact mock server is the only HTTP endpoint.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          GitHub Actions CI                               │
│                                                                          │
│  ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐   │
│  │  frontend-build  │    │  consumer-pact   │    │  can-i-deploy    │   │
│  │  (next build)    │───►│  (jest + pact)   │───►│  (consumer)      │   │
│  └──────────────────┘    └────────┬─────────┘    └──────────────────┘   │
│                                   │ publish pacts                        │
│  ┌──────────────────┐    ┌────────▼─────────┐    ┌──────────────────┐   │
│  │  backend-unit    │    │   Pact Broker    │    │  can-i-deploy    │   │
│  │  (jest)          │───►│  (Docker)        │◄───│  (provider)      │   │
│  └──────────────────┘    └────────┬─────────┘    └──────────────────┘   │
│                                   │ webhook → trigger                    │
│                          ┌────────▼─────────┐                           │
│                          │  provider-verify  │                           │
│                          │  (jest + pact)    │                           │
│                          └──────────────────┘                           │
└──────────────────────────────────────────────────────────────────────────┘
```

### CI Job Dependency Graph

```
secret-scan
    │
    ├── frontend-build ──► consumer-pact ──► can-i-deploy (consumer)
    │                                                │
    └── backend-unit ──► provider-verify ──► can-i-deploy (provider)
                                │
                         publish verification result
                                │
                         Pact Broker dashboard
```

---

## Components and Interfaces

### 1. Consumer Test Suite (`novaRewards/frontend/pact/`)

**Location:** `novaRewards/frontend/pact/`

**Responsibilities:**
- Define one Pact interaction per API call the frontend makes
- Run interactions against the Pact mock server (no real backend)
- Assert mock responses match expected shapes
- Emit one `pacts/nova-rewards-frontend-nova-rewards-backend.json` contract file

**Key files:**
```
novaRewards/frontend/pact/
├── setup.js                  # Pact mock provider lifecycle (beforeAll/afterAll)
├── auth.pact.test.js         # /auth/login, /auth/register
├── transactions.pact.test.js # /transactions/record, /transactions/merchant-totals
├── campaigns.pact.test.js    # /campaigns, /campaigns/{merchantId}
├── rewards.pact.test.js      # /rewards, /rewards/{id}
├── admin.pact.test.js        # /admin/stats, /admin/users, /admin/rewards
├── leaderboard.pact.test.js  # /leaderboard
├── drops.pact.test.js        # /drops, /drops/claim
└── users.pact.test.js        # /users/profile, /users/referral
```

**Interface — Pact mock provider setup:**
```js
// pact/setup.js
const { PactV4 } = require('@pact-foundation/pact');
const path = require('path');

const provider = new PactV4({
  consumer: 'nova-rewards-frontend',
  provider: 'nova-rewards-backend',
  dir: path.resolve(__dirname, '../pacts'),
  logLevel: 'warn',
});
module.exports = { provider };
```

**Interface — example consumer interaction:**
```js
// pact/auth.pact.test.js
const { provider } = require('./setup');
const { like, string } = require('@pact-foundation/pact').Matchers;

describe('Auth contract', () => {
  it('POST /auth/login returns tokens on valid credentials', async () => {
    await provider
      .addInteraction({
        states: [{ description: 'a registered user exists' }],
        uponReceiving: 'a valid login request',
        withRequest: {
          method: 'POST',
          path: '/api/auth/login',
          headers: { 'Content-Type': 'application/json' },
          body: { email: 'alice@example.com', password: 'S3cur3P@ss!' },
        },
        willRespondWith: {
          status: 200,
          headers: { 'Content-Type': like('application/json') },
          body: {
            success: true,
            data: {
              accessToken: string('token'),
              refreshToken: string('token'),
              user: like({ id: 1, email: 'alice@example.com' }),
            },
          },
        },
      })
      .executeTest(async (mockServer) => {
        const res = await axios.post(`${mockServer.url}/api/auth/login`, {
          email: 'alice@example.com',
          password: 'S3cur3P@ss!',
        });
        expect(res.status).toBe(200);
        expect(res.data.success).toBe(true);
        expect(res.data.data.accessToken).toBeDefined();
      });
  });
});
```

---

### 2. Provider Verification Suite (`novaRewards/backend/pact/`)

**Location:** `novaRewards/backend/pact/`

**Responsibilities:**
- Start the Express app on a random port
- Fetch contracts from the Pact Broker
- Replay each interaction against the live server
- Set up provider state (seed DB / mock dependencies) via state handlers
- Publish verification results back to the Pact Broker

**Key files:**
```
novaRewards/backend/pact/
├── provider.pact.test.js     # Main verifier entry point
└── stateHandlers.js          # Provider state setup functions
```

**Interface — provider verifier:**
```js
// backend/pact/provider.pact.test.js
const { Verifier } = require('@pact-foundation/pact');
const app = require('../server');

describe('Pact Provider Verification', () => {
  let server;
  beforeAll(() => { server = app.listen(0); });
  afterAll(() => server.close());

  it('verifies all consumer contracts', () => {
    const port = server.address().port;
    return new Verifier({
      providerBaseUrl: `http://localhost:${port}`,
      pactBrokerUrl: process.env.PACT_BROKER_URL,
      pactBrokerToken: process.env.PACT_BROKER_TOKEN,
      provider: 'nova-rewards-backend',
      providerVersion: process.env.GIT_COMMIT,
      providerVersionBranch: process.env.GIT_BRANCH,
      publishVerificationResult: process.env.CI === 'true',
      stateHandlers: require('./stateHandlers'),
      logLevel: 'warn',
    }).verifyProvider();
  });
});
```

**Interface — state handlers:**
```js
// backend/pact/stateHandlers.js
module.exports = {
  'a registered user exists': async () => {
    // seed test user into DB or configure mock
  },
  'merchant campaigns exist': async () => {
    // seed campaigns
  },
  'rewards are available': async () => {
    // seed rewards
  },
  // ... one handler per provider state referenced in consumer tests
};
```

---

### 3. Pact Broker

**Deployment:** Docker container on the existing EC2 instance (or a dedicated small instance), fronted by Nginx.

**Image:** `pactfoundation/pact-broker:latest` with a PostgreSQL backing store (reuses the existing RDS instance with a dedicated `pact_broker` database).

**Environment variables:**
```
PACT_BROKER_DATABASE_URL=postgresql://pact_user:***@rds-host/pact_broker
PACT_BROKER_BASIC_AUTH_USERNAME=admin
PACT_BROKER_BASIC_AUTH_PASSWORD=<secret>
PACT_BROKER_BASE_URL=https://pact.novarewards.io
```

**Webhook configuration** (created via Pact Broker API on first deploy):
```json
{
  "events": [{ "name": "contract_published" }],
  "request": {
    "method": "POST",
    "url": "https://api.github.com/repos/nova-rewards/nova-rewards/dispatches",
    "headers": {
      "Authorization": "Bearer ${user.github_token}",
      "Content-Type": "application/json"
    },
    "body": { "event_type": "pact-provider-verify" }
  }
}
```

---

### 4. CI Pipeline Jobs

**New GitHub Actions jobs added to `.github/workflows/ci.yml`:**

| Job | Trigger | Depends on | Timeout |
|-----|---------|------------|---------|
| `consumer-pact` | push / PR | `frontend-build` | 10 min |
| `provider-verify` | push / PR + `pact-provider-verify` dispatch | `backend-unit` | 10 min |
| `can-i-deploy-consumer` | push / PR | `consumer-pact` | 5 min |
| `can-i-deploy-provider` | push / PR | `provider-verify` | 5 min |

**`consumer-pact` job (abbreviated):**
```yaml
consumer-pact:
  name: Consumer Pact Tests
  runs-on: ubuntu-latest
  needs: frontend-build
  defaults:
    run:
      working-directory: novaRewards/frontend
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with: { node-version: 20 }
    - run: npm install
      working-directory: novaRewards
    - run: npx jest --testPathPattern="pact/" --runInBand
      env:
        PACT_BROKER_URL: ${{ secrets.PACT_BROKER_URL }}
        PACT_BROKER_TOKEN: ${{ secrets.PACT_BROKER_TOKEN }}
    - name: Publish pacts
      run: npx pact-broker publish ./pacts
        --broker-base-url $PACT_BROKER_URL
        --broker-token $PACT_BROKER_TOKEN
        --consumer-app-version ${{ github.sha }}
        --branch ${{ github.ref_name }}
      env:
        PACT_BROKER_URL: ${{ secrets.PACT_BROKER_URL }}
        PACT_BROKER_TOKEN: ${{ secrets.PACT_BROKER_TOKEN }}
```

**`can-i-deploy` job (abbreviated):**
```yaml
can-i-deploy-consumer:
  name: Can I Deploy (Consumer)
  runs-on: ubuntu-latest
  needs: consumer-pact
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with: { node-version: 20 }
    - run: npm install -g @pact-foundation/pact-node
    - run: npx pact-broker can-i-deploy
        --pacticipant nova-rewards-frontend
        --version ${{ github.sha }}
        --to-environment production
        --broker-base-url $PACT_BROKER_URL
        --broker-token $PACT_BROKER_TOKEN
      env:
        PACT_BROKER_URL: ${{ secrets.PACT_BROKER_URL }}
        PACT_BROKER_TOKEN: ${{ secrets.PACT_BROKER_TOKEN }}
```

---

## Data Models

### Contract File (Pact JSON)

The contract file is generated automatically by the Pact library. Its structure is:

```json
{
  "consumer": { "name": "nova-rewards-frontend" },
  "provider": { "name": "nova-rewards-backend" },
  "interactions": [
    {
      "description": "a valid login request",
      "providerStates": [{ "name": "a registered user exists" }],
      "request": {
        "method": "POST",
        "path": "/api/auth/login",
        "headers": { "Content-Type": "application/json" },
        "body": { "email": "alice@example.com", "password": "S3cur3P@ss!" }
      },
      "response": {
        "status": 200,
        "headers": { "Content-Type": "application/json; charset=utf-8" },
        "body": {
          "success": true,
          "data": {
            "accessToken": "token",
            "refreshToken": "token",
            "user": { "id": 1, "email": "alice@example.com" }
          }
        },
        "matchingRules": {
          "body": {
            "$.data.accessToken": { "matchers": [{ "match": "type" }] },
            "$.data.refreshToken": { "matchers": [{ "match": "type" }] },
            "$.data.user": { "matchers": [{ "match": "type" }] }
          }
        }
      }
    }
  ],
  "metadata": {
    "pactSpecification": { "version": "4.0" }
  }
}
```

### Pact Broker Database Schema (managed by the broker itself)

The Pact Broker manages its own PostgreSQL schema. Key logical entities:

| Entity | Description |
|--------|-------------|
| `pacticipant` | A named participant (consumer or provider) |
| `version` | A tagged version of a pacticipant (commit SHA + branch) |
| `pact_publication` | A published contract between a consumer version and provider |
| `verification_result` | Pass/fail result from a provider verification run |
| `webhook` | Configured HTTP callbacks for broker events |

### Environment Variables

| Variable | Used by | Description |
|----------|---------|-------------|
| `PACT_BROKER_URL` | CI (all jobs) | Base URL of the Pact Broker |
| `PACT_BROKER_TOKEN` | CI (all jobs) | Bearer token for broker auth |
| `GIT_COMMIT` | Provider verify job | Current commit SHA for version tagging |
| `GIT_BRANCH` | Provider verify job | Current branch name for version tagging |

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Consumer interaction round-trip fidelity

*For any* recorded consumer interaction, executing the interaction against the Pact mock server and then replaying it against the provider SHALL produce responses that satisfy the same matching rules (status code, content-type header, and body structure).

**Validates: Requirements 2.2, 3.2**

### Property 2: Contract completeness

*For any* API endpoint group defined in the OpenAPI specification, the generated contract file SHALL contain at least one interaction covering a success (2xx) response and at least one interaction covering an error (4xx) response.

**Validates: Requirements 1.1, 1.6**

### Property 3: Contract file determinism

*For any* consumer test run that produces the same set of interactions, the resulting contract file SHALL be structurally equivalent regardless of test execution order.

**Validates: Requirements 1.4**

### Property 4: Verification result consistency

*For any* provider version that passes all interactions in a contract, publishing that verification result to the Pact Broker SHALL cause the `can-i-deploy` check for that consumer–provider pair to return success.

**Validates: Requirements 4.1, 4.2, 4.4, 4.5**

---

## Error Handling

### Consumer Test Failures

| Failure | Behaviour |
|---------|-----------|
| Mock server response does not match expected | Test exits non-zero; contract file is NOT written for that interaction |
| Pact Broker unreachable during publish | `pact-broker publish` exits non-zero; CI job fails; downstream jobs are skipped |
| Consumer test suite times out (> 10 min) | GitHub Actions cancels the job; pipeline marked failed |

### Provider Verification Failures

| Failure | Behaviour |
|---------|-----------|
| Interaction replay returns wrong status/body | Verifier reports the diff and exits non-zero; CI job fails |
| Provider state handler throws | Verifier logs the error and marks that interaction as failed |
| Pact Broker unreachable during contract fetch | Verifier exits non-zero; CI job fails |
| Provider server fails to start | `beforeAll` throws; all tests in the suite fail |

### Can-I-Deploy Failures

| Failure | Behaviour |
|---------|-----------|
| No verification result found for the version | `can-i-deploy` exits non-zero with "no results" message |
| Verification result is a failure | `can-i-deploy` exits non-zero; GitHub status check set to failed; PR merge blocked |
| Pact Broker unreachable | `can-i-deploy` exits non-zero; PR merge blocked (fail-safe) |

### Pact Broker Webhook Failures

If the webhook to trigger provider verification fails (GitHub API unreachable, token expired), the Pact Broker retries up to 3 times with exponential backoff. If all retries fail, the broker logs the failure; the provider team must manually trigger the `provider-verify` workflow.

---

## Testing Strategy

### Consumer Tests (property-based + example-based)

**Framework:** Jest + `@pact-foundation/pact` v13+

**Location:** `novaRewards/frontend/pact/*.pact.test.js`

**Approach:**
- Each test file covers one API endpoint group.
- Each test case defines one Pact interaction (one request → one response).
- Both success and error paths are covered per endpoint.
- Tests run with no real network access; the Pact mock server is the only HTTP endpoint.
- Minimum coverage: all endpoint groups listed in Requirement 1.1.

**Jest configuration addition** (`novaRewards/frontend/jest.config.js`):
```js
// Add a separate project for pact tests so they run in isolation
projects: [
  { displayName: 'unit', testMatch: ['**/__tests__/**/*.test.js'] },
  { displayName: 'pact', testMatch: ['**/pact/**/*.pact.test.js'] },
]
```

### Provider Verification Tests

**Framework:** Jest + `@pact-foundation/pact` Verifier

**Location:** `novaRewards/backend/pact/provider.pact.test.js`

**Approach:**
- The verifier fetches contracts from the Pact Broker (not from the filesystem) so it always tests the latest published contract.
- Provider state handlers use the existing test DB helpers (already used in `novaRewards/backend/tests/`) to seed data.
- Verification results are published back to the broker only when `CI=true`.
- The backend server is started on a random port to avoid conflicts with other test processes.

### Unit Tests

Existing Jest unit tests in `novaRewards/backend/tests/` and `novaRewards/frontend/__tests__/` are unaffected. Contract tests are additive.

### Integration Tests

Contract tests run **before** integration tests in the CI pipeline. A failing contract test does not cancel the integration test job (they are independent jobs), but the overall pipeline is marked failed.

### Property-Based Testing

The feature itself (the Pact framework and CI orchestration) is infrastructure/configuration in nature. The correctness properties above are verified by the Pact framework itself during consumer test execution and provider verification — they are not implemented as separate property-based test suites. The properties serve as formal specifications that the Pact interactions must satisfy.

For the consumer interaction round-trip property (Property 1), the Pact framework inherently validates this: every interaction recorded by the consumer is replayed against the provider, and the matching rules are applied. This is the core mechanism of consumer-driven contract testing.

### New Dependencies

**Frontend:**
```json
"@pact-foundation/pact": "^13.0.0"
```

**Backend:**
```json
"@pact-foundation/pact": "^13.0.0"
```

Both pinned to an exact major version to prevent unexpected breaking changes from upstream.

### CI Secrets Required

| Secret name | Description |
|-------------|-------------|
| `PACT_BROKER_URL` | Base URL of the self-hosted Pact Broker |
| `PACT_BROKER_TOKEN` | Bearer token for Pact Broker authentication |
| `PACT_BROKER_WEBHOOK_SECRET` | Shared secret for validating incoming webhook calls |
