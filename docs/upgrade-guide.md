# Nova Rewards Contract — Upgrade Guide

This guide covers the upgrade path for the standalone `contracts/nova-rewards` Soroban contract. The contract exposes two admin-only entrypoints for this process:

The `nova-rewards` Soroban contract supports in-place WASM upgrades via
`env.deployer().update_current_contract_wasm()`. All instance storage
(balances, admin, version counters) persists across upgrades.

Two storage keys track upgrade state:

| Key | Description |
|-----|-------------|
| `MigrationVersion` | Target version — incremented by `upgrade()` |
| `MigratedVersion` | Last completed migration — incremented by `migrate()` |

`migrate()` is gated: it only runs when `migrated_version < migration_version`,
so it is safe to call exactly once per upgrade and will panic if called again.

Because the contract stores its operational state in instance storage, balances, staking records, swap configuration, and the saved migration version remain available after a successful code swap.

## Prerequisites

1. Install Rust and the `wasm32-unknown-unknown` target.
2. Install the Stellar CLI used by the repository deployment workflow.
3. Have the admin secret, or another signer authorized to act for the current admin.
4. Know the deployed contract ID for the `nova-rewards` instance you are updating.

```bash
# Rust + wasm32 target
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup target add wasm32-unknown-unknown

# Soroban CLI
cargo install --locked soroban-cli
```

## Build the New Artifact

## Step 1 — Add migration logic for the new version

In `contracts/nova-rewards/src/lib.rs`, inside `migrate()`, add a versioned
block for any data transformations needed by the new release:

```rust
// Example: backfill a new field for version 2
if migration_version == 2 {
    // ... transform storage ...
}
```

The build artifact is:

## Step 2 — Build the new WASM

```bash
cd contracts/nova-rewards
cargo build --release --target wasm32-unknown-unknown
# Output: ../../target/wasm32-unknown-unknown/release/nova_rewards.wasm
```

Use the optimized artifact if `wasm-opt` is available; otherwise use the raw release WASM.

## Upload the WASM

Upload the artifact to the target network and capture the returned hash:

```bash
stellar contract upload \
  --wasm contracts/nova-rewards/target/wasm32-unknown-unknown/release/nova_rewards.optimized.wasm \
  --network-passphrase "Test SDF Network ; September 2015" \
  --rpc-url https://soroban-testnet.stellar.org \
  --source <ADMIN_SECRET>
```

This prints the 64-character hex WASM hash, e.g. `abc123...def456`.

## Execute the Upgrade

## Step 4 — Call upgrade()

```bash
stellar contract invoke \
  --network testnet \
  --source-account alice \
  --id <CONTRACT_ID> \
  -- upgrade \
  --new_wasm_hash <WASM_HASH_FROM_STEP_3>
```

What happens internally:
- `MigrationVersion` is incremented.
- The new WASM hash is stored under `PendingWasmHash`.
- `env.deployer().update_current_contract_wasm(new_wasm_hash)` swaps the bytecode.

## Run the Migration

## Step 5 — Call migrate()

```bash
stellar contract invoke \
  --network testnet \
  --source-account alice \
  --id <CONTRACT_ID> \
  -- migrate
```

What happens internally:
- Checks `migrated_version < migration_version`; panics with `"migration already applied"` if already done.
- Runs version-specific data transformations.
- Sets `MigratedVersion = MigrationVersion`.
- Emits `upgraded` event with `(wasm_hash, migration_version)`.

---

## Step 6 — Verify

```bash
# Both counters should match after a successful migrate()
soroban contract invoke --network testnet --id <CONTRACT_ID> -- get_migration_version
soroban contract invoke --network testnet --id <CONTRACT_ID> -- get_migrated_version
```

Confirm the `upgraded` event appears in the transaction record on the Stellar explorer.

1. Invoke `get_migrated_version` and confirm it matches `get_migration_version` (both counters equal means the migration for this upgrade completed).
2. Query representative balances with `get_balance` to confirm state survived the code swap.
3. Re-run [`contracts/nova-rewards/tests/upgrade.rs`](../contracts/nova-rewards/tests/upgrade.rs).
4. If the release touched swaps or staking, also run the swap and staking test suites.

## Security Notes

- Only the `admin` address set during `initialize` may call `upgrade` or `migrate`.
- `migrate()` panics with `"migration already applied"` if called more than once per version.
- All instance storage (balances, admin, version counters) survives the WASM swap.

---

## Rollback

Soroban does not support automatic rollback. To revert:

1. Install the previous WASM and note its hash.
2. Call `upgrade()` with the old hash.
3. Call `migrate()` — add compensating data transformations if needed.

---

## M-of-N Multisig Upgrade — All Other Contracts

The following contracts use a **M-of-N multisig approval** pattern instead of the two-step `upgrade()`/`migrate()` flow:

- `campaign`
- `escrow`
- `distribution`
- `governance`
- `admin_roles`
- `contract_state`

### How it works

