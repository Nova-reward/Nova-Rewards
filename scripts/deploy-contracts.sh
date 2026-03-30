#!/usr/bin/env bash
set -euo pipefail

# ── Config ────────────────────────────────────────────────────────────────────
NETWORK="${NETWORK:-testnet}"
DRY_RUN=false
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=true

CONTRACTS_DIR="$(cd "$(dirname "$0")/../contracts" && pwd)"
ENV_FILE="$(cd "$(dirname "$0")/.." && pwd)/.env.${NETWORK}"

if [[ "$NETWORK" == "mainnet" ]]; then
  NETWORK_PASSPHRASE="Public Global Stellar Network ; September 2015"
  RPC_URL="${MAINNET_RPC_URL:-https://soroban-rpc.stellar.org}"
else
  NETWORK_PASSPHRASE="Test SDF Network ; September 2015"
  RPC_URL="${TESTNET_RPC_URL:-https://soroban-testnet.stellar.org}"
fi

# Required env vars
: "${DEPLOYER_SECRET:?DEPLOYER_SECRET is required}"
: "${ADMIN_ADDRESS:?ADMIN_ADDRESS is required}"

# admin_roles extra args (signers is a space-separated list of addresses)
: "${ADMIN_SIGNERS:=${ADMIN_ADDRESS}}"
: "${ADMIN_THRESHOLD:=1}"

# ── Helpers ───────────────────────────────────────────────────────────────────
log() { echo "[deploy] $*"; }

run() {
  log "$ $*"
  $DRY_RUN && return 0
  eval "$@"
}

write_env() {
  local key="$1" val="$2"
  if grep -q "^${key}=" "$ENV_FILE" 2>/dev/null; then
    sed -i "s|^${key}=.*|${key}=${val}|" "$ENV_FILE"
  else
    echo "${key}=${val}" >> "$ENV_FILE"
  fi
}

build_contract() {
  local pkg="$1"
  log "Building ${pkg}..."
  run cargo build --manifest-path "${CONTRACTS_DIR}/Cargo.toml" \
    --target wasm32-unknown-unknown --release \
    -p "${pkg}"
}

optimize_wasm() {
  local pkg="$1"
  local wasm="${CONTRACTS_DIR}/target/wasm32-unknown-unknown/release/${pkg}.wasm"
  local opt="${CONTRACTS_DIR}/target/wasm32-unknown-unknown/release/${pkg}.optimized.wasm"
  log "Optimising ${pkg}.wasm..."
  run wasm-opt -Oz --strip-debug "$wasm" -o "$opt"
}

upload_contract() {
  local pkg="$1"
  local wasm="${CONTRACTS_DIR}/target/wasm32-unknown-unknown/release/${pkg}.optimized.wasm"
  log "Uploading ${pkg}..."
  if $DRY_RUN; then echo "DRY_RUN_HASH_${pkg}"; return; fi
  stellar contract upload \
    --wasm "$wasm" \
    --network-passphrase "${NETWORK_PASSPHRASE}" \
    --rpc-url "${RPC_URL}" \
    --source "${DEPLOYER_SECRET}"
}

deploy_contract() {
  local pkg="$1" wasm_hash="$2"
  log "Deploying ${pkg} (hash: ${wasm_hash})..."
  if $DRY_RUN; then echo "DRY_RUN_CONTRACT_ID_${pkg}"; return; fi
  stellar contract deploy \
    --wasm-hash "$wasm_hash" \
    --network-passphrase "${NETWORK_PASSPHRASE}" \
    --rpc-url "${RPC_URL}" \
    --source "${DEPLOYER_SECRET}"
}

invoke_init() {
  local contract_id="$1"; shift
  log "Initialising ${contract_id}..."
  if $DRY_RUN; then return; fi
  stellar contract invoke \
    --id "$contract_id" \
    --network-passphrase "${NETWORK_PASSPHRASE}" \
    --rpc-url "${RPC_URL}" \
    --source "${DEPLOYER_SECRET}" \
    -- initialize "$@"
}

# deploy <pkg> <ENV_KEY> [init args...]
deploy() {
  local pkg="$1" env_key="$2"; shift 2

  build_contract "$pkg"
  optimize_wasm  "$pkg"
  local hash; hash=$(upload_contract "$pkg")
  local id;   id=$(deploy_contract "$pkg" "$hash")

  write_env "$env_key" "$id"
  log "${env_key}=${id}"

  invoke_init "$id" "$@"
}

# ── Deploy contracts ──────────────────────────────────────────────────────────

# NovaToken → initialize(admin)
deploy nova_token NOVA_TOKEN_CONTRACT_ID \
  --admin "${ADMIN_ADDRESS}"

# RewardPool → initialize(admin)
deploy reward_pool REWARD_POOL_CONTRACT_ID \
  --admin "${ADMIN_ADDRESS}"

# ClaimDistribution (vesting) → initialize(admin)
deploy vesting CLAIM_DISTRIBUTION_CONTRACT_ID \
  --admin "${ADMIN_ADDRESS}"

# Staking (referral) → initialize(admin)
deploy referral STAKING_CONTRACT_ID \
  --admin "${ADMIN_ADDRESS}"

# AdminRoles → initialize(admin, signers, threshold)
# Build signers JSON array from space-separated ADMIN_SIGNERS
SIGNERS_JSON="["
first=true
for addr in $ADMIN_SIGNERS; do
  $first || SIGNERS_JSON+=","
  SIGNERS_JSON+="\"${addr}\""
  first=false
done
SIGNERS_JSON+="]"

deploy admin_roles ADMIN_ROLES_CONTRACT_ID \
  --admin "${ADMIN_ADDRESS}" \
  --signers "${SIGNERS_JSON}" \
  --threshold "${ADMIN_THRESHOLD}"

log "All contracts deployed. IDs written to ${ENV_FILE}"
$DRY_RUN && log "(dry-run: no transactions were broadcast)"
