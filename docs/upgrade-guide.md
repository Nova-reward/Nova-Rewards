# Nova Rewards Contract — Upgrade Guide (Issue #206)

## Overview

The `nova-rewards` Soroban contract supports in-place WASM upgrades via
`env.deployer().update_current_contract_wasm()`. All instance storage
(balances, admin, migration version) persists across upgrades.

---

## Prerequisites

```bash
# Install Rust + wasm32 target
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup target add wasm32-unknown-unknown

# Install Soroban CLI
cargo install --locked soroban-cli
```

---

## Step 1 — Build the new WASM

```bash
cd contracts
cargo build --release --target wasm32-unknown-unknown

# Optimised binary is at:
# target/wasm32-unknown-unknown/release/nova_rewards.wasm
```

---

## Step 2 — Get the WASM hash

```bash
soroban contract install \
  --network testnet \
  --source <ADMIN_SECRET_KEY> \
  --wasm target/wasm32-unknown-unknown/release/nova_rewards.wasm
```

This prints the 64-character hex WASM hash, e.g.:
```
abc123...def456
```

---

## Step 3 — Trigger the upgrade

```bash
soroban contract invoke \
  --network testnet \
  --source <ADMIN_SECRET_KEY> \
  --id <CONTRACT_ID> \
  -- \
  upgrade \
  --new_wasm_hash <WASM_HASH_FROM_STEP_2>
```

The contract emits an `upgrade` event on success.

---

## Step 4 — Run the migration

Call `migrate` immediately after upgrading. This is idempotent — calling it
again for the same version is a no-op (panics with "migration already applied").

```bash
soroban contract invoke \
  --network testnet \
  --source <ADMIN_SECRET_KEY> \
  --id <CONTRACT_ID> \
  -- \
  migrate
```

---

## Version tracking

| Key | Storage | Description |
|-----|---------|-------------|
| `MigratedVersion` | `instance()` | Last successfully applied migration version |

`CONTRACT_VERSION` in `src/lib.rs` must be bumped for each release that
requires a migration. The `migrate` function is a no-op if
`CONTRACT_VERSION <= stored MigratedVersion`.

---

## Security

- Only the `admin` address set during `initialize` may call `upgrade` or `migrate`.
- Attempting either without admin auth panics immediately.
