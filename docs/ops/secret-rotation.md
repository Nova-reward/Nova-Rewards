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

---

## Field-Level Encryption Key Rotation (`FIELD_ENCRYPTION_KEY`)

> **Complexity:** Very High — involves live DB re-encryption during normal service operation.
> Read this section fully before starting. Test the procedure in staging first.

### Background

Nova Rewards encrypts PII (e.g. `users.email`, `webhooks.secret`) with AES-256-GCM, keyed by
`FIELD_ENCRYPTION_KEY`. Ciphertext format: `base64(iv[12] + authTag[16] + ciphertext)`.

The **dual-key strategy** lets you rotate this key with zero downtime:
- The service simultaneously accepts ciphertext from both the new key and the old key.
- Any row decrypted with the old key is **silently re-encrypted** with the new key on the
  same read — so rows migrate themselves through normal traffic.
- The background batch job (`scripts/encrypt-existing-rows.js`) handles rows that are never
  read during the rotation window.

---

### Pre-rotation checklist

- [ ] You have staging credentials and can run a full dry-run before touching production.
- [ ] You have verified the current `FIELD_ENCRYPTION_KEY` decrypts spot-check rows correctly.
- [ ] You have a DB snapshot / backup taken within the last hour.
- [ ] Relevant team members are on standby during the rotation window.

---

### Step 1 — Generate the new key

```bash
NEW_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
echo "New key: $NEW_KEY"
```

Keep this value safe. Do **not** commit it to source control.

---

### Step 2 — Dry-run the migration script against staging

Confirm row counts and that the script can decrypt existing rows before making any writes.

```bash
FIELD_ENCRYPTION_KEY=<CURRENT_KEY> \
  node novaRewards/scripts/encrypt-existing-rows.js \
    --new-key <NEW_KEY> \
    --old-key <CURRENT_KEY> \
    --batch-size 200 \
    --dry-run
```

Expected output:
```
[encrypt-existing-rows] mode       : key-rotation
[encrypt-existing-rows] dry-run    : true
[encrypt-existing-rows] users.email: NNN rows to examine ...
[encrypt-existing-rows] users.email: DONE — updated=NNN skipped=0 failed=0
```

If `failed > 0`, stop and investigate before proceeding.

---

### Step 3 — Activate dual-key mode in the running service

Update the secret store / environment with **all three** variables simultaneously,
then do a rolling restart so no request is served without the dual-key config:

| Variable | Value |
|---|---|
| `FIELD_ENCRYPTION_KEY` | `<NEW_KEY>` |
| `FIELD_ENCRYPTION_KEY_PREVIOUS` | `<CURRENT_KEY>` (old key) |
| `FIELD_ENCRYPTION_KEY_ROTATED_AT` | current UTC timestamp, e.g. `2026-07-20T16:00:00Z` |
| `KEY_ROTATION_WINDOW_DAYS` | `7` (or your desired window) |

**GitHub Actions / Kubernetes secrets update:**

```bash
# GitHub Actions
gh secret set FIELD_ENCRYPTION_KEY             --body "$NEW_KEY"       --repo org/nova-rewards
gh secret set FIELD_ENCRYPTION_KEY_PREVIOUS    --body "$CURRENT_KEY"   --repo org/nova-rewards
gh secret set FIELD_ENCRYPTION_KEY_ROTATED_AT  --body "$(date -u +'%Y-%m-%dT%H:%M:%SZ')" --repo org/nova-rewards

# Kubernetes (if using Secret objects)
kubectl create secret generic field-encryption-key \
  --from-literal=FIELD_ENCRYPTION_KEY="$NEW_KEY" \
  --from-literal=FIELD_ENCRYPTION_KEY_PREVIOUS="$CURRENT_KEY" \
  --from-literal=FIELD_ENCRYPTION_KEY_ROTATED_AT="$(date -u +'%Y-%m-%dT%H:%M:%SZ')" \
  --dry-run=client -o yaml | kubectl apply -f -
```

Rolling-restart the backend to pick up the new env:

```bash
kubectl rollout restart deployment/nova-backend
# or
docker compose up -d backend
```

Verify dual-key mode is active by checking that authenticated API calls succeed and
that spot-check rows decrypt correctly:

```bash
curl -s -H "Authorization: Bearer <token>" http://localhost:3001/api/profile | jq .email
```

---

### Step 4 — Run the batch re-encryption job

This migrates all rows that are never touched by live traffic.
Run from a machine with access to the production database (or inside the cluster).

