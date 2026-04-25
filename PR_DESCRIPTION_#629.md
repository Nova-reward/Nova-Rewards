# feat(ops): Automated PostgreSQL Backups with AES-256 Encryption

Closes #629

## Summary

Sets up automated daily PostgreSQL backups with AES-256 encryption at rest, 30-day S3 retention, weekly automated restore tests, and a full recovery runbook.

## Changes

| File | Description |
|---|---|
| `scripts/db-backup.sh` | Daily `pg_dump` → AES-256-CBC encryption → S3 upload |
| `scripts/db-restore-test.sh` | Weekly decrypt → restore → row-count integrity check |
| `.github/workflows/db-backup.yml` | Scheduled backup (daily 02:00 UTC) + restore test (Sunday 03:00 UTC) |
| `docs/ops/database-backup.md` | Backup & recovery runbook with RTO documentation |

## Acceptance Criteria

- [x] Automated daily backups configured with 30-day retention (S3 lifecycle policy in runbook)
- [x] Backups encrypted using AES-256 before storage (`openssl enc -aes-256-cbc -pbkdf2`)
- [x] Weekly automated restore test verifies backup integrity (Sundays 03:00 UTC)
- [x] RTO documented and tested: < 1 hour (`docs/ops/database-backup.md`)
- [x] Backup and restore runbook at `docs/ops/database-backup.md`

## Required Setup

Add the following secrets in **Settings → Secrets and variables → Actions**:

| Secret | Description |
|---|---|
| `DATABASE_URL` | Production PostgreSQL connection string |
| `BACKUP_S3_BUCKET` | S3 bucket name |
| `BACKUP_PASSPHRASE` | AES-256 encryption passphrase |
| `AWS_ACCESS_KEY_ID` | IAM key with S3 read/write on the backup bucket |
| `AWS_SECRET_ACCESS_KEY` | Corresponding IAM secret |
| `AWS_REGION` | AWS region |

Apply the S3 lifecycle policy from the runbook to enforce 30-day retention.
