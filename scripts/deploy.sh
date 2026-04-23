#!/usr/bin/env bash
# deploy.sh — Deploy all Nova Rewards contracts to testnet or mainnet.
#
# Usage:
#   NETWORK=testnet ./scripts/deploy.sh
#   NETWORK=mainnet ./scripts/deploy.sh
#   ./scripts/deploy.sh --dry-run        # print commands, no transactions
#
# Idempotent: contracts already present in the deployments JSON are skipped.
set -euo pipefail

# ── Config ────────────────────────────────────────────────────────────────────

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
NETWORK="${NETWORK:-testnet}"
DRY_RUN=false
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=true

ENV_FILE="${REPO_ROOT}/.env.${NETWORK}"
CONTRACTS_DIR="${REPO_ROOT}/contracts"
WASM_DIR="${CONTRACTS_DIR}/target/wasm32v1-none/release"
DEPLOY_OUT="${REPO_ROOT}/deployments/${NETWORK}.json"

# ── Load env ──────────────────────────────────────────────────────────────────

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: ${ENV_FILE} not found. Copy .env.testnet or .env.mainnet and fill in values." >&2
  exit 1
fi
# shellcheck disable=SC1090
set -a; source "$ENV_FILE"; set +a

: "${DEPLOYER_SECRET:?DEPLOYER_SECRET must be set in ${ENV_FILE}}"
: "${ADMIN_ADDRESS:?ADMIN_ADDRESS must be set in ${ENV_FILE}}"
: "${RPC_URL:?RPC_URL must be set in ${ENV_FILE}}"
: "${NETWORK_PASSPHRASE:?NETWORK_PASSPHRASE must be set in ${ENV_FILE}}"
ADMIN_SIGNERS="${ADMIN_SIGNERS:-${ADMIN_ADDRESS}}"
ADMIN_THRESHOLD="${ADMIN_THRESHOLD:-1}"

# ── Helpers ───────────────────────────────────────────────────────────────────

log()  { echo "[deploy] $*"; }
info() { echo "[deploy] ✓ $*"; }
err()  { echo "[deploy] ✗ $*" >&2; }

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || { err "Required command not found: $1"; exit 1; }
}

# Read a key from the deployments JSON (returns empty string if missing/null)
json_get() {
  local key="$1"
  if [[ -f "$DEPLOY_OUT" ]]; then
    # Use python if available, else fall back to grep+sed
    if command -v python3 >/dev/null 2>&1; then
      python3 -c "import json,sys; d=json.load(open('${DEPLOY_OUT}')); print(d.get('${key}',''))" 2>/dev/null || true
    else
      grep -o "\"${key}\"[[:space:]]*:[[:space:]]*\"[^\"]*\"" "$DEPLOY_OUT" \
        | sed 's/.*: *"\(.*\)"/\1/' || true
    fi
  fi
}

# Write/update a key in the deployments JSON
json_set() {
  local key="$1" val="$2"
  mkdir -p "$(dirname "$DEPLOY_OUT")"
  if [[ -f "$DEPLOY_OUT" ]]; then
    python3 - <<EOF
import json
with open('${DEPLOY_OUT}') as f:
    d = json.load(f)
d['${key}'] = '${val}'
with open('${DEPLOY_OUT}', 'w') as f:
    json.dump(d, f, indent=2)
EOF
  else
    python3 -c "import json; json.dump({'${key}':'${val}'}, open('${DEPLOY_OUT}','w'), indent=2)"
  fi
}

# Build + optimize a contract package
build_contract() {
  local pkg="$1"
  log "Building ${pkg}..."
  if ! $DRY_RUN; then
    cargo build \
      --manifest-path "${CONTRACTS_DIR}/Cargo.toml" \
      --target wasm32v1-none \
      --release \
      -p "${pkg}" \
      --quiet
    stellar contract optimize \
      --wasm "${WASM_DIR}/${pkg}.wasm" \
      --quiet 2>/dev/null || true
  fi
}

# Upload WASM and return the hash
upload_wasm() {
  local pkg="$1"
  local wasm="${WASM_DIR}/${pkg}.optimized.wasm"
  # Fall back to non-optimized if optimizer wasn't available
  [[ -f "$wasm" ]] || wasm="${WASM_DIR}/${pkg}.wasm"
  log "Uploading ${pkg}.wasm..."
  if $DRY_RUN; then echo "DRY_HASH_${pkg}"; return; fi
  stellar contract upload \
    --wasm "$wasm" \
    --source "${DEPLOYER_SECRET}" \
    --rpc-url "${RPC_URL}" \
    --network-passphrase "${NETWORK_PASSPHRASE}"
}

# Deploy from hash and return the contract ID
deploy_wasm() {
  local pkg="$1" hash="$2"
  log "Deploying ${pkg} (hash: ${hash})..."
  if $DRY_RUN; then echo "DRY_ID_${pkg}"; return; fi
  stellar contract deploy \
    --wasm-hash "${hash}" \
    --source "${DEPLOYER_SECRET}" \
    --rpc-url "${RPC_URL}" \
    --network-passphrase "${NETWORK_PASSPHRASE}"
}

