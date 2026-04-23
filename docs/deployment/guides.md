# Deployment Guide

This document covers the full deployment lifecycle for Nova Rewards — from local prerequisites through production release and rollback.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Prerequisites](#prerequisites)
- [Environment Variable Reference](#environment-variable-reference)
- [Staging Deployment](#staging-deployment)
- [Production Deployment](#production-deployment)
- [Rollback Procedure](#rollback-procedure)
- [CI/CD Pipeline Overview](#cicd-pipeline-overview)
- [Health Checks & Smoke Tests](#health-checks--smoke-tests)

---

## Architecture Overview

| Layer | Technology | Hosting |
|-------|-----------|---------|
| Frontend | Next.js 14 | Vercel |
| Backend API | Node.js / Express | Self-hosted (Docker) |
| Database | PostgreSQL | Self-hosted / managed |
| Cache | Redis | Self-hosted / managed |
| Blockchain | Stellar / Soroban | Stellar Network |

The frontend is deployed via Vercel's Git integration. The backend and database run in Docker containers managed by `docker-compose`.

---

## Prerequisites

### Tooling

| Tool | Minimum Version | Purpose |
|------|----------------|---------|
| Node.js | 20.x | Frontend & backend builds |
| Docker | 24.x | Container runtime |
| Docker Compose | 2.x | Multi-container orchestration |
| Stellar CLI | latest | Contract deployment |
| Git | 2.x | Source control |

### Access & Credentials

- Vercel account with project access (`VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`)
- Stellar issuer and distribution keypairs
- PostgreSQL connection string
- Redis connection string
- SMTP credentials or SendGrid API key

---

## Environment Variable Reference

All variables are defined in `novaRewards/.env.example`. Copy it to `novaRewards/.env` for local development — **never commit `.env` to source control**.

### Build-time Variables

These are injected at `next build` time and baked into the static bundle. They are prefixed `NEXT_PUBLIC_` and are safe to expose to the browser. They must be set in Vercel's project settings under the correct environment scope.

| Variable | Staging Value | Production Value | Description |
|----------|--------------|-----------------|-------------|
| `NEXT_PUBLIC_API_URL` | `https://api-preview.nova-rewards.xyz` | `https://api.nova-rewards.xyz` | Backend API base URL |
| `NEXT_PUBLIC_HORIZON_URL` | `https://horizon-testnet.stellar.org` | `https://horizon.stellar.org` | Stellar Horizon endpoint |
| `NEXT_PUBLIC_ISSUER_PUBLIC` | Testnet key (`G...`) | Mainnet key (`G...`) | NOVA asset issuer public key |
| `NEXT_PUBLIC_STELLAR_NETWORK` | `testnet` | `public` | Stellar network identifier |
| `NEXT_PUBLIC_MULTISIG_CONTRACT_ID` | Testnet contract (`C...`) | Mainnet contract (`C...`) | Soroban multisig contract ID |

### Runtime Variables

These are loaded by the backend at process start via `dotenv`. They are never exposed to the browser and must be kept secret.

| Variable | Required | Description |
|----------|----------|-------------|
| `NODE_ENV` | ✅ | `development` / `production` |
| `PORT` | ✅ | Backend HTTP port (default: `3001`) |
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `REDIS_URL` | ✅ | Redis connection string |
| `JWT_SECRET` | ✅ | Long random string for JWT signing |
| `JWT_EXPIRES_IN` | ✅ | Access token TTL (e.g. `15m`) |
| `JWT_REFRESH_EXPIRES_IN` | ✅ | Refresh token TTL (e.g. `7d`) |
| `ISSUER_PUBLIC` | ✅ | Stellar issuer account public key |
| `ISSUER_SECRET` | ✅ | Stellar issuer account secret key |
| `DISTRIBUTION_PUBLIC` | ✅ | Stellar distribution account public key |
| `DISTRIBUTION_SECRET` | ✅ | Stellar distribution account secret key |
| `STELLAR_NETWORK` | ✅ | `testnet` or `mainnet` |
| `HORIZON_URL` | ✅ | Stellar Horizon API URL |
| `ALLOWED_ORIGIN` | ✅ | CORS allowed origin (frontend URL) |
| `NOVA_TOKEN_CONTRACT_ID` | ✅ | Soroban nova token contract ID |
| `REWARD_POOL_CONTRACT_ID` | ✅ | Soroban reward pool contract ID |
| `SMTP_HOST` | ⚠️ | SMTP server hostname |
| `SMTP_PORT` | ⚠️ | SMTP server port |
| `SMTP_USER` | ⚠️ | SMTP username |
| `SMTP_PASSWORD` | ⚠️ | SMTP password |
| `EMAIL_FROM` | ⚠️ | Sender address for transactional email |
| `SENDGRID_API_KEY` | ⚠️ | SendGrid API key (alternative to SMTP) |
| `DAILY_BONUS_POINTS` | ⚠️ | Points awarded for daily login (default: `10`) |
| `REFERRAL_BONUS_POINTS` | ⚠️ | Points awarded per referral (default: `100`) |
| `RATE_LIMIT_WHITELIST` | ⚠️ | Comma-separated IPs exempt from rate limiting |
| `POSTGRES_USER` | ⚠️ | PostgreSQL user (used by docker-compose) |
| `POSTGRES_PASSWORD` | ⚠️ | PostgreSQL password (used by docker-compose) |
| `POSTGRES_DB` | ⚠️ | PostgreSQL database name (used by docker-compose) |

✅ = Required in all environments  
⚠️ = Required in production; optional or has a default in development

---

## Staging Deployment

Staging maps to Vercel **Preview** deployments, triggered automatically on every pull request targeting `main`.

### Frontend (Vercel Preview — Automatic)

No manual steps required. Opening a PR against `main` triggers `.github/workflows/vercel-preview.yml`, which:

1. Builds the Next.js app with staging build-time variables.
2. Deploys to a unique Vercel preview URL.
3. Posts the preview URL as a comment on the PR.

To verify the preview build-time config, check the Vercel dashboard under **Project → Deployments → [preview deployment] → Environment Variables**.

### Backend (Manual / Docker)

```bash
# 1. SSH into the staging server
ssh deploy@staging.nova-rewards.xyz

# 2. Pull the latest branch
cd /opt/nova-rewards
git fetch origin
git checkout <your-branch>
git pull

# 3. Copy and configure environment
cp novaRewards/.env.example novaRewards/.env
# Edit .env with staging values (testnet keys, staging DB, etc.)

# 4. Start services
cd novaRewards
docker compose up -d --build

# 5. Run database migrations
docker compose exec backend npm run migrate
```

### Verify Staging

```bash
# Health check
curl https://api-preview.nova-rewards.xyz/health

# Run smoke tests
bash scripts/gateway-smoke-test.sh
```

---

## Production Deployment

Production deployments are triggered automatically when a commit lands on `main` (via merge of an approved PR).

### Pre-deployment Checklist

Before merging to `main`, confirm:

- [ ] All CI checks pass (tests, lint, frontend build)
- [ ] PR has at least one approving review
- [ ] Staging preview has been manually verified
- [ ] Database migrations are backward-compatible
- [ ] `CHANGELOG` or release notes updated
- [ ] Soroban contracts audited if `contracts/` was modified (see [audit docs](../audits/README.md))

### Frontend (Vercel Production — Automatic)

Merging to `main` triggers `.github/workflows/vercel-production.yml`, which deploys to the production Vercel domain with production build-time variables. No manual steps required.

Monitor the deployment in the Vercel dashboard under **Project → Deployments**.

### Backend (Manual / Docker)

```bash
# 1. SSH into the production server
ssh deploy@nova-rewards.xyz

# 2. Tag the current release before deploying (enables rollback)
cd /opt/nova-rewards
git tag -a "release-$(date +%Y%m%d-%H%M)" -m "Pre-deploy snapshot"
git push origin --tags

# 3. Pull main
git pull origin main

# 4. Rebuild and restart containers
cd novaRewards
docker compose pull
docker compose up -d --build --no-deps backend

# 5. Run any new migrations
docker compose exec backend npm run migrate

# 6. Verify health
curl https://api.nova-rewards.xyz/health
bash scripts/gateway-smoke-test.sh
```

### Soroban Contract Deployment

Contract deployments are separate from the application deployment and require explicit action. See `scripts/deploy-contracts.sh` for the full procedure.

```bash
# Deploy to mainnet (requires Stellar CLI and funded deployer account)
bash scripts/deploy-contracts.sh --network mainnet
```

> ⚠️ Contract deployments are irreversible on-chain. Always deploy to testnet first and verify behavior before mainnet.

---

## Rollback Procedure

### Frontend Rollback (Vercel)

Vercel retains all previous deployments. To roll back:

1. Open the Vercel dashboard → **Project → Deployments**.
2. Locate the last known-good deployment.
3. Click **⋯ → Promote to Production**.

The previous build is instantly re-promoted with no rebuild required.

### Backend Rollback

```bash
# 1. SSH into the production server
ssh deploy@nova-rewards.xyz
cd /opt/nova-rewards

# 2. List available release tags
git tag --sort=-creatordate | head -10

# 3. Check out the previous release tag
git checkout tags/release-<YYYYMMDD-HHMM>

# 4. Rebuild and restart
cd novaRewards
docker compose up -d --build --no-deps backend
```

### Database Rollback

> ⚠️ Database rollbacks carry risk of data loss. Assess carefully before proceeding.

```bash
# Roll back the most recent migration
docker compose exec backend npm run migrate:rollback
```

**Migration strategy:**

- All migrations in `novaRewards/database/` are numbered sequentially and append-only.
- Write migrations to be backward-compatible where possible (additive changes, no destructive `DROP` or `ALTER` without a fallback).
- Take a database snapshot before every production deployment:

```bash
docker compose exec postgres pg_dump -U nova nova_rewards > backup-$(date +%Y%m%d-%H%M).sql
```

### Version Tagging Strategy

| Tag Format | When to Create | Example |
|-----------|---------------|---------|
| `release-YYYYMMDD-HHMM` | Before every production backend deploy | `release-20260330-0600` |
| `contract-v<semver>` | Before every Soroban contract deploy | `contract-v1.2.0` |
| `hotfix-<issue>` | After an emergency fix is applied | `hotfix-431` |

---

## CI/CD Pipeline Overview

```
Pull Request opened / updated
        │
        ├─► [ci.yml] Backend Tests (Jest)
        ├─► [ci.yml] Frontend Build Check (next build)
        ├─► [audit-check.yml] Contract Audit Compliance (if contracts/ changed)
        └─► [vercel-preview.yml] Vercel Preview Deployment
                    │
                    └─► Preview URL posted as PR comment

PR merged to main
        │
        └─► [vercel-production.yml] Vercel Production Deployment
```

### Workflow Summary

| Workflow file | Trigger | Purpose |
|--------------|---------|---------|
| `ci.yml` | Push / PR → `main` | Backend Jest tests + frontend `next build` |
| `vercel-preview.yml` | PR → `main` | Deploy preview to Vercel; comment URL on PR |
| `vercel-production.yml` | Push → `main` | Deploy production to Vercel |
| `audit-check.yml` | PR touching `contracts/**` | Validate audit directory structure and entries |
| `branch-protection.yml` | PR → `main` | Enforce branch protection rules |

### Required GitHub Secrets

Set these under **GitHub → Settings → Secrets and variables → Actions**:

| Secret | Description |
|--------|-------------|
| `VERCEL_TOKEN` | Vercel personal access token |
| `VERCEL_ORG_ID` | Vercel organization ID |
| `VERCEL_PROJECT_ID` | Vercel project ID |

---

## Health Checks & Smoke Tests

```bash
# Backend health endpoint
curl -f https://api.nova-rewards.xyz/health

# Full gateway smoke test (checks key API routes)
bash scripts/gateway-smoke-test.sh

# Verify Stellar connectivity
node novaRewards/scripts/check-balances.js
```

A deployment is considered successful when:
- The `/health` endpoint returns HTTP 200.
- The smoke test script exits with code 0.
- The Vercel deployment status shows **Ready**.
