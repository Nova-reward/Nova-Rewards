#!/usr/bin/env bash
# db-backup.sh — Daily PostgreSQL backup with AES-256 encryption and S3 upload
#
# Required env vars:
#   DATABASE_URL        — postgres connection string
#   BACKUP_S3_BUCKET    — S3 bucket name
#   BACKUP_PASSPHRASE   — encryption passphrase
#
# Optional env vars:
#   AWS_REGION          — AWS region (default: us-east-1)
#   BACKUP_DIR          — local staging dir (default: /tmp/pg-backups)
#   BACKUP_RETAIN_DAYS  — S3 lifecycle managed; local cleanup after upload (default: 1)

set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${BACKUP_S3_BUCKET:?BACKUP_S3_BUCKET is required}"
: "${BACKUP_PASSPHRASE:?BACKUP_PASSPHRASE is required}"

BACKUP_DIR="${BACKUP_DIR:-/tmp/pg-backups}"
AWS_REGION="${AWS_REGION:-us-east-1}"
TIMESTAMP=$(date -u +"%Y%m%dT%H%M%SZ")
DUMP_FILE="${BACKUP_DIR}/nova_rewards_${TIMESTAMP}.dump"
ENC_FILE="${DUMP_FILE}.enc"

mkdir -p "$BACKUP_DIR"

echo "[backup] Dumping database → ${DUMP_FILE}"
pg_dump "$DATABASE_URL" \
  --format=custom \
  --compress=9 \
  --no-password \
  --file="$DUMP_FILE"

echo "[backup] Encrypting with AES-256-CBC"
openssl enc -aes-256-cbc -pbkdf2 -salt \
  -pass "pass:${BACKUP_PASSPHRASE}" \
  -in  "$DUMP_FILE" \
  -out "$ENC_FILE"

# Write metadata sidecar
cat > "${ENC_FILE%.enc}.json" <<EOF
{
  "fileName": "$(basename "$ENC_FILE")",
  "timestamp": "${TIMESTAMP}",
  "encryption": "aes-256-cbc-pbkdf2"
}
EOF

echo "[backup] Uploading to s3://${BACKUP_S3_BUCKET}/postgres/"
aws s3 cp "$ENC_FILE" "s3://${BACKUP_S3_BUCKET}/postgres/$(basename "$ENC_FILE")" \
  --region "$AWS_REGION" \
  --storage-class STANDARD_IA

aws s3 cp "${ENC_FILE%.enc}.json" \
  "s3://${BACKUP_S3_BUCKET}/postgres/$(basename "${ENC_FILE%.enc}.json")" \
  --region "$AWS_REGION"

echo "[backup] Upload complete — cleaning up local files"
rm -f "$DUMP_FILE" "$ENC_FILE" "${ENC_FILE%.enc}.json"

echo "[backup] Done — $(date -u)"
