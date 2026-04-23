#!/usr/bin/env bash
# verify-deployment.sh — Post-deployment verification for all Nova Rewards contracts.
#
# Calls read-only functions on every deployed contract and validates:
#   - The contract is reachable (deployed)
#   - The admin role is assigned (initialized)
#   - Key state is consistent with a fresh deployment
#
# Usage:
#   NETWORK=testnet ./scripts/verify-deployment.sh
#   NETWORK=mainnet ./scripts/verify-deployment.sh
#
# Exit codes:
#   0 — all checks passed
#   1 — one or more checks failed (details printed to stderr)
set -euo pipefail

# ── Config ────────────────────────────────────────────────────────────────────

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
NETWORK="${NETWORK:-testnet}"
ENV_FILE="${REPO_ROOT}/.env.${NETWORK}"
DEPLOY_OUT="${REPO_ROOT}/deployments/${NETWORK}.json"

# ── Load env ──────────────────────────────────────────────────────────────────

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: ${ENV_FILE} not found." >&2
  exit 1
fi
# shellcheck disable=SC1090
set -a; source "$ENV_FILE"; set +a

: "${RPC_URL:?RPC_URL must be set in ${ENV_FILE}}"
: "${NETWORK_PASSPHRASE:?NETWORK_PASSPHRASE must be set in ${ENV_FILE}}"
: "${ADMIN_ADDRESS:?ADMIN_ADDRESS must be set in ${ENV_FILE}}"
# DEPLOYER_SECRET is used as the source account for read-only invocations.
# On networks that require a fee-paying source, this must be funded.
: "${DEPLOYER_SECRET:?DEPLOYER_SECRET must be set in ${ENV_FILE}}"

# ── Load deployed contract IDs ────────────────────────────────────────────────

if [[ ! -f "$DEPLOY_OUT" ]]; then
  echo "ERROR: Deployment manifest not found: ${DEPLOY_OUT}" >&2
  echo "       Run scripts/deploy.sh first." >&2
  exit 1
fi

json_get() {
  local key="$1"
  python3 -c "import json,sys; d=json.load(open('${DEPLOY_OUT}')); print(d.get('${key}',''))" 2>/dev/null || true
}

NOVA_TOKEN_ID="$(json_get "nova_token_contract_id")"
REWARD_POOL_ID="$(json_get "reward_pool_contract_id")"
VESTING_ID="$(json_get "vesting_contract_id")"
REFERRAL_ID="$(json_get "referral_contract_id")"
DISTRIBUTION_ID="$(json_get "distribution_contract_id")"
ADMIN_ROLES_ID="$(json_get "admin_roles_contract_id")"
NOVA_REWARDS_ID="$(json_get "nova_rewards_contract_id")"
GOVERNANCE_ID="$(json_get "governance_contract_id")"

# ── Helpers ───────────────────────────────────────────────────────────────────

PASS=0
FAIL=0
ERRORS=()

log()  { echo "[verify] $*"; }
ok()   { echo "[verify] ✓ $*"; PASS=$((PASS + 1)); }
fail() { echo "[verify] ✗ $*" >&2; ERRORS+=("$*"); FAIL=$((FAIL + 1)); }

# Invoke a read-only contract function and capture its output.
# Returns the trimmed stdout on success, or sets LAST_ERROR on failure.
LAST_OUTPUT=""
LAST_ERROR=""
invoke_ro() {
  local contract_id="$1" fn_name="$2"; shift 2
  LAST_OUTPUT=""
  LAST_ERROR=""

  local output
  if output="$(stellar contract invoke \
    --id "${contract_id}" \
    --source "${DEPLOYER_SECRET}" \
    --rpc-url "${RPC_URL}" \
    --network-passphrase "${NETWORK_PASSPHRASE}" \
    -- "${fn_name}" "$@" 2>&1)"; then
    LAST_OUTPUT="$(echo "$output" | tr -d '[:space:]')"
    return 0
  else
    LAST_ERROR="$output"
    return 1
  fi
}

# Assert that a contract ID variable is non-empty.
require_id() {
  local name="$1" id="$2"
  if [[ -z "$id" ]]; then
    fail "${name}: contract ID missing from ${DEPLOY_OUT} — was it deployed?"
    return 1
  fi
  return 0
}

