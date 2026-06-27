#!/usr/bin/env bash
# pg-backup.sh — PostgreSQL automated backup script
#
# Creates a compressed pg_dump, uploads to S3 with SSE-KMS, and prunes local
# copies older than BACKUP_RETAIN_DAYS. Sends an SNS alert on failure.
# Designed to run as a cron job, Docker entrypoint, or GitHub Actions step.
#
# Required env vars:
#   DATABASE_URL          — postgres connection string
#   BACKUP_S3_BUCKET      — S3 bucket name (e.g. nova-rewards-production-db-backups)
#
# Optional env vars:
#   BACKUP_KMS_KEY_ID     — KMS key ID/ARN for SSE-KMS (uses bucket default if unset)
#   BACKUP_SNS_TOPIC_ARN  — SNS topic ARN for failure notifications
#   BACKUP_RETAIN_DAYS    — days to keep local backups (default: 7)
#   AWS_REGION            — AWS region (default: us-east-1)
#   BACKUP_DIR            — local backup directory (default: /backups)

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/backups}"
RETAIN_DAYS="${BACKUP_RETAIN_DAYS:-7}"
TIMESTAMP=$(date -u +"%Y%m%dT%H%M%SZ")
FILENAME="nova_rewards_${TIMESTAMP}.dump"
FILEPATH="${BACKUP_DIR}/${FILENAME}"
EXIT_CODE=0

# ── Failure handler ───────────────────────────────────────────────────────────
on_failure() {
  EXIT_CODE=$?
  local msg="[backup] FAILED: ${FILENAME} — exit code ${EXIT_CODE}"
  echo "$msg" >&2

  if [[ -n "${BACKUP_SNS_TOPIC_ARN:-}" ]]; then
    aws sns publish \
      --region "${AWS_REGION:-us-east-1}" \
      --topic-arn "$BACKUP_SNS_TOPIC_ARN" \
      --subject "Nova Rewards DB Backup Failed" \
      --message "$msg" \
      || true  # don't mask the original error
  fi

  exit "$EXIT_CODE"
}
trap on_failure ERR

mkdir -p "$BACKUP_DIR"

# ── Dump ──────────────────────────────────────────────────────────────────────
echo "[backup] Starting PostgreSQL backup → ${FILENAME}"
pg_dump "$DATABASE_URL" \
  --format=custom \
  --compress=9 \
  --no-password \
  --file="$FILEPATH"

echo "[backup] Dump complete ($(du -sh "$FILEPATH" | cut -f1))"

# ── Upload to S3 with SSE-KMS ─────────────────────────────────────────────────
if [[ -n "${BACKUP_S3_BUCKET:-}" ]]; then
  S3_KEY="postgres/${FILENAME}"
  echo "[backup] Uploading to s3://${BACKUP_S3_BUCKET}/${S3_KEY}"

  SSE_ARGS=(--sse aws:kms)
  if [[ -n "${BACKUP_KMS_KEY_ID:-}" ]]; then
    SSE_ARGS+=(--sse-kms-key-id "$BACKUP_KMS_KEY_ID")
  fi

  aws s3 cp "$FILEPATH" "s3://${BACKUP_S3_BUCKET}/${S3_KEY}" \
    --region "${AWS_REGION:-us-east-1}" \
    --storage-class STANDARD_IA \
    "${SSE_ARGS[@]}"

  echo "[backup] Upload complete"
fi

# ── Prune local backups ───────────────────────────────────────────────────────
find "$BACKUP_DIR" -name "nova_rewards_*.dump" -mtime "+${RETAIN_DAYS}" -delete
echo "[backup] Pruned local backups older than ${RETAIN_DAYS} days"

echo "[backup] Done"
