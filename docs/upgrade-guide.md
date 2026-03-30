# Nova Rewards Contract — Upgrade Guide

## Overview

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

---

## Prerequisites

```bash
# Rust + wasm32 target
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup target add wasm32-unknown-unknown

# Soroban CLI
cargo install --locked soroban-cli
```

---

## Step 1 — Add migration logic for the new version

In `contracts/nova-rewards/src/lib.rs`, inside `migrate()`, add a versioned
block for any data transformations needed by the new release:

```rust
// Example: backfill a new field for version 2
if migration_version == 2 {
    // ... transform storage ...
}
```

---

## Step 2 — Build the new WASM

```bash
cd contracts/nova-rewards
cargo build --release --target wasm32-unknown-unknown
# Output: ../../target/wasm32-unknown-unknown/release/nova_rewards.wasm
```

---

## Step 3 — Install the WASM and get its hash

```bash
soroban contract install \
  --network testnet \
  --source <ADMIN_SECRET_KEY> \
  --wasm target/wasm32-unknown-unknown/release/nova_rewards.wasm
```

This prints the 64-character hex WASM hash, e.g. `abc123...def456`.

---

## Step 4 — Call upgrade()

```bash
soroban contract invoke \
  --network testnet \
  --source <ADMIN_SECRET_KEY> \
  --id <CONTRACT_ID> \
  -- upgrade \
  --new_wasm_hash <WASM_HASH_FROM_STEP_3>
```

What happens internally:
- `MigrationVersion` is incremented.
- The new WASM hash is stored under `PendingWasmHash`.
- `env.deployer().update_current_contract_wasm(new_wasm_hash)` swaps the bytecode.

---

## Step 5 — Call migrate()

```bash
soroban contract invoke \
  --network testnet \
  --source <ADMIN_SECRET_KEY> \
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

---

## Security

- Only the `admin` address set during `initialize` may call `upgrade` or `migrate`.
- `migrate()` panics with `"migration already applied"` if called more than once per version.
- All instance storage (balances, admin, version counters) survives the WASM swap.

---

## Rollback

Soroban does not support automatic rollback. To revert:

1. Install the previous WASM and note its hash.
2. Call `upgrade()` with the old hash.
3. Call `migrate()` — add compensating data transformations if needed.