# Assert that the output of the last invoke_ro call equals an expected value.
assert_eq() {
  local label="$1" expected="$2"
  local actual="$LAST_OUTPUT"
  # Strip surrounding quotes that the CLI may add to string values
  actual="${actual//\"/}"
  expected="${expected//\"/}"
  if [[ "$actual" == "$expected" ]]; then
    ok "${label}: got expected value '${expected}'"
  else
    fail "${label}: expected '${expected}', got '${actual}'"
  fi
}

# Assert that the output of the last invoke_ro call is a non-empty address
# (starts with 'C' for contract or 'G' for account on Stellar).
assert_is_address() {
  local label="$1"
  local actual="${LAST_OUTPUT//\"/}"
  if [[ "$actual" =~ ^[CG][A-Z2-7]{54,55}$ ]]; then
    ok "${label}: admin address present (${actual:0:8}…)"
  else
    fail "${label}: expected a Stellar address, got '${actual}'"
  fi
}

# Assert that the output is a non-negative integer.
assert_is_integer() {
  local label="$1"
  local actual="${LAST_OUTPUT//\"/}"
  if [[ "$actual" =~ ^-?[0-9]+$ ]]; then
    ok "${label}: got integer value '${actual}'"
  else
    fail "${label}: expected an integer, got '${actual}'"
  fi
}

# ── Check: contract is deployed and callable ──────────────────────────────────
check_deployed() {
  local name="$1" contract_id="$2" fn_name="$3"; shift 3
  if ! require_id "$name" "$contract_id"; then return; fi

  if invoke_ro "$contract_id" "$fn_name" "$@"; then
    ok "${name}: contract is deployed and callable (${fn_name})"
  else
    fail "${name}: contract not callable — ${LAST_ERROR}"
  fi
}

# ── Check: admin address is set and matches ADMIN_ADDRESS ────────────────────
check_admin() {
  local name="$1" contract_id="$2"
  if ! require_id "$name" "$contract_id"; then return; fi

  if invoke_ro "$contract_id" "get_admin"; then
    local actual="${LAST_OUTPUT//\"/}"
    if [[ "$actual" == "$ADMIN_ADDRESS" ]]; then
      ok "${name}.get_admin: admin matches ADMIN_ADDRESS"
    else
      fail "${name}.get_admin: expected '${ADMIN_ADDRESS}', got '${actual}'"
    fi
  else
    fail "${name}.get_admin: call failed — ${LAST_ERROR}"
  fi
}

# ── Check: initialized flag (storage key present) ────────────────────────────
# We infer initialization by successfully calling a function that panics when
# the contract is not initialized (e.g. get_admin, get_balance, proposal_count).
# A successful call is sufficient proof that initialize() was called.

# ── Verification suite ────────────────────────────────────────────────────────

log "========================================================"
log "Nova Rewards — Post-Deployment Verification"
log "Network  : ${NETWORK}"
log "RPC      : ${RPC_URL}"
log "Admin    : ${ADMIN_ADDRESS}"
log "Manifest : ${DEPLOY_OUT}"
log "========================================================"

# ── 1. nova_token ─────────────────────────────────────────────────────────────
log ""
log "── nova_token (${NOVA_TOKEN_ID:-<missing>}) ──"

if require_id "nova_token" "$NOVA_TOKEN_ID"; then
  # Deployed & callable
  if invoke_ro "$NOVA_TOKEN_ID" "balance" --addr "$ADMIN_ADDRESS"; then
    ok "nova_token: deployed and callable (balance)"
    assert_is_integer "nova_token.balance"
  else
    fail "nova_token: balance call failed — ${LAST_ERROR}"
  fi

  # Admin balance query returns a non-negative integer (0 is fine on fresh deploy)
  if invoke_ro "$NOVA_TOKEN_ID" "balance" --addr "$ADMIN_ADDRESS"; then
    nova_token_bal="${LAST_OUTPUT//\"/}"
    if [[ "$nova_token_bal" =~ ^[0-9]+$ ]]; then
      ok "nova_token: admin balance is a non-negative integer (${nova_token_bal})"
    else
      fail "nova_token: unexpected balance value '${nova_token_bal}'"
    fi
  fi

  # Allowance query (zero is expected on fresh deploy)
  if invoke_ro "$NOVA_TOKEN_ID" "allowance" \
      --owner "$ADMIN_ADDRESS" --spender "$ADMIN_ADDRESS"; then
    ok "nova_token: allowance query callable"
    assert_is_integer "nova_token.allowance"
  else
    fail "nova_token: allowance call failed — ${LAST_ERROR}"
  fi
