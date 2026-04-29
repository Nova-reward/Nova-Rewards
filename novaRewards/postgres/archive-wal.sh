#!/bin/sh
set -eu

SOURCE_PATH="$1"
FILE_NAME="$2"
ARCHIVE_DIR="${BACKUP_WAL_ARCHIVE_DIR:-/var/lib/postgresql/wal-archive}"

if [ -z "${BACKUP_PASSPHRASE:-}" ]; then
  echo "BACKUP_PASSPHRASE is required for WAL archiving" >&2
  exit 1
fi

mkdir -p "$ARCHIVE_DIR"

openssl enc -aes-256-cbc -pbkdf2 -salt \
  -pass "pass:${BACKUP_PASSPHRASE}" \
  -in "$SOURCE_PATH" \
  -out "$ARCHIVE_DIR/$FILE_NAME.enc"

cat > "$ARCHIVE_DIR/$FILE_NAME.json" <<EOF
{
  "fileName": "$FILE_NAME.enc",
  "originalName": "$FILE_NAME",
  "archivedAt": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
}
EOF
