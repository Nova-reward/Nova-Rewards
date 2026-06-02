# Troubleshooting Guide

Search this page for the exact error message or symptom you are seeing. Each entry lists the error, its cause, and the fix.

---

## Table of Contents

1. [Setup Errors](#1-setup-errors)
2. [Runtime / Environment Errors](#2-runtime--environment-errors)
3. [Stellar / Horizon Errors](#3-stellar--horizon-errors)
4. [Database Errors](#4-database-errors)
5. [Docker / Container Errors](#5-docker--container-errors)
6. [Collecting Diagnostics for Bug Reports](#6-collecting-diagnostics-for-bug-reports)

---

## 1. Setup Errors

### 1.1 `rustup is required. Install Rust from https://rustup.rs first.`

**Symptom:** Running `./scripts/setup-soroban-dev.sh` exits immediately with the message above.

**Cause:** Rust is not installed on the machine.

**Fix:**
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source "$HOME/.cargo/env"
./scripts/setup-soroban-dev.sh
```

---

### 1.2 `stellar CLI is required.`

**Symptom:** `setup-soroban-dev.sh` exits with `stellar CLI is required.`

**Cause:** The Stellar CLI (`stellar`) is not installed or not on `$PATH`.

**Fix:** Install the CLI following the [official guide](https://developers.stellar.org/docs/tools/cli/install-cli), then re-run the setup script.

```bash
# Verify installation
stellar --version
```

---

### 1.3 `error[E0463]: can't find crate for 'std'` / `error: cannot find crate for 'std'`

**Symptom:** `cargo build` or `./scripts/build-contracts.sh` fails with a missing `std` crate error.

**Cause:** The `wasm32v1-none` compilation target is not installed.

**Fix:**
```bash
rustup target add wasm32v1-none
./scripts/build-contracts.sh
```

---

### 1.4 Missing or incomplete `.env` file

**Symptom:** Backend fails to start with errors like `Missing required environment variable: JWT_PRIVATE_KEY` or `validateEnv failed`.

**Cause:** `novaRewards/.env` was not created, or required variables were left as placeholders.

**Fix:**
```bash
cd novaRewards
cp .env.example .env
# Edit .env and fill in all required values — see Environment Setup in README
```

Key variables that must be set before the backend starts:

| Variable | How to generate |
|----------|----------------|
| `JWT_PRIVATE_KEY` / `JWT_PUBLIC_KEY` | `node novaRewards/backend/scripts/generate-jwt-keys.js` |
| `FIELD_ENCRYPTION_KEY` | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `ISSUER_PUBLIC` / `ISSUER_SECRET` | Stellar keypair from [Stellar Laboratory](https://laboratory.stellar.org/#account-creator) |

---

### 1.5 `npm ERR! code ENOENT` / `Cannot find module`

**Symptom:** `npm run test:backend` or `npm run test:frontend` fails immediately.

**Cause:** `node_modules` is missing — dependencies were not installed.

**Fix:**
```bash
cd novaRewards
npm install
# or for a specific workspace:
cd novaRewards/backend && npm install
cd novaRewards/frontend && npm install
```

---

## 2. Runtime / Environment Errors

### 2.1 `Error: secretOrPrivateKey must have a value` / `JsonWebTokenError: invalid signature`

**Symptom:** All authenticated API requests return `401 Unauthorized`. Backend logs show a JWT error.

**Cause:** `JWT_PRIVATE_KEY` or `JWT_PUBLIC_KEY` is missing, empty, or malformed in `.env`.

**Fix:**
```bash
# Regenerate RS256 key pair
node novaRewards/backend/scripts/generate-jwt-keys.js
# Copy the output into .env as JWT_PRIVATE_KEY and JWT_PUBLIC_KEY
# Restart the backend
docker compose restart backend
```

---

### 2.2 `Error: FIELD_ENCRYPTION_KEY must be a 64-character hex string`

**Symptom:** Backend crashes on startup with the message above.

**Cause:** `FIELD_ENCRYPTION_KEY` is missing or is not a valid 64-character hex string.

**Fix:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Paste the output as FIELD_ENCRYPTION_KEY in .env
```

---

### 2.3 `Redis connection refused` / `Error: connect ECONNREFUSED 127.0.0.1:6379`

**Symptom:** Backend logs show Redis connection errors; rate limiting and caching fail.

**Cause:** Redis is not running, or `REDIS_URL` points to the wrong host/port.

**Fix:**
```bash
# When running outside Docker, start Redis locally:
docker run -d -p 6379:6379 redis:7-alpine

# When running inside Docker Compose, ensure REDIS_URL uses the service name:
REDIS_URL=redis://redis:6379

# Verify Redis is reachable:
redis-cli -u "$REDIS_URL" ping   # should return PONG
```

---

### 2.4 `UnhandledPromiseRejectionWarning: Error: listen EADDRINUSE :::3001`

**Symptom:** Backend fails to start; port 3001 is already in use.

**Cause:** Another process (or a previous backend instance) is already bound to port 3001.

**Fix:**
```bash
# Find and kill the process using the port
lsof -ti:3001 | xargs kill -9
# Or change PORT in .env to an unused port
PORT=3002
```

---

### 2.5 `SyntaxError: Unexpected token` in request body / `Invalid JSON in request body`

**Symptom:** API returns `400 Bad Request` with `"error": "validation_error"` and `"message": "Invalid JSON in request body"`.

**Cause:** The request body is malformed JSON, or `Content-Type: application/json` is set but the body is empty.

**Fix:** Ensure the request body is valid JSON and the `Content-Type` header matches the body format. Use a tool like `curl -v` or Postman to inspect the raw request.

---

## 3. Stellar / Horizon Errors

### 3.1 `AxiosError: Request failed with status code 404` when loading an account

**Symptom:** Backend logs show a 404 from Horizon when trying to load an account. The `stellarService.js` `getNOVABalance` function returns `"0"` unexpectedly, or reward issuance fails.

**Cause:** The Stellar account (`ISSUER_PUBLIC` or `DISTRIBUTION_PUBLIC`) does not exist on the network, or has not been funded (activated).

**Fix:**
- **Testnet:** Fund the account using [Friendbot](https://friendbot.stellar.org/?addr=<YOUR_PUBLIC_KEY>) or the Stellar Laboratory.
- **Local dev:** The `stellar/quickstart` container must be running and the account must be created via the local RPC.
- **Mainnet:** The account must hold a minimum XLM balance (currently 1 XLM base reserve).

```bash
# Check if the account exists on testnet
curl "https://horizon-testnet.stellar.org/accounts/<YOUR_PUBLIC_KEY>"
```

---

### 3.2 `Error: Connection refused` / `ECONNREFUSED` when calling Horizon

**Symptom:** All Stellar operations fail. Backend logs show connection refused to `http://stellar:8000` or the configured `HORIZON_URL`.

**Cause:** The `stellar` Docker service is not running, or `HORIZON_URL` is misconfigured.

**Fix:**
```bash
# Check if the stellar container is running
docker compose ps stellar

# Start it if stopped
docker compose up -d stellar

# Verify the RPC endpoint is healthy
curl -s http://localhost:8000/rpc \
  -d '{"jsonrpc":"2.0","id":1,"method":"getHealth"}' \
  -H 'Content-Type: application/json'
# Expected: {"result":{"status":"healthy",...}}

# For testnet, ensure HORIZON_URL is set correctly in .env:
HORIZON_URL=https://horizon-testnet.stellar.org
```

---

### 3.3 `InvokeHostFunctionTrapped` / contract panic messages

**Symptom:** A Soroban contract call fails with `InvokeHostFunctionTrapped`. The `diagnosticEvents` field contains a panic string such as `"insufficient balance"` or `"contract is paused"`.

**Cause:** The contract enforced a business rule. See [docs/error-codes.md](error-codes.md) for the full list.

**Fix:** Inspect the `diagnosticEvents` field in the simulation or transaction result:

```typescript
try {
  await server.simulateTransaction(tx);
} catch (e) {
  // e.message contains the panic string
  console.error("Contract error:", e.message);
}
```

Common causes and fixes:

| Panic message | Fix |
|---------------|-----|
| `"contract is paused"` | Wait for admin to call `resume` / `unpause` |
| `"not initialized"` | Call `initialize` on the contract first |
| `"insufficient balance"` | Check `get_balance` before the operation |
| `"already initialized"` | Do not call `initialize` more than once |
| `"no pending wasm hash"` | Call `upgrade` before `migrate` |

---

### 3.4 `Error: Stellar account has no trustline for NOVA`

**Symptom:** Reward issuance or token transfer fails because the recipient wallet has no NOVA trustline.

**Cause:** The recipient Stellar account has not established a trustline for the NOVA asset.

**Fix:** The user must add a trustline via the Freighter wallet or programmatically:

```typescript
// Via the API
POST /api/trustline
{ "walletAddress": "<recipient_public_key>" }
```

---

## 4. Database Errors

### 4.1 `Error: connect ECONNREFUSED 127.0.0.1:5432`

**Symptom:** Migration runner or backend fails with a PostgreSQL connection refused error.

**Cause:** PostgreSQL is not running, or `DATABASE_URL` points to the wrong host/port.

**Fix:**
```bash
# When running outside Docker, start PostgreSQL:
docker compose up -d postgres

# Verify the connection string in .env:
DATABASE_URL=postgresql://nova:changeme@localhost:5432/nova_rewards

# Test connectivity:
psql "$DATABASE_URL" -c "SELECT 1"
```

---

### 4.2 `duplicate key value violates unique constraint "schema_migrations_pkey"`

**Symptom:** Migration runner exits with a duplicate key error on the `schema_migrations` table.

**Cause:** A migration file was renamed or re-run after already being recorded.

**Fix:** The migration runner is idempotent — it skips already-applied files. This error only occurs if the `schema_migrations` table was manually modified. Check the table:

```bash
psql "$DATABASE_URL" -c "SELECT * FROM schema_migrations ORDER BY applied_at;"
# Remove the duplicate row if it was inserted manually:
psql "$DATABASE_URL" -c "DELETE FROM schema_migrations WHERE filename = '<filename>';"
# Then re-run migrations:
node novaRewards/database/migrate.js
```

---

### 4.3 `relation "<table>" does not exist`

**Symptom:** Backend returns 500 errors; logs show `relation "users" does not exist` or similar.

**Cause:** Database migrations have not been run, or ran against the wrong database.

**Fix:**
```bash
# Check migration status
node novaRewards/database/migrate.js --status

# Run pending migrations
node novaRewards/database/migrate.js

# Via Docker Compose (migrations run automatically on `up`, but can be forced):
docker compose run --rm migrate
```

---

### 4.4 `password authentication failed for user "nova"`

**Symptom:** PostgreSQL rejects the connection with an authentication error.

**Cause:** `POSTGRES_PASSWORD` in `.env` does not match the password the PostgreSQL container was initialised with.

**Fix:** The PostgreSQL data volume stores the password set at first initialisation. Either update `.env` to match, or wipe the volume and reinitialise:

```bash
# ⚠️ This deletes all local data
docker compose down -v
docker compose up -d postgres
```

---

### 4.5 `SSL SYSCALL error: EOF detected` / `SSL connection required`

**Symptom:** Migration or backend fails with an SSL error when connecting to PostgreSQL.

**Cause:** The server requires SSL but the client is not configured for it (or vice versa).

**Fix:**
- **Local dev:** Set `NODE_ENV=development` — the migration runner disables SSL in non-production environments.
- **Production:** Ensure `DATABASE_URL` includes `?sslmode=require` and the server certificate is trusted.

---

## 5. Docker / Container Errors

### 5.1 `Error response from daemon: Ports are not available: listen tcp 0.0.0.0:5432: bind: address already in use`

**Symptom:** `docker compose up` fails because a port is already bound on the host.

**Cause:** A local PostgreSQL, Redis, or other service is already using the same port.

**Fix:**
```bash
# Find what is using the port (e.g. 5432)
lsof -i :5432

# Option A: Stop the conflicting local service
sudo systemctl stop postgresql

# Option B: Change the host port mapping in docker-compose.yml
ports:
  - "5433:5432"   # map to 5433 on the host instead
# Then update DATABASE_URL to use port 5433
```

---

### 5.2 `service "backend" failed to build` / `npm ERR! code ENOENT` during Docker build

**Symptom:** `docker compose up --build` fails during the backend image build.

**Cause:** `package.json` or `package-lock.json` is missing or corrupted.

**Fix:**
```bash
cd novaRewards/backend
npm install          # regenerates package-lock.json
docker compose build backend
```

---

### 5.3 `dependency failed to start: container for service "migrate" exited with code 1`

**Symptom:** The `backend` service never starts because the `migrate` service exited with an error.

**Cause:** The migration runner failed — usually because PostgreSQL was not yet ready, or `DATABASE_URL` is wrong.

**Fix:**
```bash
# Inspect migration logs
docker compose logs migrate

# Common fix: ensure postgres is healthy before retrying
docker compose up -d postgres
docker compose run --rm migrate
docker compose up backend
```

---

### 5.4 `unhealthy` status on `stellar` service / Stellar RPC not responding

**Symptom:** `docker compose ps` shows the `stellar` container as `unhealthy`. Backend Stellar calls fail.

**Cause:** The `stellar/quickstart` container takes 30–60 seconds to initialise. The healthcheck may time out if the machine is slow.

**Fix:**
```bash
# Wait for the container to become healthy (up to 2 minutes)
docker compose logs -f stellar

# If it stays unhealthy, restart it
docker compose restart stellar

# Manually verify the RPC endpoint
curl -s http://localhost:8000/rpc \
  -d '{"jsonrpc":"2.0","id":1,"method":"getHealth"}' \
  -H 'Content-Type: application/json'
```

---

### 5.5 `Error: ENOSPC: no space left on device`

**Symptom:** Docker build or container startup fails with a "no space left on device" error.

**Cause:** Docker's disk usage has grown too large (unused images, volumes, build cache).

**Fix:**
```bash
# Remove unused Docker resources
docker system prune -f

# Also remove unused volumes (⚠️ removes local database data)
docker system prune --volumes -f

# Check remaining disk space
df -h
```

---

## 6. Collecting Diagnostics for Bug Reports

When opening a GitHub issue, include the following information to help maintainers reproduce and fix the problem quickly.

### 6.1 Environment snapshot

```bash
# OS and Docker versions
uname -a
docker --version
docker compose version
node --version
npm --version

# Rust / Stellar CLI (for contract issues)
rustc --version
cargo --version
stellar --version
rustup target list --installed | grep wasm
```

### 6.2 Container status and logs

```bash
# Show all container states
docker compose ps

# Tail logs for a specific service (replace <service> with backend, postgres, stellar, etc.)
docker compose logs --tail=100 <service>

# Save all logs to a file
docker compose logs > nova-rewards-logs.txt 2>&1
```

### 6.3 Migration status

```bash
node novaRewards/database/migrate.js --status
```

### 6.4 Network connectivity checks

```bash
# PostgreSQL
psql "$DATABASE_URL" -c "SELECT version();"

# Redis
redis-cli -u "$REDIS_URL" ping

# Horizon / Stellar RPC
curl -s "${HORIZON_URL}/rpc" \
  -d '{"jsonrpc":"2.0","id":1,"method":"getHealth"}' \
  -H 'Content-Type: application/json'
```

### 6.5 What to include in the issue

- The **exact error message** (copy from terminal or logs — do not paraphrase).
- The **steps to reproduce** (commands run, in order).
- The output of the environment snapshot above.
- Relevant container logs (redact any secrets before posting).
- Your `.env` file with all secret values replaced by `<redacted>`.

> **Never post real private keys, JWT secrets, or database passwords in a GitHub issue.**

---

*For contract-specific error codes, see [docs/error-codes.md](error-codes.md).*  
*For operational runbooks, see [docs/ops/runbook.md](ops/runbook.md).*