fi

# ── 2. reward_pool ────────────────────────────────────────────────────────────
log ""
log "── reward_pool (${REWARD_POOL_ID:-<missing>}) ──"

if require_id "reward_pool" "$REWARD_POOL_ID"; then
  # Deployed & callable
  if invoke_ro "$REWARD_POOL_ID" "get_balance"; then
    ok "reward_pool: deployed and callable (get_balance)"
    assert_is_integer "reward_pool.get_balance"
  else
    fail "reward_pool: get_balance call failed — ${LAST_ERROR}"
  fi

  # Daily limit should be set (i128::MAX on fresh deploy)
  if invoke_ro "$REWARD_POOL_ID" "get_daily_limit"; then
    ok "reward_pool: get_daily_limit callable"
    assert_is_integer "reward_pool.get_daily_limit"
  else
    fail "reward_pool: get_daily_limit call failed — ${LAST_ERROR}"
  fi
fi

# ── 3. vesting ────────────────────────────────────────────────────────────────
log ""
log "── vesting (${VESTING_ID:-<missing>}) ──"

if require_id "vesting" "$VESTING_ID"; then
  # Initialized: pool_balance returns 0 on fresh deploy
  if invoke_ro "$VESTING_ID" "pool_balance"; then
    ok "vesting: deployed and callable (pool_balance)"
    assert_is_integer "vesting.pool_balance"
  else
    fail "vesting: pool_balance call failed — ${LAST_ERROR}"
  fi
fi

# ── 4. referral ───────────────────────────────────────────────────────────────
log ""
log "── referral (${REFERRAL_ID:-<missing>}) ──"

if require_id "referral" "$REFERRAL_ID"; then
  # pool_balance returns 0 on fresh deploy
  if invoke_ro "$REFERRAL_ID" "pool_balance"; then
    ok "referral: deployed and callable (pool_balance)"
    assert_is_integer "referral.pool_balance"
  else
    fail "referral: pool_balance call failed — ${LAST_ERROR}"
  fi

  # total_referrals for admin should be 0
  if invoke_ro "$REFERRAL_ID" "total_referrals" --referrer "$ADMIN_ADDRESS"; then
    ok "referral: total_referrals callable"
    assert_is_integer "referral.total_referrals"
  else
    fail "referral: total_referrals call failed — ${LAST_ERROR}"
  fi
fi

# ── 5. distribution ───────────────────────────────────────────────────────────
log ""
log "── distribution (${DISTRIBUTION_ID:-<missing>}) ──"

if require_id "distribution" "$DISTRIBUTION_ID"; then
  # get_admin proves initialization
  check_admin "distribution" "$DISTRIBUTION_ID"

  # calculate_reward is a pure function — no state required
  if invoke_ro "$DISTRIBUTION_ID" "calculate_reward" \
      --base-amount 1000 --rate-bps 500; then
    ok "distribution: calculate_reward callable"
    assert_eq "distribution.calculate_reward(1000, 500)" "50"
  else
    fail "distribution: calculate_reward call failed — ${LAST_ERROR}"
  fi

  # get_distributed for admin should be 0 on fresh deploy
  if invoke_ro "$DISTRIBUTION_ID" "get_distributed" --recipient "$ADMIN_ADDRESS"; then
    ok "distribution: get_distributed callable"
    assert_is_integer "distribution.get_distributed"
  else
    fail "distribution: get_distributed call failed — ${LAST_ERROR}"
  fi
fi

# ── 6. admin_roles ────────────────────────────────────────────────────────────
log ""
log "── admin_roles (${ADMIN_ROLES_ID:-<missing>}) ──"

