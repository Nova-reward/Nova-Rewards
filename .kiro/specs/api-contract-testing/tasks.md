# Implementation Plan: API Contract Testing with Pact

## Overview

Implement consumer-driven contract testing between the Nova Rewards frontend (consumer) and backend (provider) using the Pact JS SDK v13. The work is split into four phases: installing dependencies and scaffolding, writing consumer Pact tests, writing the provider verifier, and wiring up the CI pipeline with `can-i-deploy` gates.

## Tasks

- [x] 1. Install Pact dependencies and configure Jest projects
  - Add `"@pact-foundation/pact": "^13.0.0"` to `novaRewards/frontend/package.json` devDependencies
  - Add `"@pact-foundation/pact": "^13.0.0"` to `novaRewards/backend/package.json` devDependencies
  - Update `novaRewards/frontend/jest.config.js` to add a separate `pact` Jest project that matches `**/pact/**/*.pact.test.js` and runs in `node` environment (Pact mock server is not DOM-based), keeping the existing `unit` project for `__tests__/`
  - Update `novaRewards/backend/jest.config.js` to add a `pact` project matching `**/pact/**/*.pact.test.js` and exclude it from the default `testMatch` so it does not run with `npm test`
  - Create the output directory `novaRewards/frontend/pacts/` with a `.gitkeep` so the path exists before the first test run
  - _Requirements: 1.2, 1.4, 6.1, 6.6_

- [x] 2. Create the consumer Pact mock provider setup module
  - Create `novaRewards/frontend/pact/setup.js` that instantiates a `PactV4` provider with `consumer: 'nova-rewards-frontend'`, `provider: 'nova-rewards-backend'`, and `dir` pointing to `../pacts`
  - Export the `provider` instance for use in all consumer test files
  - _Requirements: 1.2, 1.4_

- [x] 3. Implement Auth consumer Pact tests
  - Create `novaRewards/frontend/pact/auth.pact.test.js`
  - Add interaction: `POST /api/auth/login` with valid credentials → 200 with `{ success: true, data: { accessToken: string, refreshToken: string, user: like({...}) } }` using type matchers
  - Add interaction: `POST /api/auth/login` with invalid credentials → 401 with `{ success: false, error: string }`
  - Add interaction: `POST /api/auth/register` with valid body → 201 with `{ success: true, data: like({id, email}) }`
  - Add interaction: `POST /api/auth/register` with duplicate email → 409 with `{ success: false, error: string }`
  - Each interaction uses `executeTest` to make a real HTTP call to the mock server and assert the response shape
  - _Requirements: 1.1, 1.2, 1.3, 1.5, 1.6_

- [x] 4. Implement Transactions consumer Pact tests
  - Create `novaRewards/frontend/pact/transactions.pact.test.js`
  - Add interaction: `POST /api/transactions/record` with valid body → 201 success response using type matchers
  - Add interaction: `POST /api/transactions/record` with missing fields → 400 error response
  - Add interaction: `GET /api/transactions/merchant-totals` with auth header → 200 with array of totals using `eachLike`
  - Add interaction: `GET /api/transactions/merchant-totals` without auth → 401 error response
  - _Requirements: 1.1, 1.2, 1.3, 1.6_

- [x] 5. Implement Campaigns consumer Pact tests
  - Create `novaRewards/frontend/pact/campaigns.pact.test.js`
  - Add interaction: `GET /api/campaigns` with merchant API key → 200 with `eachLike` campaign array
  - Add interaction: `GET /api/campaigns` without API key → 401 error response
  - Add interaction: `GET /api/campaigns/{merchantId}` with valid ID → 200 with campaign array
  - Add interaction: `GET /api/campaigns/{merchantId}` with unknown ID → 404 error response
  - _Requirements: 1.1, 1.2, 1.3, 1.6_

- [x] 6. Implement Rewards consumer Pact tests
  - Create `novaRewards/frontend/pact/rewards.pact.test.js`
  - Add interaction: `GET /api/rewards` with auth → 200 with `eachLike` reward array
  - Add interaction: `GET /api/rewards` without auth → 401 error response
  - Add interaction: `GET /api/rewards/{id}` with valid ID → 200 with single reward using `like`
  - Add interaction: `GET /api/rewards/{id}` with unknown ID → 404 error response
  - _Requirements: 1.1, 1.2, 1.3, 1.6_

