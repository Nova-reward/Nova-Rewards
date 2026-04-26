#!/usr/bin/env bash
# scripts/diff-env-configs.sh
# Detects unexpected differences between staging and production environment configs.
# Usage: ./scripts/diff-env-configs.sh [--strict]
#
# Exit codes:
#   0 — no unexpected differences
#   1 — unexpected differences found
#   2 — usage error

set -euo pipefail

STAGING_EXAMPLE="novaRewards/.env.staging.example"
PROD_EXAMPLE="novaRewards/.env.prod.example"
STRICT=${1:-}

# Keys that are EXPECTED to differ between environments
EXPECTED_DIFFS=(
  "STELLAR_NETWORK"
  "HORIZON_URL"
  "POSTGRES_USER"
  "POSTGRES_PASSWORD"
  "POSTGRES_DB"
  "DATABASE_URL"
  "DATABASE_MIGRATE_URL"
  "REDIS_PASSWORD"
  "REDIS_URL"
  "REDIS_MAXMEMORY"
  "NODE_ENV"
  "ALLOWED_ORIGIN"
  "JWT_SECRET"
  "FIELD_ENCRYPTION_KEY"
  "NEXT_PUBLIC_API_URL"
  "NEXT_PUBLIC_HORIZON_URL"
  "NEXT_PUBLIC_STELLAR_NETWORK"
  "SMTP_HOST"
  "SMTP_PORT"
  "SMTP_USER"
  "SMTP_PASSWORD"
  "EMAIL_FROM"
  "SENDGRID_API_KEY"
  "BACKUP_RETAIN_DAYS"
  "BACKUP_S3_BUCKET"
  "AWS_ACCESS_KEY_ID"
  "AWS_SECRET_ACCESS_KEY"
  "ISSUER_PUBLIC"
  "ISSUER_SECRET"
  "DISTRIBUTION_PUBLIC"
  "DISTRIBUTION_SECRET"
  "NEXT_PUBLIC_ISSUER_PUBLIC"
)

if [[ ! -f "$STAGING_EXAMPLE" ]]; then
  echo "ERROR: $STAGING_EXAMPLE not found" >&2
  exit 2
fi

if [[ ! -f "$PROD_EXAMPLE" ]]; then
  echo "ERROR: $PROD_EXAMPLE not found" >&2
  exit 2
fi

# Extract variable names (lines starting with a letter, not comments)
extract_keys() {
  grep -E '^[A-Z_]+=?' "$1" | sed 's/=.*//' | sort
}

staging_keys=$(extract_keys "$STAGING_EXAMPLE")
prod_keys=$(extract_keys "$PROD_EXAMPLE")

echo "=== Nova Rewards — Environment Config Diff ==="
echo "Staging : $STAGING_EXAMPLE"
echo "Prod    : $PROD_EXAMPLE"
echo ""

# ── 1. Keys present in staging but missing from prod ─────────────────────────
missing_in_prod=$(comm -23 <(echo "$staging_keys") <(echo "$prod_keys"))
if [[ -n "$missing_in_prod" ]]; then
  echo "⚠  Keys in staging but MISSING in prod:"
  echo "$missing_in_prod" | sed 's/^/   - /'
  echo ""
fi

# ── 2. Keys present in prod but missing from staging ─────────────────────────
missing_in_staging=$(comm -13 <(echo "$staging_keys") <(echo "$prod_keys"))
if [[ -n "$missing_in_staging" ]]; then
  echo "⚠  Keys in prod but MISSING in staging:"
  echo "$missing_in_staging" | sed 's/^/   - /'
  echo ""
fi

# ── 3. Keys present in both — check for unexpected identical values ───────────
unexpected_same=()
while IFS= read -r key; do
  staging_val=$(grep -E "^${key}=" "$STAGING_EXAMPLE" | cut -d= -f2- || true)
  prod_val=$(grep -E "^${key}=" "$PROD_EXAMPLE" | cut -d= -f2- || true)

  if [[ "$staging_val" == "$prod_val" && -n "$staging_val" ]]; then
    # Check if this key is expected to differ
    expected=false
    for expected_key in "${EXPECTED_DIFFS[@]}"; do
      if [[ "$key" == "$expected_key" ]]; then
        expected=true
        break
      fi
    done
    if [[ "$expected" == "false" ]]; then
      unexpected_same+=("$key")
    fi
  fi
done < <(comm -12 <(echo "$staging_keys") <(echo "$prod_keys"))

if [[ ${#unexpected_same[@]} -gt 0 ]]; then
  echo "ℹ  Keys with identical values in both environments (verify intentional):"
  for k in "${unexpected_same[@]}"; do
    echo "   - $k"
  done
  echo ""
fi

# ── 4. Summary ────────────────────────────────────────────────────────────────
has_issues=false
[[ -n "$missing_in_prod" || -n "$missing_in_staging" ]] && has_issues=true
[[ "$STRICT" == "--strict" && ${#unexpected_same[@]} -gt 0 ]] && has_issues=true

if [[ "$has_issues" == "true" ]]; then
  echo "❌ Config drift detected. Review the items above."
  exit 1
else
  echo "✅ No unexpected config drift detected."
  exit 0
fi