# Invoke the initialize function on a deployed contract
invoke_init() {
  local contract_id="$1"; shift
  log "Initializing ${contract_id}..."
  if $DRY_RUN; then return; fi
  stellar contract invoke \
    --id "${contract_id}" \
    --source "${DEPLOYER_SECRET}" \
    --rpc-url "${RPC_URL}" \
    --network-passphrase "${NETWORK_PASSPHRASE}" \
    -- initialize "$@"
}

# Verify a contract is callable by invoking a read-only function
verify_contract() {
  local contract_id="$1" fn="$2"; shift 2
  log "Verifying ${contract_id} (${fn})..."
  if $DRY_RUN; then info "skipped (dry-run)"; return; fi
  stellar contract invoke \
    --id "${contract_id}" \
    --source "${DEPLOYER_SECRET}" \
    --rpc-url "${RPC_URL}" \
    --network-passphrase "${NETWORK_PASSPHRASE}" \
    -- "${fn}" "$@" >/dev/null
  info "${contract_id} is callable"
}

# Deploy one contract idempotently.
# Usage: deploy_contract <json_key> <cargo_pkg> <init_args...>
deploy_contract() {
  local json_key="$1" pkg="$2"; shift 2

  # Idempotency check
  local existing
  existing="$(json_get "${json_key}")"
  if [[ -n "$existing" ]]; then
    info "${pkg} already deployed: ${existing} (skipping)"
    echo "$existing"
    return
  fi

  build_contract "$pkg"
  local hash; hash="$(upload_wasm "$pkg")"
  local contract_id; contract_id="$(deploy_wasm "$pkg" "$hash")"
  invoke_init "$contract_id" "$@"
  json_set "$json_key" "$contract_id"
  info "${pkg} deployed: ${contract_id}"
  echo "$contract_id"
}

# ── Pre-flight ────────────────────────────────────────────────────────────────

require_cmd cargo
require_cmd stellar
require_cmd python3

log "Network : ${NETWORK}"
log "RPC     : ${RPC_URL}"
log "Admin   : ${ADMIN_ADDRESS}"
$DRY_RUN && log "Mode    : DRY RUN (no transactions will be broadcast)"

# Initialise deployments JSON if absent
[[ -f "$DEPLOY_OUT" ]] || echo '{}' > "$DEPLOY_OUT"

# ── Deployment order ──────────────────────────────────────────────────────────
# 1. nova_token  (no deps)
# 2. distribution (needs nova_token contract ID)
# 3. reward_pool, vesting, referral, nova_rewards (no inter-deps)
# 4. admin_roles (last — governs all others)

# 1. nova_token
NOVA_TOKEN_ID="$(deploy_contract \
  "nova_token_contract_id" "nova_token" \
  --admin "${ADMIN_ADDRESS}")"

# 2. distribution (depends on nova_token)
DISTRIBUTION_ID="$(deploy_contract \
  "distribution_contract_id" "distribution" \
  --admin "${ADMIN_ADDRESS}" \
  --token-id "${NOVA_TOKEN_ID}")"

# 3a. reward_pool
REWARD_POOL_ID="$(deploy_contract \
  "reward_pool_contract_id" "reward_pool" \
  --admin "${ADMIN_ADDRESS}")"

# 3b. vesting
VESTING_ID="$(deploy_contract \
  "vesting_contract_id" "vesting" \
  --admin "${ADMIN_ADDRESS}")"

# 3c. referral
REFERRAL_ID="$(deploy_contract \
  "referral_contract_id" "referral" \
  --admin "${ADMIN_ADDRESS}")"

# 3d. nova_rewards
NOVA_REWARDS_ID="$(deploy_contract \
  "nova_rewards_contract_id" "nova_rewards" \
  --admin "${ADMIN_ADDRESS}")"

# 4. admin_roles (last)
# Build signers JSON array from space-separated ADMIN_SIGNERS
SIGNERS_JSON="["
first=true
for addr in $ADMIN_SIGNERS; do
  $first || SIGNERS_JSON+=","
  SIGNERS_JSON+="\"${addr}\""
  first=false
done
SIGNERS_JSON+="]"

ADMIN_ROLES_ID="$(deploy_contract \
  "admin_roles_contract_id" "admin_roles" \
  --admin "${ADMIN_ADDRESS}" \
  --signers "${SIGNERS_JSON}" \
  --threshold "${ADMIN_THRESHOLD}")"

# ── Post-deployment verification ──────────────────────────────────────────────

log "Running post-deployment verification..."
if $DRY_RUN; then
  log "Skipping verification (dry-run mode)"
else
  NETWORK="${NETWORK}" bash "${REPO_ROOT}/scripts/verify-deployment.sh"
fi

# ── Summary ───────────────────────────────────────────────────────────────────

log ""
log "Deployment complete. Contract IDs written to: ${DEPLOY_OUT}"
log ""
python3 -c "import json; d=json.load(open('${DEPLOY_OUT}')); [print(f'  {k}: {v}') for k,v in d.items()]"
