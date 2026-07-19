# Nova Rewards — Audit Preparation Checklist

> Closes #392

Use this checklist before engaging an external smart-contract security auditor. Each item links to the relevant file or contract so the reviewer can verify completion status quickly.

---

## Quick-Reference Map

| Area | Key Files |
|------|-----------|
| Smart contracts | `contracts/*/src/lib.rs` |
| Shared errors | `contracts/errors/src/lib.rs` |
| Backend auth | `novaRewards/backend/routes/auth.js`, `middleware/authenticateUser.js` |
| Token service | `novaRewards/backend/services/tokenService.js` |
| Security docs | `docs/security/`, `SECURITY.md` |
| Threat model | `docs/security/threat-model.md` |
| Contract docs | `docs/contracts-full-reference.md`, `docs/abi-reference.md` |
| Error codes | `docs/error-codes.md` |
| Monitoring | `monitoring/`, `monitoring/CHECKLIST.md` |
| Deployment | `novaRewards/deploy/`, `scripts/deploy-contracts.sh` |
| DB migrations | `novaRewards/database/` |

---

## 1. Security Checklist

### 1.1 Access Control
- [ ] Every public contract function that modifies state calls `require_auth()` on the appropriate signer (`admin`, `owner`, or the acting address).
- [ ] `admin_roles` contract is the single source of truth for role grants — no contract hard-codes an admin address.
- [ ] Two-step admin transfer (`propose_admin` / `accept_admin`) is used in `admin_roles` to prevent accidental ownership loss.
- [ ] Multisig threshold (`Threshold`) is set to ≥ 2 on all production contract deployments — verify in `deployments/`.
- [ ] Backend `authenticateUser` middleware uses RS256 JWT verification and checks the Redis blocklist (`isRevoked`) before accepting a token.
- [ ] Backend `requireAdmin` middleware logs privilege-escalation attempts via `AuditService` and `SecurityAlertService`.

### 1.2 Integer Arithmetic
- [ ] All multiplication/division in `calculate_payout` uses `checked_mul` / `checked_div` — overflow panics deterministically.
- [ ] `nova-rewards` uses `i128` for all balance × rate intermediate products to avoid overflow (`SCALE_FACTOR = 1_000_000`).
- [ ] `saturating_add` is used for balance credit operations in `nova_token` to cap at `i128::MAX` rather than wrapping.
- [ ] No bare `*` or `/` on user-supplied numeric inputs anywhere in any contract.

### 1.3 Reentrancy
- [ ] Soroban's execution model is single-threaded and atomic per transaction — cross-contract reentrancy is not possible, but verify no contract calls back into itself via the router.
- [ ] `swap_for_xlm` in `nova-rewards` deducts balance *before* calling the DEX router.
- [ ] `distribute` in the distribution contract deducts token balance before emitting the event.

### 1.4 Input Validation
- [ ] `amount <= 0` is rejected with `AmountMustBePositive` / `InvalidAmount` in every function that accepts a numeric amount.
- [ ] `start_ledger >= end_ledger` is rejected with `InvalidLedgerRange` in campaign and vesting creation.
- [ ] `max_budget == 0` is rejected with `InvalidBudget`.
- [ ] Batch size == 0 or > 50 is rejected with `EmptyBatch` / `BatchTooLarge`.
- [ ] Parallel arrays (`recipients`, `amounts`) length mismatch is rejected with `LengthMismatch`.
- [ ] Backend DTOs (`registerDto`, `loginDto`) validate all fields before any DB query.

### 1.5 Denial of Service
- [ ] Batch operations cap at 50 recipients (`MAX_TOKENS = 5` in campaign, 50 in distribution) to stay within Soroban compute budget.
- [ ] Daily withdrawal limit (`DailyLimit`) prevents a single wallet from draining `nova-rewards` or `reward_pool`.
- [ ] Backend rate limiters: global (100 req/min), login (10/15min), refresh (30/15min) — verify `novaRewards/backend/server.js` mounting.
- [ ] Abuse detection (`checkIpBlock`, `recordFailedLogin`) is applied to `/auth/login`.

### 1.6 Secret / Key Management
- [ ] No hardcoded private keys, mnemonics, or secrets in any contract source file.
- [ ] Backend reads `JWT_PRIVATE_KEY` and `JWT_PUBLIC_KEY` via `configService.getRequiredConfig()` — never from `process.env` directly.
- [ ] `.env` files are in `.gitignore` — verify with `git ls-files novaRewards/.env`.
- [ ] Production secrets are stored in AWS Secrets Manager (`infrastructure/secrets/`).