```bash
FIELD_ENCRYPTION_KEY=<NEW_KEY> \
FIELD_ENCRYPTION_KEY_PREVIOUS=<CURRENT_KEY> \
DATABASE_URL=<PRODUCTION_DATABASE_URL> \
  node novaRewards/scripts/encrypt-existing-rows.js \
    --new-key  <NEW_KEY> \
    --old-key  <CURRENT_KEY> \
    --batch-size 500
```

The script uses **cursor-based pagination** — it never loads an entire table into memory.
Each batch is processed in parallel UPDATE statements. Monitor progress in the terminal:

```
[encrypt-existing-rows] users.email: 1500/5000 rows processed | updated=1500 skipped=0 failed=0 | 12.3s elapsed
```

Re-run until `updated=0 skipped=<total> failed=0` to confirm all rows are migrated.

---

### Step 5 — Verify: confirm no rows remain encrypted with the old key

```bash
FIELD_ENCRYPTION_KEY=<NEW_KEY> \
DATABASE_URL=<PRODUCTION_DATABASE_URL> \
  node novaRewards/scripts/encrypt-existing-rows.js \
    --new-key <NEW_KEY> \
    --old-key <CURRENT_KEY> \
    --batch-size 500 \
    --dry-run
```

Expected outcome: `updated=0 skipped=<N> failed=0` for every table.

---

### Step 6 — Retire the old key

Once all rows are confirmed migrated:

1. Remove `FIELD_ENCRYPTION_KEY_PREVIOUS` from the secret store.
2. Remove `FIELD_ENCRYPTION_KEY_ROTATED_AT` from the secret store.
3. Remove `KEY_ROTATION_WINDOW_DAYS` if it was set.
4. Rolling-restart the backend again.
5. Verify service health: `curl http://localhost:3001/health`

```bash
# GitHub Actions
gh secret delete FIELD_ENCRYPTION_KEY_PREVIOUS   --repo org/nova-rewards
gh secret delete FIELD_ENCRYPTION_KEY_ROTATED_AT --repo org/nova-rewards

# Kubernetes
kubectl patch secret field-encryption-key \
  --type='json' \
  -p='[{"op": "remove", "path": "/data/FIELD_ENCRYPTION_KEY_PREVIOUS"}, {"op": "remove", "path": "/data/FIELD_ENCRYPTION_KEY_ROTATED_AT"}]'
```

---

### Step 7 — Post-rotation audit

- [ ] Confirm backend logs show zero `DEPRECATION WARNING` messages.
- [ ] Confirm `decrypt()` calls succeed for a sample of recently created rows.
- [ ] Record the rotation in the team audit log: date, rotated-by, old-key fingerprint
      (`echo -n "<OLD_KEY>" | sha256sum`), new-key fingerprint.
- [ ] Update the `FIELD_ENCRYPTION_KEY` rotation date in the Scheduled Rotation Schedule.

---

### Rollback procedure

> Use this only if the rotation has corrupted rows or the service is failing decryption.

**Scenario A — rotation not yet started (before Step 3):**
No action needed. The old key is still in `FIELD_ENCRYPTION_KEY`.

**Scenario B — dual-key mode is active but batch job has not yet run:**

1. Swap `FIELD_ENCRYPTION_KEY` ↔ `FIELD_ENCRYPTION_KEY_PREVIOUS` (restore old key as primary).
2. Remove `FIELD_ENCRYPTION_KEY_ROTATED_AT`.
3. Rolling-restart the backend.

Any rows that were silently re-encrypted with the new key during live traffic will now fail
to decrypt with the old key. To recover them, run the batch script with keys swapped:

```bash
node novaRewards/scripts/encrypt-existing-rows.js \
  --new-key <OLD_KEY> \
  --old-key <NEW_KEY> \
  --batch-size 500
```

**Scenario C — batch job has partially run:**
Same as Scenario B. The batch script is idempotent and handles a mix of
old-key and new-key ciphertext in the same table.

**Scenario D — fully migrated but new key is suspected compromised:**
Treat as a new rotation. Generate a third key and follow this runbook again from Step 1.

---

### Monitoring & alerting

Watch for these log patterns during and after rotation:

| Log pattern | Meaning |
|---|---|
| `[encryption] DEPRECATION WARNING` | A row is still on the old key past the window. Re-run the batch job. |
| `[encryption] Failed to re-encrypt` | A background re-key UPDATE failed (transient). Row will be retried on next read. |
| `[encryption] Failed to decrypt value: authentication tag mismatch` | Wrong key or tampered ciphertext — investigate immediately. |

Add a Prometheus/Grafana alert on `error` log lines matching `Failed to decrypt value` to
detect key misconfiguration early.

---

### Scheduled rotation

| Secret | Frequency |
|---|---|
| `FIELD_ENCRYPTION_KEY` | Every 365 days, or immediately on suspected compromise |

