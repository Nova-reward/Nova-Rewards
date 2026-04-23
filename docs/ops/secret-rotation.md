# Secret Rotation Runbook

**Area:** DevOps | **Priority:** P0-critical

This document describes how to rotate every secret used by Nova Rewards.
Follow these procedures whenever a secret is suspected to be compromised, on a
scheduled basis, or when a team member with access leaves.

---

## Secrets Inventory

| Secret | Scope | Store |
|---|---|---|
| `ISSUER_SECRET` | Backend, blockchain scripts | GitHub Actions Secret |
| `ISSUER_PUBLIC` | Backend, frontend | GitHub Actions Secret |
| `DISTRIBUTION_SECRET` | Backend, blockchain scripts | GitHub Actions Secret |
| `DISTRIBUTION_PUBLIC` | Backend, frontend | GitHub Actions Secret |
| `DATABASE_URL` | Backend | GitHub Actions Secret |
| `POSTGRES_USER` | Backend, docker-compose | GitHub Actions Secret |
| `POSTGRES_PASSWORD` | Backend, docker-compose | GitHub Actions Secret |
| `POSTGRES_DB` | Backend, docker-compose | GitHub Actions Secret |
| `REDIS_URL` | Backend | GitHub Actions Secret |
| `JWT_SECRET` | Backend | GitHub Actions Secret |
| `JWT_EXPIRES_IN` | Backend | GitHub Actions Secret |
| `JWT_REFRESH_EXPIRES_IN` | Backend | GitHub Actions Secret |
| `SMTP_HOST` | Backend | GitHub Actions Secret |
| `SMTP_PORT` | Backend | GitHub Actions Secret |
| `SMTP_USER` | Backend | GitHub Actions Secret |
| `SMTP_PASSWORD` | Backend | GitHub Actions Secret |
| `EMAIL_FROM` | Backend | GitHub Actions Secret |
| `SENDGRID_API_KEY` | Backend | GitHub Actions Secret |
| `NOVA_TOKEN_CONTRACT_ID` | Backend | GitHub Actions Secret |
| `REWARD_POOL_CONTRACT_ID` | Backend | GitHub Actions Secret |
| `ALLOWED_ORIGIN` | Backend | GitHub Actions Secret |
| `NEXT_PUBLIC_API_URL` | Frontend | GitHub Actions Secret |
| `NEXT_PUBLIC_HORIZON_URL` | Frontend | GitHub Actions Secret |
| `NEXT_PUBLIC_ISSUER_PUBLIC` | Frontend | GitHub Actions Secret |
| `NEXT_PUBLIC_STELLAR_NETWORK` | Frontend | GitHub Actions Secret |

---

## General Rotation Procedure

1. Generate the new secret value (see per-secret instructions below).
2. Update the value in **GitHub → Settings → Secrets and variables → Actions**.
3. If the secret is also used in a running environment (VM, container), update it there and restart the affected service.
4. Verify the service starts and passes health checks.
5. Revoke / delete the old secret value at the source (Stellar, SendGrid, etc.).
6. Record the rotation in the team's audit log with date and rotated-by.

---

## Per-Secret Rotation Instructions

### Stellar Issuer Keypair (`ISSUER_SECRET` / `ISSUER_PUBLIC`)

> **Impact:** Rotating the issuer keypair requires re-issuing the NOVA asset from
> the new keypair. Coordinate with the blockchain team before rotating in production.

```bash
# Generate a new keypair using the Stellar CLI or SDK
node -e "
const { Keypair } = require('@stellar/stellar-sdk');
const kp = Keypair.random();
console.log('Public:', kp.publicKey());
console.log('Secret:', kp.secret());
"
```

1. Fund the new issuer account on the target network (testnet: Friendbot; mainnet: XLM transfer).
2. Update `ISSUER_SECRET` and `ISSUER_PUBLIC` in GitHub Actions Secrets.
3. Re-run the asset setup script: `node novaRewards/scripts/setup.js --use-env`.
4. Update `NEXT_PUBLIC_ISSUER_PUBLIC` in GitHub Actions Secrets (frontend).
5. Redeploy frontend and backend.

### Stellar Distribution Keypair (`DISTRIBUTION_SECRET` / `DISTRIBUTION_PUBLIC`)

```bash
node -e "
const { Keypair } = require('@stellar/stellar-sdk');
const kp = Keypair.random();
console.log('Public:', kp.publicKey());
console.log('Secret:', kp.secret());
"
```

1. Fund the new distribution account and establish a trustline to the NOVA asset.
2. Transfer remaining NOVA balance from old distribution account to new one.
3. Update `DISTRIBUTION_SECRET` and `DISTRIBUTION_PUBLIC` in GitHub Actions Secrets.
4. Redeploy backend.

### Database Password (`POSTGRES_PASSWORD` / `DATABASE_URL`)

```bash
# Generate a strong random password
openssl rand -base64 32
```

1. Connect to the PostgreSQL instance and change the password:
   ```sql
   ALTER USER nova WITH PASSWORD '<new-password>';
   ```
2. Update `POSTGRES_PASSWORD` and `DATABASE_URL` in GitHub Actions Secrets.
3. Restart the backend service.

### JWT Secret (`JWT_SECRET`)

```bash
openssl rand -base64 64
```

1. Update `JWT_SECRET` in GitHub Actions Secrets.
2. Redeploy backend. **All existing sessions will be invalidated immediately.**
3. Notify users if session invalidation is user-visible.

### SendGrid API Key (`SENDGRID_API_KEY`)

1. Log in to [SendGrid](https://app.sendgrid.com) → Settings → API Keys.
2. Create a new key with **Mail Send** permission only.
3. Update `SENDGRID_API_KEY` in GitHub Actions Secrets.
4. Redeploy backend.
5. Delete the old API key in SendGrid.

### SMTP Password (`SMTP_PASSWORD`)

1. Rotate the password in your email provider's admin panel.
2. Update `SMTP_PASSWORD` in GitHub Actions Secrets.
3. Redeploy backend.

---

## Scheduled Rotation Schedule

| Secret | Frequency |
|---|---|
| `JWT_SECRET` | Every 90 days |
| `POSTGRES_PASSWORD` | Every 90 days |
| `SENDGRID_API_KEY` | Every 180 days |
| `SMTP_PASSWORD` | Every 180 days |
| Stellar keypairs | On compromise or team change |

---

## Emergency Rotation (Suspected Compromise)

1. **Immediately** rotate the affected secret using the instructions above.
2. Audit recent logs for unauthorized use:
   - Backend logs for unexpected API calls.
   - Stellar Horizon for unexpected transactions from the issuer/distribution accounts.
   - SendGrid activity feed for unexpected email sends.
3. Revoke the compromised secret at the source.
4. File an incident report in the team's incident tracker.

---

## Adding Secrets to GitHub Actions

```bash
# Using the GitHub CLI
gh secret set SECRET_NAME --body "secret-value" --repo org/nova-rewards

# For environment-specific secrets (staging / production)
gh secret set SECRET_NAME --body "secret-value" \
  --repo org/nova-rewards \
  --env production
```

Secrets are injected into containers at runtime via the `env:` block in
`.github/workflows/ci.yml`. No secret values are ever written to disk or
embedded in Docker images.