1. Each contract is initialized with a `signers` list and a `threshold` (M-of-N).
2. Each authorized signer calls `approve_upgrade(signer, new_wasm_hash)`.
3. When the approval count reaches `threshold`, the upgrade executes automatically:
   - A `ContractUpgraded` event is emitted with the new WASM hash.
   - `env.deployer().update_current_contract_wasm(new_wasm_hash)` is called.
   - All instance storage (state, admin, config) is preserved.

### Security guarantees

- Unauthorized callers (not in the signer set) are rejected with `"not an authorized signer"`.
- Duplicate approvals from the same signer are rejected with `"already approved"`.
- The upgrade fires exactly once per hash — approvals are cleared before the WASM swap.

### Example: 2-of-3 upgrade for the campaign contract

```bash
# Signer 1 approves
stellar contract invoke --network testnet --source signer1 \
  --id <CAMPAIGN_CONTRACT_ID> \
  -- approve_upgrade \
  --signer <SIGNER1_ADDRESS> \
  --new_wasm_hash <NEW_WASM_HASH>

# Signer 2 approves — threshold reached, upgrade fires
stellar contract invoke --network testnet --source signer2 \
  --id <CAMPAIGN_CONTRACT_ID> \
  -- approve_upgrade \
  --signer <SIGNER2_ADDRESS> \
  --new_wasm_hash <NEW_WASM_HASH>
```

### Checking approval status

```bash
stellar contract invoke --network testnet --id <CONTRACT_ID> \
  -- get_upgrade_approvals \
  --new_wasm_hash <NEW_WASM_HASH>
# Returns: current approval count (u32)

stellar contract invoke --network testnet --id <CONTRACT_ID> \
  -- get_threshold
# Returns: required approvals (u32)
```

### ContractUpgraded event

All contracts emit this event when the upgrade executes:

| Contract       | topics                        | data                                          |
|----------------|-------------------------------|-----------------------------------------------|
| campaign       | `("camp", "upgraded")`        | `(schema_version: 1, new_wasm_hash: BytesN<32>)` |
| escrow         | `("escrow", "upgraded")`      | `(schema_version: 1, new_wasm_hash: BytesN<32>)` |
| distribution   | `("dist", "upgraded")`        | `(schema_version: 1, new_wasm_hash: BytesN<32>)` |
| governance     | `("gov", "upgraded")`         | `(schema_version: 1, new_wasm_hash: BytesN<32>)` |
| admin_roles    | `("adm_roles", "upgraded")`   | `(schema_version: 1, new_wasm_hash: BytesN<32>)` |
| contract_state | `("state", "upgraded")`       | `(schema_version: 1, new_wasm_hash: BytesN<32>)` |

The `nova-rewards` contract emits `("nova_rwd", "upgraded")` with an additional `migration_version: u32` field from its `migrate()` function.

### State preservation

All contracts store operational state in Soroban **instance storage**, which persists across WASM upgrades. After an upgrade:

- Admin addresses, signer sets, and thresholds are unchanged.
- All contract-specific state (campaigns, escrows, distributions, proposals, etc.) is preserved.
- The new WASM code takes effect immediately for all subsequent invocations.

---

## Step-by-step: Full 3-of-5 multi-sig upgrade workflow

This section walks through a complete upgrade of the **campaign** contract from
start to finish using a 3-of-5 signer set.  Substitute `distribution` or
`governance` as needed; the procedure is identical.

### Prerequisites

- Stellar CLI ≥ 21 installed (`stellar --version`).
- The five signer key-pairs available as named profiles in `~/.config/stellar/identity/`.
- The deployed contract ID (visible in `docs/contracts.md` or your deploy log).

### Step 1 — Build and upload the new WASM

```bash
# Build the optimised release artifact
cd contracts/campaign
cargo build --release --target wasm32v1-none
cd ../..

# Upload to the target network and capture the returned hash
NEW_WASM_HASH=$(stellar contract upload \
  --wasm target/wasm32v1-none/release/campaign.wasm \
  --network testnet \
  --source admin \
  | tr -d '[:space:]')

echo "New WASM hash: $NEW_WASM_HASH"
```

The hash is a 64-character hex string, e.g.
`a3f1b2c4d5e6...` — keep it in a shared document so all five signers can
verify they are approving the same artifact.

### Step 2 — Each signer independently verifies the artifact

Before approving, each signer should verify the uploaded WASM matches the
locally-built artifact:

```bash
# Download and compare (requires stellar contract fetch or soroban CLI)
stellar contract fetch \
  --wasm-hash "$NEW_WASM_HASH" \
  --network testnet \
  --out /tmp/fetched.wasm

sha256sum target/wasm32v1-none/release/campaign.wasm /tmp/fetched.wasm
# Both lines must show the same checksum
```

### Step 3 — Signer 1 submits approval