### 1.7 Upgrade Security
- [ ] All M-of-N upgrade paths require ≥ 2 unique signers in `UpgradeApprovals` before `update_current_contract_wasm` is called.
- [ ] `nova-rewards` `migrate()` panics if `migrated_version >= migration_version` (idempotency guard).
- [ ] WASM hashes are recorded in `deployments/` after every upgrade.

### 1.8 Event Completeness
- [ ] Every state-changing public function emits at least one event.
- [ ] All events include `schema_version` as the first data element (`EVENT_SCHEMA_VERSION = 1`).
- [ ] Event topic pairs are unique across contracts (no topic collision between `("gov", "voted")` and any other contract).

### 1.9 Error Codes
- [ ] `contracts/errors/src/lib.rs` contains a complete, non-overlapping set of error codes (1–30).
- [ ] `docs/error-codes.md` matches the current source — run a diff to verify.
- [ ] Each contract-local error enum (e.g. `ReferralError`, `RedemptionError`) uses codes starting at 1 and does not collide with `ContractError`.

---

## 2. Code Review Checklist

### 2.1 Documentation
- [ ] Every public function in every contract has a `///` rustdoc comment covering: parameters, return value, authorization requirement, panics/errors, and events.
- [ ] `contracts/errors/src/lib.rs` table comment is up to date with all 30 codes.
- [ ] Inline comments explain non-obvious arithmetic (e.g. fixed-point scaling in `calculate_payout`).

### 2.2 Code Quality
- [ ] `cargo fmt --all -- --check` passes with zero diff in `contracts/`.
- [ ] `cargo clippy --all -- -D warnings` produces zero warnings in `contracts/`.
- [ ] No `unwrap()` calls on `Option` or `Result` in production paths — all use `.expect("descriptive message")` or proper error propagation.
- [ ] No `allow(dead_code)` or `allow(unused)` attributes in production code.
- [ ] Shared logic (math, events, constants) lives in `contracts/nova-rewards/src/utils/` — not duplicated across contracts.

### 2.3 Storage
- [ ] Every persistent storage write is followed by `extend_ttl(key, TTL, TTL)` to prevent premature eviction.
- [ ] Instance storage is used for admin/config data; persistent storage for per-user data.
- [ ] No storage key collisions between contracts (each contract has its own `DataKey` enum).

### 2.4 Dependencies
- [ ] `contracts/Cargo.toml` pins `soroban-sdk` to an exact version.
- [ ] No unused crate dependencies in any `Cargo.toml`.
- [ ] `cargo audit` reports zero high/critical CVEs in `contracts/Cargo.lock`.

---

## 3. Testing Checklist

### 3.1 Unit Tests
- [ ] Every public function has a happy-path unit test.
- [ ] Every error variant has a corresponding negative-path test that asserts the expected panic or error code.
- [ ] Tests cover boundary values: 0 amounts, `i128::MAX`, empty vecs, expired ledger numbers.
- [ ] `nova-rewards` tests cover: initialize, set_balance, stake, unstake, claim_staking_reward, swap_for_xlm, pause/unpause, upgrade/migrate.
- [ ] `nova_token` tests cover: initialize, mint, burn, transfer, approve, transfer_from, expired allowance.
- [ ] `campaign` tests cover: create, activate, deactivate, join, issue_reward, end, budget exhaustion.
- [ ] `vesting` tests cover: fund_pool, create_schedule, claim_vested (pre-cliff, mid-vesting, post-vesting), revoke.
- [ ] `referral` tests cover: register_referral, self-referral rejection, double-referral rejection, claim_referral_reward, insufficient pool.
- [ ] `distribution` tests cover: distribute, batch_distribute (at limit, over limit), clawback (within window, after window).
- [ ] `redemption` tests cover: issue_reward, redeem, redeem-after-expiry, reclaim_expired.
- [ ] `admin_roles` tests cover: propose_admin, accept_admin, unauthorized accept, grant_role, revoke_role.

### 3.2 Integration Tests
- [ ] `contracts/integration_tests/` covers cross-contract interaction: campaign → distribution → nova_token flow.
- [ ] Integration test covers the full staking lifecycle across `nova-rewards` + `nova_token`.
- [ ] Integration test covers governance proposal → vote → finalise → execute flow.

