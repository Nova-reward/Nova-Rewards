# Nova Rewards — Deployment Guide

This guide covers end-to-end deployment of all Nova Rewards components — Soroban smart contracts, Node.js backend, and Next.js frontend — for both testnet and mainnet environments.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Environment Setup](#2-environment-setup)
3. [Smart Contract Deployment](#3-smart-contract-deployment)
   - [Testnet](#31-testnet)
   - [Mainnet](#32-mainnet)
4. [Backend Deployment](#4-backend-deployment)
   - [Testnet / Staging](#41-testnet--staging)
   - [Mainnet / Production](#42-mainnet--production)
5. [Frontend Deployment](#5-frontend-deployment)
   - [Testnet / Preview](#51-testnet--preview)
   - [Mainnet / Production](#52-mainnet--production)
6. [Post-Deployment Verification](#6-post-deployment-verification)
7. [Rollback Procedures](#7-rollback-procedures)
8. [Troubleshooting](#8-troubleshooting)

---

## 1. Prerequisites

### Required Tools

| Tool | Minimum Version | Install |
|------|----------------|---------|
| Node.js | 20.x | https://nodejs.org |
| Rust (stable) | see `rust-toolchain.toml` | `rustup toolchain install stable` |
| Stellar CLI | latest | `cargo install --locked stellar-cli --features opt` |
| Docker | 24.x | https://docs.docker.com/get-docker |
| Docker Compose | 2.x | Bundled with Docker Desktop |
| `wasm-opt` (binaryen) | any | `brew install binaryen` / `apt install binaryen` |
| Git | 2.x | https://git-scm.com |

Verify the Rust WASM target is installed:

```bash
rustup target add wasm32v1-none
```

### Required Accounts & Access

- Stellar keypairs: issuer account and distribution account (funded)
- Deployer keypair for contract deployment (funded with XLM)
- Vercel account with project access
- PostgreSQL instance (managed or self-hosted)
- Redis instance (managed or self-hosted)
- SMTP credentials or SendGrid API key

### Clone the Repository

```bash
git clone https://github.com/barry01-hash/Nova-Rewards.git
cd Nova-Rewards
```

---

## 2. Environment Setup

### 2.1 Backend Environment File

Copy the example and fill in values for your target environment:

```bash
cp novaRewards/.env.example novaRewards/.env
```

Key variables to configure:

| Variable | Testnet Value | Mainnet Value | Notes |
|----------|--------------|---------------|-------|
| `NODE_ENV` | `development` | `production` | |
| `PORT` | `3001` | `3001` | |
| `DATABASE_URL` | `postgresql://nova:changeme@localhost:5432/nova_rewards` | Managed DB connection string | Never commit |
| `REDIS_URL` | `redis://localhost:6379` | ElastiCache / managed Redis URL | |
| `JWT_SECRET` | Any random string | Long random secret (≥ 64 chars) | Never commit |
| `JWT_EXPIRES_IN` | `15m` | `15m` | |
| `JWT_REFRESH_EXPIRES_IN` | `7d` | `7d` | |
| `STELLAR_NETWORK` | `testnet` | `mainnet` | |
| `HORIZON_URL` | `https://horizon-testnet.stellar.org` | `https://horizon.stellar.org` | |
| `ISSUER_PUBLIC` | Testnet `G...` key | Mainnet `G...` key | |
| `ISSUER_SECRET` | Testnet `S...` key | Mainnet `S...` key | Never commit |
| `DISTRIBUTION_PUBLIC` | Testnet `G...` key | Mainnet `G...` key | |
| `DISTRIBUTION_SECRET` | Testnet `S...` key | Mainnet `S...` key | Never commit |
| `ALLOWED_ORIGIN` | `http://localhost:3000` | `https://nova-rewards.xyz` | |
| `NOVA_TOKEN_CONTRACT_ID` | Output from contract deploy | Output from contract deploy | |
| `REWARD_POOL_CONTRACT_ID` | Output from contract deploy | Output from contract deploy | |

See `novaRewards/.env.example` for the full variable reference including email, rate limiting, and backup settings.

### 2.2 Frontend Environment Variables

Frontend build-time variables are set in Vercel's project settings (not in a committed file). For local development, create `novaRewards/frontend/.env.local`:

```bash
# novaRewards/frontend/.env.local — not committed to git
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_HORIZON_URL=https://horizon-testnet.stellar.org
NEXT_PUBLIC_ISSUER_PUBLIC=G...          # testnet issuer public key
NEXT_PUBLIC_STELLAR_NETWORK=testnet
NEXT_PUBLIC_MULTISIG_CONTRACT_ID=C...   # testnet contract ID
```

For Vercel deployments, set these under **Project → Settings → Environment Variables**, scoped to the correct environment (Preview or Production). See `.env.vercel.example` for the full reference.

### 2.3 Contract Deployment Environment

Export these shell variables before running `scripts/deploy-contracts.sh`:

```bash
export DEPLOYER_SECRET=S...       # Stellar secret key for the deployer account
export ADMIN_ADDRESS=G...         # Stellar public key for contract admin
export NETWORK=testnet            # or mainnet
# Optional overrides:
export ADMIN_SIGNERS="$ADMIN_ADDRESS"
export ADMIN_THRESHOLD=1
```

---

## 3. Smart Contract Deployment

The script `scripts/deploy-contracts.sh` builds, optimizes, uploads, deploys, and initializes all five workspace contracts in order:

| Order | Contract | Env Key Written |
|-------|----------|----------------|
| 1 | `nova_token` | `NOVA_TOKEN_CONTRACT_ID` |
| 2 | `reward_pool` | `REWARD_POOL_CONTRACT_ID` |
| 3 | `vesting` | `CLAIM_DISTRIBUTION_CONTRACT_ID` |
| 4 | `referral` | `STAKING_CONTRACT_ID` |
| 5 | `admin_roles` | `ADMIN_ROLES_CONTRACT_ID` |

Contract IDs are written to `.env.testnet` or `.env.mainnet` automatically.

### 3.1 Testnet

**Step 1 — Fund the deployer account via Friendbot:**

```bash
curl "https://friendbot.stellar.org?addr=$ADMIN_ADDRESS"
```

**Step 2 — (Optional) Start a local standalone network for development:**

```bash
# POSIX
./scripts/start-local-testnet.sh

# PowerShell
./scripts/start-local-testnet.ps1
```

The local network runs at `http://localhost:8000/rpc` with passphrase `Standalone Network ; February 2017`.

**Step 3 — Build and test contracts before deploying:**

```bash
# POSIX
./scripts/build-contracts.sh
./scripts/test-contracts.sh

# PowerShell
./scripts/build-contracts.ps1
./scripts/test-contracts.ps1
```

**Step 4 — Preview the deployment (dry run):**

```bash
export DEPLOYER_SECRET=S...
export ADMIN_ADDRESS=G...
export NETWORK=testnet

bash scripts/deploy-contracts.sh --dry-run
```

Review the printed commands. No transactions are broadcast in dry-run mode.

**Step 5 — Deploy to testnet:**

```bash
bash scripts/deploy-contracts.sh
```

**Step 6 — Verify contract IDs were written:**

```bash
cat .env.testnet
# Expected output:
# NOVA_TOKEN_CONTRACT_ID=C...
# REWARD_POOL_CONTRACT_ID=C...
# CLAIM_DISTRIBUTION_CONTRACT_ID=C...
# STAKING_CONTRACT_ID=C...
# ADMIN_ROLES_CONTRACT_ID=C...
```

**Step 7 — Verify initialization on-chain:**

```bash
# Replace C... with the actual contract IDs from .env.testnet
stellar contract invoke \
  --id $NOVA_TOKEN_CONTRACT_ID \
  --network-passphrase "Test SDF Network ; September 2015" \
  --rpc-url https://soroban-testnet.stellar.org \
  --source $DEPLOYER_SECRET \
  -- get_admin

stellar contract invoke \
  --id $REWARD_POOL_CONTRACT_ID \
  --network-passphrase "Test SDF Network ; September 2015" \
  --rpc-url https://soroban-testnet.stellar.org \
  --source $DEPLOYER_SECRET \
  -- get_balance
```

### 3.2 Mainnet

> ⚠️ Contract deployments are irreversible on-chain. Always complete testnet deployment and verification before proceeding to mainnet.

**Pre-deployment checklist:**

- [ ] All contracts pass tests on testnet
- [ ] Security audit completed and findings resolved (see `docs/audits/`)
- [ ] Deployer account funded with sufficient XLM for all five deployments
- [ ] `ADMIN_SIGNERS` and `ADMIN_THRESHOLD` reviewed for multi-sig requirements
- [ ] WASM hashes recorded for future upgrade reference

**Step 1 — Tag the current state:**

```bash
git tag -a "contract-v$(date +%Y%m%d)" -m "Pre-mainnet contract deploy"
git push origin --tags
```

**Step 2 — Deploy to mainnet:**

```bash
export DEPLOYER_SECRET=S...       # mainnet deployer secret
export ADMIN_ADDRESS=G...         # mainnet admin address
export NETWORK=mainnet
export ADMIN_SIGNERS="G... G..."  # space-separated if multi-sig
export ADMIN_THRESHOLD=2          # adjust for your multi-sig policy

bash scripts/deploy-contracts.sh
```

**Step 3 — Verify contract IDs:**

```bash
cat .env.mainnet
```

**Step 4 — Verify initialization on mainnet:**

```bash
stellar contract invoke \
  --id $NOVA_TOKEN_CONTRACT_ID \
  --network-passphrase "Public Global Stellar Network ; September 2015" \
  --rpc-url https://soroban-rpc.stellar.org \
  --source $DEPLOYER_SECRET \
  -- get_admin
```

**Step 5 — Copy contract IDs to backend environment:**

Update `NOVA_TOKEN_CONTRACT_ID` and `REWARD_POOL_CONTRACT_ID` in the production backend `.env` (or secrets manager) with the values from `.env.mainnet`.

---

## 4. Backend Deployment

The backend is a Node.js/Express application. It requires PostgreSQL and Redis to be running and reachable before starting.

### 4.1 Testnet / Staging

**Step 1 — Configure environment:**

```bash
cp novaRewards/.env.example novaRewards/.env
# Edit .env with testnet/staging values
```

**Step 2 — Start all services with Docker Compose:**

```bash
cd novaRewards
docker compose up -d --build
```

This starts PostgreSQL, Redis, runs database migrations automatically via the `migrate` service, then starts the backend and frontend.

**Step 3 — Verify migrations ran:**

```bash
docker compose logs migrate
# Should end with: "All migrations applied successfully"
```

**Step 4 — Check backend health:**

```bash
curl http://localhost:3001/health
# Expected: HTTP 200 with JSON status
```

**Step 5 — Run smoke tests:**

```bash
GATEWAY_URL=http://localhost:8080 bash scripts/gateway-smoke-test.sh
```

### 4.2 Mainnet / Production

Production deployments are triggered automatically by the CI/CD pipeline when commits land on `main`. For manual deployments or hotfixes:

**Pre-deployment checklist:**

- [ ] All CI checks pass on the branch
- [ ] Database migrations are backward-compatible (additive only)
- [ ] New contract IDs are set in the production secrets/environment
- [ ] Database backup taken (see step 2)

**Step 1 — SSH into the production server:**

```bash
ssh deploy@nova-rewards.xyz
cd /opt/nova-rewards
```

**Step 2 — Take a database backup before deploying:**

```bash
docker compose exec postgres pg_dump -U nova nova_rewards \
  > /opt/backups/pre-deploy-$(date +%Y%m%d-%H%M).sql
```

**Step 3 — Tag the current release:**

```bash
git tag -a "release-$(date +%Y%m%d-%H%M)" -m "Pre-deploy snapshot"
git push origin --tags
```

**Step 4 — Pull latest main:**

```bash
git pull origin main
```

**Step 5 — Rebuild and restart the backend container only:**

```bash
cd novaRewards
docker compose up -d --build --no-deps backend
```

**Step 6 — Run any new migrations:**

```bash
docker compose exec backend npm run migrate
```

**Step 7 — Verify health:**

```bash
curl -f https://api.nova-rewards.xyz/health
bash scripts/gateway-smoke-test.sh
```

**Step 8 — Monitor logs for errors (first 5 minutes):**

```bash
docker compose logs -f backend --since 5m
```

---

## 5. Frontend Deployment

The frontend is a Next.js application deployed to Vercel. Deployments are driven by Git events.

### 5.1 Testnet / Preview

Preview deployments are created automatically for every pull request targeting `main`. The workflow `.github/workflows/vercel-preview.yml` handles this.

**Required GitHub Secrets** (set under **Settings → Secrets and variables → Actions**):

| Secret | Where to find it |
|--------|-----------------|
| `VERCEL_TOKEN` | Vercel → Account Settings → Tokens |
| `VERCEL_ORG_ID` | Vercel → Project Settings → General |
| `VERCEL_PROJECT_ID` | Vercel → Project Settings → General |

**Required Vercel Environment Variables** (scoped to Preview):

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_API_URL` | `https://api-preview.nova-rewards.xyz` |
| `NEXT_PUBLIC_HORIZON_URL` | `https://horizon-testnet.stellar.org` |
| `NEXT_PUBLIC_ISSUER_PUBLIC` | Testnet issuer public key |
| `NEXT_PUBLIC_STELLAR_NETWORK` | `testnet` |
| `NEXT_PUBLIC_MULTISIG_CONTRACT_ID` | Testnet contract ID |

Once a PR is opened, the preview URL is posted as a comment on the PR. Verify the deployment in the Vercel dashboard under **Project → Deployments**.

**Manual preview build (local verification):**

```bash
cd novaRewards/frontend
cp .env.local.example .env.local   # or create manually
npm install
npm run build
npm run start
# Visit http://localhost:3000
```

### 5.2 Mainnet / Production

Production deployment is triggered automatically when a PR is merged to `main` via `.github/workflows/vercel-production.yml`.

**Required Vercel Environment Variables** (scoped to Production):

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_API_URL` | `https://api.nova-rewards.xyz` |
| `NEXT_PUBLIC_HORIZON_URL` | `https://horizon.stellar.org` |
| `NEXT_PUBLIC_ISSUER_PUBLIC` | Mainnet issuer public key |
| `NEXT_PUBLIC_STELLAR_NETWORK` | `public` |
| `NEXT_PUBLIC_MULTISIG_CONTRACT_ID` | Mainnet contract ID |

**Pre-merge checklist:**

- [ ] Preview deployment verified by a team member not involved in the change
- [ ] Backend production deployment completed (frontend depends on the API being live)
- [ ] All CI checks pass

Monitor the production deployment in the Vercel dashboard. The deployment is live when status shows **Ready**.

---

## 6. Post-Deployment Verification

Run these checks after every deployment, in order.

### 6.1 Backend Health

```bash
# Replace with your environment's URL
curl -f https://api.nova-rewards.xyz/health
```

Expected response:

```json
{ "status": "ok", "db": "connected", "redis": "connected" }
```

### 6.2 Gateway Smoke Test

```bash
# Testnet / staging
GATEWAY_URL=http://localhost:8080 bash scripts/gateway-smoke-test.sh

# Production
GATEWAY_URL=https://api.nova-rewards.xyz bash scripts/gateway-smoke-test.sh
```

The script checks `/auth/`, `/users/`, `/rewards/`, and `/leaderboard/` and exits non-zero on any gateway error (502/503/504).

### 6.3 Stellar Connectivity

```bash
node novaRewards/scripts/check-balances.js
```

Verifies the issuer and distribution accounts are reachable and funded.

### 6.4 Contract Verification

```bash
# Verify nova_token admin is set correctly
stellar contract invoke \
  --id $NOVA_TOKEN_CONTRACT_ID \
  --network-passphrase "Public Global Stellar Network ; September 2015" \
  --rpc-url https://soroban-rpc.stellar.org \
  --source $DEPLOYER_SECRET \
  -- get_admin

# Verify reward_pool balance
stellar contract invoke \
  --id $REWARD_POOL_CONTRACT_ID \
  --network-passphrase "Public Global Stellar Network ; September 2015" \
  --rpc-url https://soroban-rpc.stellar.org \
  --source $DEPLOYER_SECRET \
  -- get_balance
```

### 6.5 Frontend Verification

1. Open the production URL in a browser.
2. Confirm the network badge shows the correct network (testnet/mainnet).
3. Log in with a test account and verify the dashboard loads.
4. Connect a Freighter wallet and confirm the wallet address is displayed.

### 6.6 Deployment Considered Successful When

- `/health` returns HTTP 200 with `db: connected` and `redis: connected`
- Smoke test exits with code 0
- Vercel deployment status is **Ready**
- No error-level log entries in `docker compose logs backend` in the 5 minutes after deploy

---

## 7. Rollback Procedures

### 7.1 Frontend Rollback (Vercel)

Vercel retains all previous deployments indefinitely.

1. Open **Vercel → Project → Deployments**.
2. Find the last known-good deployment.
3. Click **⋯ → Promote to Production**.

The previous build is instantly re-promoted with no rebuild. This takes effect in under 30 seconds.

### 7.2 Backend Rollback

```bash
ssh deploy@nova-rewards.xyz
cd /opt/nova-rewards

# List recent release tags
git tag --sort=-creatordate | head -10

# Check out the previous release
git checkout tags/release-<YYYYMMDD-HHMM>

# Rebuild and restart
cd novaRewards
docker compose up -d --build --no-deps backend

# Verify
curl -f https://api.nova-rewards.xyz/health
```

### 7.3 Database Rollback

> ⚠️ Database rollbacks risk data loss. Only proceed if the migration introduced a defect and no user data was written after the migration ran.

**Option A — Roll back the most recent migration:**

```bash
docker compose exec backend npm run migrate:rollback
```

**Option B — Restore from pre-deploy backup:**

```bash
# Stop the backend to prevent writes during restore
docker compose stop backend

# Restore from the backup taken in step 2 of production deployment
docker compose exec -T postgres psql -U nova nova_rewards \
  < /opt/backups/pre-deploy-<YYYYMMDD-HHMM>.sql

# Restart
docker compose start backend
curl -f https://api.nova-rewards.xyz/health
```

### 7.4 Contract Rollback

Soroban contracts cannot be rolled back once deployed. Mitigation options:

- **Upgrade the contract** to a fixed version using `stellar contract upload` + `stellar contract invoke -- upgrade`.
- **Pause the contract** if an admin pause function is available in `admin_roles`.
- **Disable the affected feature** in the backend by setting the relevant feature flag via the admin API.

For upgrade procedures, see `docs/upgrade-guide.md`.

### 7.5 Version Tagging Reference

| Tag Format | When to Create |
|-----------|---------------|
| `release-YYYYMMDD-HHMM` | Before every production backend deploy |
| `contract-vYYYYMMDD` | Before every Soroban contract deploy |
| `hotfix-<issue-number>` | After an emergency fix is applied |

---

## 8. Troubleshooting

### Contract deployment fails with "Missing required command"

The script requires both `cargo` and `stellar` to be on `PATH`.

```bash
which cargo   # should print a path
which stellar # should print a path
cargo install --locked stellar-cli --features opt
```

### `DEPLOYER_SECRET is required` error

The deploy script enforces required variables with `set -u`. Export them before running:

```bash
export DEPLOYER_SECRET=S...
export ADMIN_ADDRESS=G...
```

### Contract upload fails with "insufficient balance"

The deployer account needs XLM to pay transaction fees. On testnet, use Friendbot:

```bash
curl "https://friendbot.stellar.org?addr=$ADMIN_ADDRESS"
```

On mainnet, fund the deployer account from your treasury before deploying.

### `docker compose up` fails — port already in use

Another process is using port 5432, 6379, 3001, or 3000.

```bash
# Find and stop the conflicting process
lsof -i :5432
kill -9 <PID>
```

Or change the host port mapping in `novaRewards/docker-compose.yml`.

### Backend starts but `/health` returns `db: disconnected`

1. Confirm PostgreSQL is running: `docker compose ps postgres`
2. Check the `DATABASE_URL` in `.env` matches the running container.
3. Check migration logs: `docker compose logs migrate`
4. Inspect backend logs: `docker compose logs backend`

### Backend starts but `/health` returns `redis: disconnected`

1. Confirm Redis is running: `docker compose ps redis`
2. Check `REDIS_URL` in `.env`.
3. Test connectivity: `docker compose exec redis redis-cli ping` (should return `PONG`).

### Frontend build fails with `NEXT_PUBLIC_API_URL` not set

Build-time variables must be present at `next build` time. For local builds, ensure `novaRewards/frontend/.env.local` exists. For Vercel, confirm the variable is set in **Project → Settings → Environment Variables** for the correct scope (Preview or Production).

### Vercel deployment stuck in "Building"

1. Check the build logs in the Vercel dashboard for the specific error.
2. Common causes: missing environment variable, TypeScript error, or out-of-memory during build.
3. If the build OOMs, increase the Vercel build memory limit in `vercel.json` or optimize the build.

### Smoke test fails with HTTP 502

The gateway (nginx) cannot reach the backend upstream.

```bash
# Check backend is running
docker compose ps backend

# Check nginx config
docker compose logs gateway

# Restart gateway after backend is healthy
docker compose restart gateway
```

### Migrations fail with "relation already exists"

The migration runner tracks applied migrations. If the state is out of sync:

```bash
# Check which migrations have been applied
docker compose exec backend node -e "
  const { Pool } = require('pg');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  pool.query('SELECT filename FROM migrations ORDER BY applied_at').then(r => {
    r.rows.forEach(row => console.log(row.filename));
    pool.end();
  });
"
```

If a migration was partially applied, restore from backup (see [section 7.3](#73-database-rollback)) and re-run.

---

*For contract upgrade procedures, see [`docs/upgrade-guide.md`](./upgrade-guide.md).*  
*For infrastructure provisioning (Terraform, Kubernetes), see [`docs/infra/terraform.md`](./infra/terraform.md).*  
*For monitoring and alerting setup, see [`monitoring/README.md`](../monitoring/README.md).*
