# Backup and Recovery

## Overview

Nova Rewards now supports:

- Daily encrypted PostgreSQL base backups
- Continuous encrypted WAL archiving for point-in-time recovery (PITR)
- Admin endpoints to list backups, trigger an on-demand backup, and build a recovery plan
- A disaster recovery procedure for restoring to a specific UTC timestamp

## Environment Variables

Set the following in `.env` for backup automation:

```env
BACKUP_ENABLED=true
BACKUP_PASSPHRASE=replace-with-a-long-random-secret
BACKUP_SCHEDULE_UTC=02:00
BACKUP_RETENTION_DAYS=14
BACKUP_WAL_ARCHIVE_DIR=/var/lib/postgresql/wal-archive
```

## Daily Automated Backups

The backend starts a scheduler that runs once per day at `BACKUP_SCHEDULE_UTC`.

Each run:

1. Creates a physical PostgreSQL base backup using `pg_basebackup`
2. Encrypts the archive with `openssl` and stores it under `novaRewards/backups/base`
3. Writes a manifest JSON file beside the encrypted archive
4. Removes expired backups based on `BACKUP_RETENTION_DAYS`

## Point-in-Time Recovery

PITR works by restoring the latest base backup before the requested timestamp and replaying encrypted WAL segments up to that time.

Generate a recovery plan:

```bash
curl -X POST http://localhost:4000/api/admin/backups/recovery-plan \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{"targetTime":"2026-03-30T01:30:00Z"}'
```

Restore from a recovery plan:

```bash
cd novaRewards
BACKUP_PASSPHRASE=replace-with-a-long-random-secret \
node scripts/restore-pitr.js \
  --backup-manifest backups/base/base-<backup-id>.manifest.json \
  --target-time 2026-03-30T01:30:00Z \
  --output-dir recovery/pgdata
```

Then start PostgreSQL with `recovery/pgdata` as the data directory. PostgreSQL will replay archived WAL until `recovery_target_time`.

## Disaster Recovery Plan

1. Confirm the outage scope and last safe recovery timestamp in UTC.
2. Freeze writes to the primary system.
3. Call `POST /api/admin/backups/recovery-plan` with the target timestamp.
4. Restore the selected encrypted base backup with `node scripts/restore-pitr.js`.
5. Boot PostgreSQL using the recovered data directory and verify replay completes.
6. Run application smoke checks:
   - `GET /health`
   - Admin login
   - Rewards issuance flow
   - Redemption history query
7. Switch traffic to the recovered environment.
8. Rotate `BACKUP_PASSPHRASE` if compromise is suspected and take a fresh backup immediately after recovery.

## Backup Locations

- Base backups: `novaRewards/backups/base`
- WAL archive: `novaRewards/backups/wal`
- Recovery staging: `novaRewards/recovery`