- [x] 7. Implement Admin consumer Pact tests
  - Create `novaRewards/frontend/pact/admin.pact.test.js`
  - Add interaction: `GET /api/admin/stats` with admin auth → 200 with `AdminStats` shape using `like`
  - Add interaction: `GET /api/admin/stats` without auth → 401 error response
  - Add interaction: `GET /api/admin/stats` with non-admin auth → 403 error response
  - Add interaction: `GET /api/admin/users` with admin auth → 200 with paginated user list using `eachLike`
  - Add interaction: `POST /api/admin/rewards` with valid body → 201 with created reward using `like`
  - Add interaction: `POST /api/admin/rewards` with missing required fields → 400 error response
  - _Requirements: 1.1, 1.2, 1.3, 1.6_

- [x] 8. Implement Leaderboard, Drops, and Users consumer Pact tests
  - Create `novaRewards/frontend/pact/leaderboard.pact.test.js`
    - Add interaction: `GET /api/leaderboard` → 200 with `eachLike` leaderboard entry array
    - Add interaction: `GET /api/leaderboard` unauthenticated → 401 error response
  - Create `novaRewards/frontend/pact/drops.pact.test.js`
    - Add interaction: `GET /api/drops` → 200 with `eachLike` drop array
    - Add interaction: `POST /api/drops/claim` with valid body → 200 success response
    - Add interaction: `POST /api/drops/claim` with invalid/expired drop → 400 or 404 error response
  - Create `novaRewards/frontend/pact/users.pact.test.js`
    - Add interaction: `GET /api/users/profile` with auth → 200 with user profile using `like`
    - Add interaction: `GET /api/users/profile` without auth → 401 error response
    - Add interaction: `GET /api/users/referral` with auth → 200 with referral info using `like`
  - _Requirements: 1.1, 1.2, 1.3, 1.6_

- [x] 9. Checkpoint — Verify consumer contract generation
  - Run `npx jest --testPathPattern="pact/" --runInBand` from `novaRewards/frontend` and confirm all consumer tests pass
  - Confirm `novaRewards/frontend/pacts/nova-rewards-frontend-nova-rewards-backend.json` is generated with interactions for all endpoint groups
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Implement provider state handlers
  - Create `novaRewards/backend/pact/stateHandlers.js`
  - Implement a handler for each provider state referenced across all consumer test files:
    - `'a registered user exists'` — seed or mock a user record
    - `'merchant campaigns exist'` — seed or mock campaign records
    - `'rewards are available'` — seed or mock reward records
    - `'admin user is authenticated'` — configure mock auth middleware to accept admin role
    - `'leaderboard entries exist'` — seed or mock leaderboard data
    - `'a drop is available'` — seed or mock an active drop
    - `'user profile exists'` — seed or mock a user profile with referral info
  - Reuse existing test DB helpers from `novaRewards/backend/tests/` where available; fall back to jest mocks for external dependencies
  - _Requirements: 3.1, 3.2_

- [x] 11. Implement the provider verifier test
  - Create `novaRewards/backend/pact/provider.pact.test.js`
  - In `beforeAll`, start the Express app (`require('../server')`) on a random port using `app.listen(0)`
  - In `afterAll`, close the server
  - Instantiate `Verifier` with:
    - `providerBaseUrl` pointing to `http://localhost:{port}`
    - `pactBrokerUrl` from `process.env.PACT_BROKER_URL`
    - `pactBrokerToken` from `process.env.PACT_BROKER_TOKEN`
    - `provider: 'nova-rewards-backend'`
    - `providerVersion` from `process.env.GIT_COMMIT`
    - `providerVersionBranch` from `process.env.GIT_BRANCH`
    - `publishVerificationResult: process.env.CI === 'true'`
    - `stateHandlers` imported from `./stateHandlers`
  - Call `verifier.verifyProvider()` and return the promise
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 12. Checkpoint — Verify provider verification runs locally
  - Run `npx jest --testPathPattern="pact/" --runInBand` from `novaRewards/backend` with `PACT_BROKER_URL` and `PACT_BROKER_TOKEN` set (or using local pact files via `pactUrls` for local testing)
  - Confirm the verifier replays all interactions and reports pass/fail per interaction
  - Ensure all tests pass, ask the user if questions arise.

