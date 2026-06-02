#!/usr/bin/env bash
# db-restore-test.sh — Weekly backup integrity verification
#
# Downloads the latest encrypted backup from S3, decrypts it, restores into
# a temporary database, runs a row-count sanity check, then tears down.
#
# Required env vars:
#   BACKUP_S3_BUCKET    — S3 bucket name
#   BACKUP_PASSPHRASE   — decryption passphrase
#   TEST_DATABASE_URL   — connection string for the throwaway restore target
#                         (must NOT point at production)
#
# Optional env vars:
#   AWS_REGION          — AWS region (default: us-east-1)
#   RESTORE_DIR         — local staging dir (default: /tmp/pg-restore-test)

set -euo pipefail

: "${BACKUP_S3_BUCKET:?BACKUP_S3_BUCKET is required}"
: "${BACKUP_PASSPHRASE:?BACKUP_PASSPHRASE is required}"
: "${TEST_DATABASE_URL:?TEST_DATABASE_URL is required}"

AWS_REGION="${AWS_REGION:-us-east-1}"
RESTORE_DIR="${RESTORE_DIR:-/tmp/pg-restore-test}"
mkdir -p "$RESTORE_DIR"

cleanup() {
  echo "[restore-test] Cleaning up ${RESTORE_DIR}"
  rm -rf "$RESTORE_DIR"
}
trap cleanup EXIT

# ── 1. Find latest backup ────────────────────────────────────────────────────
echo "[restore-test] Locating latest backup in s3://${BACKUP_S3_BUCKET}/postgres/"
LATEST_KEY=$(aws s3 ls "s3://${BACKUP_S3_BUCKET}/postgres/" \
  --region "$AWS_REGION" \
  | grep '\.dump\.enc$' \
  | sort | tail -1 | awk '{print $4}')

if [[ -z "$LATEST_KEY" ]]; then
  echo "[restore-test] ERROR: No encrypted backup found in S3" >&2
  exit 1
fi

echo "[restore-test] Latest backup: ${LATEST_KEY}"

# ── 2. Download ──────────────────────────────────────────────────────────────
ENC_FILE="${RESTORE_DIR}/${LATEST_KEY}"
aws s3 cp "s3://${BACKUP_S3_BUCKET}/postgres/${LATEST_KEY}" "$ENC_FILE" \
  --region "$AWS_REGION"

# ── 3. Decrypt ───────────────────────────────────────────────────────────────
DUMP_FILE="${ENC_FILE%.enc}"
echo "[restore-test] Decrypting backup"
openssl enc -d -aes-256-cbc -pbkdf2 \
  -pass "pass:${BACKUP_PASSPHRASE}" \
  -in  "$ENC_FILE" \
  -out "$DUMP_FILE"

# ── 4. Restore ───────────────────────────────────────────────────────────────
echo "[restore-test] Restoring into test database"
pg_restore "$DUMP_FILE" \
  --dbname="$TEST_DATABASE_URL" \
  --no-owner \
  --no-privileges \
  --clean \
  --if-exists \
  --exit-on-error

# ── 5. Sanity check ──────────────────────────────────────────────────────────
echo "[restore-test] Running sanity checks"
CHECKS_PASSED=0
CHECKS_FAILED=0

check_table() {
  local table="$1"
  local count
  count=$(psql "$TEST_DATABASE_URL" -tAc "SELECT COUNT(*) FROM ${table}" 2>/dev/null || echo "ERROR")
  if [[ "$count" == "ERROR" || -z "$count" ]]; then
    echo "[restore-test] FAIL: table '${table}' not accessible"
    CHECKS_FAILED=$((CHECKS_FAILED + 1))
  else
    echo "[restore-test] OK: ${table} — ${count} rows"
    CHECKS_PASSED=$((CHECKS_PASSED + 1))
  fi
}

for table in users merchants campaigns transactions; do
  check_table "$table"
done

echo "[restore-test] Results: ${CHECKS_PASSED} passed, ${CHECKS_FAILED} failed"

if [[ "$CHECKS_FAILED" -gt 0 ]]; then
  echo "[restore-test] RESTORE TEST FAILED" >&2
  exit 1
fi

echo "[restore-test] RESTORE TEST PASSED — $(date -u)"