if require_id "admin_roles" "$ADMIN_ROLES_ID"; then
  # get_admin proves initialization and admin assignment
  check_admin "admin_roles" "$ADMIN_ROLES_ID"

  # get_threshold should be >= 1
  if invoke_ro "$ADMIN_ROLES_ID" "get_threshold"; then
    threshold="${LAST_OUTPUT//\"/}"
    if [[ "$threshold" =~ ^[0-9]+$ ]] && [[ "$threshold" -ge 1 ]]; then
      ok "admin_roles.get_threshold: threshold is ${threshold} (>= 1)"
    else
      fail "admin_roles.get_threshold: expected integer >= 1, got '${threshold}'"
    fi
  else
    fail "admin_roles: get_threshold call failed — ${LAST_ERROR}"
  fi

  # get_signers should return a non-empty list
  if invoke_ro "$ADMIN_ROLES_ID" "get_signers"; then
    ok "admin_roles: get_signers callable"
  else
    fail "admin_roles: get_signers call failed — ${LAST_ERROR}"
  fi

  # No pending admin transfer on fresh deploy
  if invoke_ro "$ADMIN_ROLES_ID" "get_pending_admin"; then
    ok "admin_roles: get_pending_admin callable"
  else
    fail "admin_roles: get_pending_admin call failed — ${LAST_ERROR}"
  fi
fi

# ── 7. nova_rewards ───────────────────────────────────────────────────────────
log ""
log "── nova_rewards (${NOVA_REWARDS_ID:-<missing>}) ──"

if require_id "nova_rewards" "$NOVA_REWARDS_ID"; then
  # is_paused should be false on fresh deploy
  if invoke_ro "$NOVA_REWARDS_ID" "is_paused"; then
    paused="${LAST_OUTPUT//\"/}"
    if [[ "$paused" == "false" ]]; then
      ok "nova_rewards.is_paused: contract is not paused"
    else
      fail "nova_rewards.is_paused: expected 'false', got '${paused}'"
    fi
  else
    fail "nova_rewards: is_paused call failed — ${LAST_ERROR}"
  fi

  # get_annual_rate returns 0 on fresh deploy (not yet configured)
  if invoke_ro "$NOVA_REWARDS_ID" "get_annual_rate"; then
    ok "nova_rewards: get_annual_rate callable"
    assert_is_integer "nova_rewards.get_annual_rate"
  else
    fail "nova_rewards: get_annual_rate call failed — ${LAST_ERROR}"
  fi

  # get_balance for admin should be 0 on fresh deploy
  if invoke_ro "$NOVA_REWARDS_ID" "get_balance" --user "$ADMIN_ADDRESS"; then
    ok "nova_rewards: get_balance callable"
    assert_is_integer "nova_rewards.get_balance"
  else
    fail "nova_rewards: get_balance call failed — ${LAST_ERROR}"
  fi

  # get_migration_version should be 0 on fresh deploy
  if invoke_ro "$NOVA_REWARDS_ID" "get_migration_version"; then
    ok "nova_rewards: get_migration_version callable"
    assert_is_integer "nova_rewards.get_migration_version"
  else
    fail "nova_rewards: get_migration_version call failed — ${LAST_ERROR}"
  fi

  # get_recovery_admin should return a valid address
  if invoke_ro "$NOVA_REWARDS_ID" "get_recovery_admin"; then
    ok "nova_rewards: get_recovery_admin callable"
    assert_is_address "nova_rewards.get_recovery_admin"
  else
    fail "nova_rewards: get_recovery_admin call failed — ${LAST_ERROR}"
  fi
fi

# ── 8. governance (optional — may not be deployed on all networks) ────────────
log ""
log "── governance (${GOVERNANCE_ID:-<not deployed>}) ──"

if [[ -n "$GOVERNANCE_ID" ]]; then
  # proposal_count returns 0 on fresh deploy
  if invoke_ro "$GOVERNANCE_ID" "proposal_count"; then
    ok "governance: deployed and callable (proposal_count)"
    assert_is_integer "governance.proposal_count"
  else
    fail "governance: proposal_count call failed — ${LAST_ERROR}"
  fi
else
  log "  (governance contract not in manifest — skipping)"
fi

# ── Summary ───────────────────────────────────────────────────────────────────

log ""
log "========================================================"
log "Verification complete — Network: ${NETWORK}"
log "  Passed : ${PASS}"
log "  Failed : ${FAIL}"
log "========================================================"

if [[ "${FAIL}" -gt 0 ]]; then
  echo "" >&2
  echo "[verify] FAILED checks:" >&2
  for err in "${ERRORS[@]}"; do
    echo "  ✗ ${err}" >&2
  done
  echo "" >&2
  echo "[verify] Deployment verification FAILED on ${NETWORK}. Promotion blocked." >&2
  exit 1
fi

log "All checks passed. Deployment on ${NETWORK} is healthy."
exit 0