- [x] 13. Add `consumer-pact` CI job to `.github/workflows/ci.yml`
  - Add a `consumer-pact` job that:
    - `needs: frontend` (the existing frontend build job)
    - Sets `working-directory: novaRewards/frontend`
    - Runs `npm install` from `novaRewards/`
    - Runs `npx jest --testPathPattern="pact/" --runInBand` with `PACT_BROKER_URL` and `PACT_BROKER_TOKEN` from secrets
    - Publishes pacts using `npx pact-broker publish ./pacts --broker-base-url $PACT_BROKER_URL --broker-token $PACT_BROKER_TOKEN --consumer-app-version ${{ github.sha }} --branch ${{ github.ref_name }}`
    - Sets a 10-minute timeout
  - _Requirements: 2.1, 2.2, 6.1, 6.3, 6.5_

- [x] 14. Add `provider-verify` CI job to `.github/workflows/ci.yml`
  - Add a `provider-verify` job that:
    - `needs: test` (the existing backend test job, named `test` in ci.yml)
    - Also triggers on `repository_dispatch` event type `pact-provider-verify`
    - Runs `npm install` from `novaRewards/`
    - Runs `npx jest --testPathPattern="pact/" --runInBand` from `novaRewards/backend` with `PACT_BROKER_URL`, `PACT_BROKER_TOKEN`, `GIT_COMMIT: ${{ github.sha }}`, `GIT_BRANCH: ${{ github.ref_name }}`, and `CI: true`
    - Sets a 10-minute timeout
  - _Requirements: 3.1, 3.4, 3.5, 6.2, 6.4, 6.5_

- [x] 15. Add `can-i-deploy` CI jobs to `.github/workflows/ci.yml`
  - Add `can-i-deploy-consumer` job that:
    - `needs: consumer-pact`
    - Installs `@pact-foundation/pact-node` globally
    - Runs `npx pact-broker can-i-deploy --pacticipant nova-rewards-frontend --version ${{ github.sha }} --to-environment production --broker-base-url $PACT_BROKER_URL --broker-token $PACT_BROKER_TOKEN`
    - Sets a 5-minute timeout
  - Add `can-i-deploy-provider` job that:
    - `needs: provider-verify`
    - Runs the same `can-i-deploy` command with `--pacticipant nova-rewards-backend`
    - Sets a 5-minute timeout
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [x] 16. Configure the Pact Broker webhook for provider verification dispatch
  - Create `novaRewards/scripts/setup-pact-webhook.js` — a one-time setup script that calls the Pact Broker REST API to register the webhook
  - The webhook should POST to `https://api.github.com/repos/{owner}/{repo}/dispatches` with `event_type: pact-provider-verify` when a `contract_published` event fires
  - Include the `Authorization: Bearer ${GITHUB_TOKEN}` header using a GitHub PAT stored as `PACT_BROKER_WEBHOOK_SECRET` in the broker's environment
  - Document the required environment variables (`PACT_BROKER_URL`, `PACT_BROKER_TOKEN`, `GITHUB_TOKEN`, `GITHUB_REPO`) in a comment block at the top of the script
  - _Requirements: 3.6_

- [x] 17. Final checkpoint — End-to-end CI pipeline validation
  - Verify the full job dependency chain in `ci.yml`: `secret-scan → frontend → consumer-pact → can-i-deploy-consumer` and `secret-scan → test → provider-verify → can-i-deploy-provider`
  - Confirm `consumer-pact` job fails fast (non-zero exit) when a consumer test fails, skipping the publish step (requirement 6.3)
  - Confirm `provider-verify` job failure does not cancel unrelated jobs such as `frontend` (requirement 6.4)
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- The design's Correctness Properties (1–4) are validated by the Pact framework itself during consumer test execution and provider verification — they are not separate property-based test suites (as noted in the design's Testing Strategy section)
- The `pact` Jest project in both frontend and backend must run with `--runInBand` to avoid port conflicts between concurrent mock server instances
- Provider state handlers should prefer the existing test DB helpers in `novaRewards/backend/tests/` over introducing new seeding mechanisms
- The Pact Broker Docker deployment and PostgreSQL `pact_broker` database setup are infrastructure tasks outside the scope of this coding plan; the CI jobs assume the broker is already reachable at `PACT_BROKER_URL`
- CI secrets (`PACT_BROKER_URL`, `PACT_BROKER_TOKEN`, `PACT_BROKER_WEBHOOK_SECRET`) must be added to the GitHub repository settings before the pipeline jobs can run
