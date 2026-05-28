# Backup & Disaster Recovery

## Overview

Nova Rewards uses two complementary backup strategies:

| Layer | Mechanism | Retention | RPO |
|---|---|---|---|
| **RDS automated backups + PITR** | AWS-managed snapshots + continuous WAL | 30 days | ~5 min |
| **pg_dump to S3** | Daily GitHub Actions job | 30 days | ~24 h |

Both backup types are encrypted with AWS KMS. Failure alerts are sent via SNS and Prometheus.

---

## Infrastructure

Provisioned by `infra/backup-s3.tf` and `infra/rds.tf`:

- **S3 bucket**: `nova-rewards-<env>-db-backups` — versioned, SSE-KMS, public access blocked
- **Lifecycle**: objects transition to STANDARD_IA after 7 days, expire after 30 days
- **KMS key**: `alias/nova-rewards-<env>-backup`
- **SNS topic**: `nova-rewards-<env>-backup-alerts` — receives failure notifications
- **IAM role**: `nova-rewards-<env>-backup` — assumed by GitHub Actions via OIDC

Apply with:

```bash
cd infra
terraform init
terraform apply -target=aws_s3_bucket.backup -target=aws_kms_key.backup -target=aws_sns_topic.backup_alerts
```

---

## Daily Automated Backup

The GitHub Actions workflow `.github/workflows/db-backup.yml` runs at **02:00 UTC** daily.

Required GitHub Actions secrets:

| Secret | Value |
|---|---|
| `BACKUP_IAM_ROLE_ARN` | ARN from `terraform output backup_iam_role_arn` |
| `DATABASE_URL` | `postgres://user:pass@host:5432/nova_rewards` |
| `BACKUP_S3_BUCKET` | Value from `terraform output backup_bucket_name` |
| `BACKUP_KMS_KEY_ARN` | Value from `terraform output backup_kms_key_arn` |
| `BACKUP_SNS_TOPIC_ARN` | Value from `terraform output backup_sns_topic_arn` |

Trigger a manual backup:

```
GitHub → Actions → "Database Backup" → Run workflow → choose environment
```

---

## Restore Procedures

### Option A — RDS Point-in-Time Recovery (preferred, RPO ~5 min)

Use this when you need to recover to a specific moment within the last 30 days.

1. Identify the target timestamp in UTC (e.g. `2026-05-28T01:45:00Z`).

2. Restore via AWS Console:
   - RDS → Databases → `nova-rewards-production` → Actions → **Restore to point in time**
   - Set **Custom date and time** to your target timestamp
   - Choose a new DB identifier (e.g. `nova-rewards-production-restored`)
   - Keep the same VPC, subnet group, and security group
   - Click **Restore DB instance**

3. Or via AWS CLI:
   ```bash
   aws rds restore-db-instance-to-point-in-time \
     --source-db-instance-identifier nova-rewards-production \
     --target-db-instance-identifier nova-rewards-production-restored \
     --restore-time 2026-05-28T01:45:00Z \
     --region us-east-1
   ```

4. Wait for the instance to reach `available` status (~10–20 min).

5. Update the application's `DATABASE_URL` secret to point to the restored instance endpoint.

6. Run smoke checks (see below).

7. Once verified, rename or promote the restored instance as the new primary.

---

### Option B — pg_dump restore from S3 (RPO ~24 h)

Use this when PITR is unavailable or you need a specific daily snapshot.

1. List available backups:
   ```bash
   aws s3 ls s3://nova-rewards-production-db-backups/postgres/ \
     --region us-east-1 | sort
   ```

2. Download the desired dump:
   ```bash
   aws s3 cp \
     s3://nova-rewards-production-db-backups/postgres/nova_rewards_<TIMESTAMP>.dump \
     ./nova_rewards_restore.dump \
     --region us-east-1
   ```

3. Restore to a target database:
   ```bash
   pg_restore \
     --dbname "$TARGET_DATABASE_URL" \
     --clean \
     --if-exists \
     --no-owner \
     --no-privileges \
     --verbose \
     nova_rewards_restore.dump
   ```

4. Run smoke checks (see below).

---

### Option C — PITR from encrypted WAL archive (local/self-hosted)

Use this for the self-hosted Postgres setup with WAL archiving enabled.

```bash
cd novaRewards
BACKUP_PASSPHRASE=<passphrase> \
node scripts/restore-pitr.js \
  --backup-manifest backups/base/base-<backup-id>.manifest.json \
  --target-time 2026-05-28T01:45:00Z \
  --output-dir recovery/pgdata
```

Start Postgres with `recovery/pgdata` as `PGDATA`. It will replay WAL up to the target time automatically.

---

## Post-Restore Smoke Checks

Run these after any restore before switching production traffic:

```bash
# 1. Health endpoint
curl -f https://api.nova-rewards.com/health

# 2. Database connectivity
psql "$DATABASE_URL" -c "SELECT count(*) FROM users;"

# 3. Recent transactions present
psql "$DATABASE_URL" -c "SELECT max(created_at) FROM transactions;"

# 4. Admin login (manual)
# Log in to the admin dashboard and verify merchant list loads.

# 5. Rewards issuance (manual)
# Issue a test reward and confirm it appears in the user's balance.
```

---

## Monitoring & Alerts

Prometheus alert rules in `monitoring/prometheus/rules/alerts.yml`:

| Alert | Condition | Severity |
|---|---|---|
| `BackupMissed` | No successful backup in >25 h | critical |
| `BackupFailed` | Last backup exit code ≠ 0 | critical |
| `BackupDurationHigh` | Backup took >30 min | warning |

Critical alerts page via PagerDuty and post to `#nova-critical` Slack. Warnings post to `#nova-alerts`.

---

## Quarterly Restore Test Checklist

Perform this test every quarter (schedule: first Monday of Jan, Apr, Jul, Oct).

- [ ] Trigger a manual backup via GitHub Actions and confirm it succeeds
- [ ] Download the latest dump from S3 and verify the file is non-empty and decryptable
- [ ] Restore the dump to a temporary RDS instance or local Postgres
- [ ] Run all smoke checks against the restored instance
- [ ] Verify RDS PITR is available: check AWS Console → RDS → `nova-rewards-production` → **Maintenance & backups** tab shows the expected retention window
- [ ] Confirm SNS failure notification works: temporarily break the backup and verify an alert is received
- [ ] Document the test result (date, tester, RTO achieved, any issues) in the table below
- [ ] Delete the temporary restore instance

### Test Log

| Date | Tester | Method | RTO | Result | Notes |
|---|---|---|---|---|---|
| _YYYY-MM-DD_ | _name_ | _PITR / pg_dump_ | _mm:ss_ | ✅ / ❌ | |
