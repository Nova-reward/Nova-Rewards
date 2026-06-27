# Database Backup & Recovery Runbook

**Area:** DevOps | **Priority:** P1-high | **Closes:** #629

---

## Overview

| Property | Value |
|---|---|
| Schedule | Daily at 02:00 UTC |
| Retention | 30 days (S3 lifecycle policy) |
| Encryption | AES-256-CBC with PBKDF2 key derivation |
| Storage | S3 (`BACKUP_S3_BUCKET/postgres/`) with `STANDARD_IA` storage class |
| Restore test | Weekly — Sundays at 03:00 UTC |
| RTO target | < 1 hour |

---

## Required Secrets (GitHub Actions)

| Secret | Description |
|---|---|
| `DATABASE_URL` | Production PostgreSQL connection string |
| `BACKUP_S3_BUCKET` | S3 bucket name for backup storage |
| `BACKUP_PASSPHRASE` | AES-256 encryption passphrase — store in AWS Secrets Manager |
| `AWS_ACCESS_KEY_ID` | IAM key with `s3:PutObject`, `s3:GetObject`, `s3:ListBucket` |
| `AWS_SECRET_ACCESS_KEY` | Corresponding IAM secret |
| `AWS_REGION` | AWS region (e.g. `us-east-1`) |

---

## S3 Lifecycle Policy (30-day retention)

Apply this to the bucket to enforce retention automatically:

```json
{
  "Rules": [{
    "ID": "pg-backup-30d-retention",
    "Filter": { "Prefix": "postgres/" },
    "Status": "Enabled",
    "Expiration": { "Days": 30 }
  }]
}
```

```bash
aws s3api put-bucket-lifecycle-configuration \
  --bucket "$BACKUP_S3_BUCKET" \
  --lifecycle-configuration file://lifecycle.json
```

---

## Manual Backup

```bash
export DATABASE_URL="postgresql://..."
export BACKUP_S3_BUCKET="nova-rewards-backups"
export BACKUP_PASSPHRASE="$(aws secretsmanager get-secret-value \
  --secret-id nova-rewards/production/backup-passphrase \
  --query SecretString --output text)"

chmod +x scripts/db-backup.sh
scripts/db-backup.sh
```

---

## Restore Procedure (RTO < 1 hour)

### Step 1 — Identify the backup to restore (~5 min)

```bash
aws s3 ls s3://${BACKUP_S3_BUCKET}/postgres/ | grep '\.dump\.enc$' | sort
```

Pick the target file (latest or a specific point-in-time).

### Step 2 — Download and decrypt (~10 min)

```bash
BACKUP_FILE="nova_rewards_20260424T020000Z.dump.enc"
RESTORE_DIR="/tmp/pg-restore"
mkdir -p "$RESTORE_DIR"

aws s3 cp "s3://${BACKUP_S3_BUCKET}/postgres/${BACKUP_FILE}" "${RESTORE_DIR}/${BACKUP_FILE}"

openssl enc -d -aes-256-cbc -pbkdf2 \
  -pass "pass:${BACKUP_PASSPHRASE}" \
  -in  "${RESTORE_DIR}/${BACKUP_FILE}" \
  -out "${RESTORE_DIR}/restore.dump"
```

### Step 3 — Restore (~30 min depending on DB size)

**Option A — Restore to existing database (destructive):**
```bash
pg_restore "${RESTORE_DIR}/restore.dump" \
  --dbname="$DATABASE_URL" \
  --no-owner --no-privileges \
  --clean --if-exists --exit-on-error
```

**Option B — Restore to a new database:**
```bash
createdb -h <host> -U <admin_user> nova_rewards_restored
pg_restore "${RESTORE_DIR}/restore.dump" \
  --dbname="postgresql://<admin_user>:<pass>@<host>/nova_rewards_restored" \
  --no-owner --no-privileges --exit-on-error
```

### Step 4 — Verify (~5 min)

```bash
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM users;"
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM merchants;"
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM campaigns;"
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM transactions;"
```

### Step 5 — Clean up

```bash
rm -rf "$RESTORE_DIR"
```

---

## Weekly Restore Test

The workflow `.github/workflows/db-backup.yml` runs `scripts/db-restore-test.sh` every Sunday at 03:00 UTC against a throwaway Postgres container. It:

1. Downloads the latest encrypted backup from S3
2. Decrypts it
3. Restores into the ephemeral container
4. Asserts row counts on `users`, `merchants`, `campaigns`, `transactions`
5. Fails the workflow (and triggers GitHub notification) if any check fails

To trigger manually:

```
GitHub Actions → Database Backup → Run workflow → check "Also run restore test"
```

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `BACKUP_PASSPHRASE is required` | Secret not set | Add secret in repo Settings → Secrets |
| `pg_dump: error: connection failed` | Bad `DATABASE_URL` | Verify connection string and network access |
| `openssl: bad decrypt` | Wrong passphrase | Confirm `BACKUP_PASSPHRASE` matches the one used to encrypt |
| Restore test fails row-count check | Backup is corrupt or empty | Investigate the backup job logs; run a manual backup |
| S3 upload fails | IAM permissions | Ensure the IAM key has `s3:PutObject` on `${BACKUP_S3_BUCKET}/postgres/*` |