```bash
stellar contract invoke \
  --network testnet \
  --source signer1 \
  --id "$CAMPAIGN_CONTRACT_ID" \
  -- approve_upgrade \
  --signer "$SIGNER1_ADDRESS" \
  --new_wasm_hash "$NEW_WASM_HASH"
```

Poll the approval counter after each invocation:

```bash
stellar contract invoke \
  --network testnet \
  --id "$CAMPAIGN_CONTRACT_ID" \
  -- get_upgrade_approvals \
  --new_wasm_hash "$NEW_WASM_HASH"
# Returns: 1
```

### Step 4 — Signer 2 submits approval

```bash
stellar contract invoke \
  --network testnet \
  --source signer2 \
  --id "$CAMPAIGN_CONTRACT_ID" \
  -- approve_upgrade \
  --signer "$SIGNER2_ADDRESS" \
  --new_wasm_hash "$NEW_WASM_HASH"
# Counter: 2
```

### Step 5 — Signer 3 submits approval (threshold reached — upgrade fires)

```bash
stellar contract invoke \
  --network testnet \
  --source signer3 \
  --id "$CAMPAIGN_CONTRACT_ID" \
  -- approve_upgrade \
  --signer "$SIGNER3_ADDRESS" \
  --new_wasm_hash "$NEW_WASM_HASH"
# Approval count reaches 3 == threshold → upgrade executes automatically.
# The ("camp", "upgraded") event is emitted with (schema_version=1, new_wasm_hash).
# The approval key is removed from storage.
```

### Step 6 — Verify the upgrade succeeded

```bash
# Approval counter should now return 0 (key cleared)
stellar contract invoke \
  --network testnet \
  --id "$CAMPAIGN_CONTRACT_ID" \
  -- get_upgrade_approvals \
  --new_wasm_hash "$NEW_WASM_HASH"
# Expected: 0

# Confirm the threshold config is still intact
stellar contract invoke \
  --network testnet \
  --id "$CAMPAIGN_CONTRACT_ID" \
  -- get_threshold
# Expected: 3

# Check the upgraded event in the transaction record
stellar tx view --network testnet --hash <TX_HASH_OF_SIGNER3_INVOCATION>
```

---

## WASM hash mismatch handling

A WASM hash mismatch means signers are not all voting on the same upgrade.
This is treated as two completely independent ballots — each unique hash has
its own approval counter.

### Symptoms

- `get_upgrade_approvals` returns a count for one hash but `0` for another.
- The upgrade never fires even though enough signers have called `approve_upgrade`.

### Example

```
Signer 1 approves hash A → counter(A) = 1
Signer 2 approves hash B → counter(B) = 1   ← different hash!
Signer 3 approves hash A → counter(A) = 2   (threshold is 3 — still not enough)
```

Neither hash reaches the 3-of-5 threshold.

### Remediation

1. All signers must agree on the canonical hash **before** any invocation.
2. Use the verification step in Step 2 above to confirm everyone's local build
   produces the same hash.
3. If some signers already approved the wrong hash, those approvals are
   harmless — they sit in storage against the wrong key and will never fire
   an upgrade (because no one will complete that ballot).
4. Simply coordinate on the correct hash and repeat Steps 3–5 using the
   agreed hash.

> **There is no penalty for an orphaned ballot.**  The stale approval entries
> under the wrong hash consume a small amount of instance storage but cause no
> security risk.  They are removed automatically if someone ever completes
> *that* ballot (which would require the threshold to be reached on the wrong
> hash — practically impossible without coordination).

---

## Integration tests

The integration tests for all three contracts are located in:

```
contracts/integration_tests/tests/upgrade_approval_tests.rs
```

Run them with:

```bash
cd contracts
cargo test -p integration_tests upgrade_approval
```

### What the tests cover

| Test name | Scenario |
|-----------|----------|
| `*_single_signer_below_threshold_upgrade_blocked` | 1 of 2 signers approves; upgrade does NOT fire; counter stays at 1 |
| `*_threshold_reached_upgrade_executes_and_emits_event` | 2nd signer completes 2-of-2; upgrade fires; counter reset to 0; event emitted |
| `*_duplicate_approval_rejected` | Same signer approves twice; panics with `"already approved"` |
| `*_approval_state_cleared_after_upgrade` | After upgrade the approval key is absent from storage |
| `*_unauthorized_signer_rejected` | Address not in signer set; panics with `"not an authorized signer"` |
| `*_different_hash_is_independent_ballot` | Two different hashes each get 1 approval; neither fires |
| `*_three_of_five_accumulates_then_upgrades` | Progressive 3-of-5 accumulation; count 1 → 2 → upgrade |
| `governance_upgrade_preserves_existing_proposal_state` | Pre-upgrade governance proposals survive the WASM swap |

These tests cover every acceptance criterion from the issue:
- Upgrade is blocked until M-of-N threshold is reached.
- A signer cannot cast a second vote on the same hash.
- The `upgraded` event is emitted with the correct WASM hash once threshold is met.
- Approval state is cleared after a successful upgrade, preventing re-use.