### 3.3 Fuzz Tests
- [ ] `contracts/fuzz/fuzz_targets/fuzz_calculate_payout.rs` has non-trivial corpus entries covering zero, negative, and near-overflow inputs.
- [ ] `contracts/fuzz/fuzz_targets/fuzz_vesting.rs` covers edge cases in cliff + duration arithmetic.
- [ ] `contracts/fuzz/fuzz_targets/fuzz_staking.rs` covers rapid stake/unstake sequences.
- [ ] `contracts/fuzz/fuzz_targets/fuzz_token_transfer.rs` covers transfer amounts up to `i128::MAX`.
- [ ] Fuzz targets have been run for at least 10 minutes each: `cargo fuzz run fuzz_calculate_payout -- -max_total_time=600`.

### 3.4 Coverage
- [ ] Contract unit test coverage ≥ 80% of lines (measure with `cargo-llvm-cov`).
- [ ] Backend unit test coverage ≥ 80% of lines for `services/` and `routes/`.
- [ ] CI enforces coverage gate — see `.github/workflows/ci.yml`.

### 3.5 Backend Tests
- [ ] `novaRewards/backend/tests/` includes tests for: auth register, login, refresh, logout, password reset.
- [ ] `middleware/authenticateUser` is tested with: valid token, expired token, revoked token, missing header.
- [ ] `services/tokenService` is tested with: signAccessToken, signRefreshToken, verifyToken, revokeToken, isRevoked.

---

## 4. Documentation Checklist

- [ ] `docs/contracts-full-reference.md` exists and covers all 13 contracts.
- [ ] `docs/abi-reference.md` function signatures match the current contract source.
- [ ] `docs/error-codes.md` lists all 30 shared error codes plus contract-local errors.
- [ ] `docs/upgrade-guide.md` covers both upgrade patterns (two-step and M-of-N multisig).
- [ ] `contracts/README.md` contract address table is populated with testnet contract IDs from `deployments/`.
- [ ] `SECURITY.md` disclosure policy, scope, and severity tiers are current.
- [ ] `CHANGELOG.md` entry exists for this audit cycle (date, scope, auditor name TBD).
- [ ] OpenAPI spec (`docs/api/openapi.json`) is regenerated: `npm run generate:openapi`.

---

## 5. Deployment Checklist

- [ ] All contract IDs are recorded in `deployments/` with network, deployer address, and deploy timestamp.
- [ ] `MigrationVersion == MigratedVersion` for `nova-rewards` on each deployed network (verify with `stellar contract invoke -- get_migration_version`).
- [ ] Multisig threshold is ≥ 2 for all upgradeable contracts on mainnet.
- [ ] Admin keys are stored in AWS Secrets Manager — not in `.env` files or source control.
- [ ] `validateEnv` middleware startup check passes for all required environment variables.
- [ ] Docker images are built from pinned base images (no `latest` tags in `Dockerfile`s).
- [ ] `novaRewards/database/` migrations run cleanly on a fresh PostgreSQL instance: `npm run migrate`.
- [ ] DB migration 023 (`create_refresh_tokens`) and 024 (`add_password_reset_tokens`) are applied on all environments.
- [ ] TLS certificates are configured and auto-renewed (`infrastructure/ssl/certbot-renewal.service`).
- [ ] Rate limiter Redis key prefix is namespaced per environment to prevent cross-env bleed.

---

## 6. Monitoring Checklist

- [ ] Prometheus metrics endpoint (`/metrics`) is active and scraped on all backend instances.
- [ ] Grafana dashboard (`monitoring/grafana/`) includes panels for: contract event volume, auth failure rate, API error rate, DB connection count.
- [ ] Alert rules (`monitoring/prometheus/rules/`) fire for: high error rate (> 5%), service down, high latency (p99 > 2s), low disk space.
- [ ] Alertmanager (`monitoring/alertmanager/alertmanager.yml`) routes critical alerts to on-call channel.
- [ ] Audit log retention policy (`novaRewards/database/021_audit_logs_retention_policy.sql`) is applied — logs retained for ≥ 90 days.
- [ ] `monitoring/runbooks/` runbooks exist for all alert types: high-error-rate, high-latency, postgres-down, redis-down, service-down, high-cpu, high-memory, low-disk-space, high-db-connections.
- [ ] Contract event indexing is operational — `contractEventService.js` is processing events without lag.
- [ ] Blackbox exporter (`monitoring/blackbox/blackbox.yml`) probes `/health` endpoint every 30 seconds.
- [ ] On-call rotation is documented in `docs/ops/on-call.md`.
- [ ] Incident response plan (`docs/security/incident-response-plan.md`) is reviewed and current.
