#!/usr/bin/env bash
# pg-backup.sh — PostgreSQL automated backup script
#
# Creates a compressed pg_dump, uploads to S3, and prunes local copies older
# than BACKUP_RETAIN_DAYS. Designed to run as a cron job or Docker entrypoint.
#
# Required env vars:
#   DATABASE_URL          — postgres connection string
#   BACKUP_S3_BUCKET      — S3 bucket name (e.g. nova-rewards-backups)
#
# Optional env vars:
#   BACKUP_RETAIN_DAYS    — days to keep local backups (default: 7)
#   AWS_REGION            — AWS region (default: us-east-1)
#   BACKUP_DIR            — local backup directory (default: /backups)

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/backups}"
RETAIN_DAYS="${BACKUP_RETAIN_DAYS:-7}"
TIMESTAMP=$(date -u +"%Y%m%dT%H%M%SZ")
FILENAME="nova_rewards_${TIMESTAMP}.dump"
FILEPATH="${BACKUP_DIR}/${FILENAME}"

mkdir -p "$BACKUP_DIR"

echo "[backup] Starting PostgreSQL backup → ${FILENAME}"
pg_dump "$DATABASE_URL" \
  --format=custom \
  --compress=9 \
  --no-password \
  --file="$FILEPATH"

echo "[backup] Dump complete ($(du -sh "$FILEPATH" | cut -f1))"

# Upload to S3 if bucket is configured
if [[ -n "${BACKUP_S3_BUCKET:-}" ]]; then
  S3_KEY="postgres/${FILENAME}"
  echo "[backup] Uploading to s3://${BACKUP_S3_BUCKET}/${S3_KEY}"
  aws s3 cp "$FILEPATH" "s3://${BACKUP_S3_BUCKET}/${S3_KEY}" \
    --region "${AWS_REGION:-us-east-1}" \
    --storage-class STANDARD_IA
  echo "[backup] Upload complete"
fi

# Prune local backups older than RETAIN_DAYS
find "$BACKUP_DIR" -name "nova_rewards_*.dump" -mtime "+${RETAIN_DAYS}" -delete
echo "[backup] Pruned local backups older than ${RETAIN_DAYS} days"

echo "[backup] Done"
