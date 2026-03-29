# Nova Rewards Contract Upgrade Guide

## Overview

The `contracts/nova-rewards` crate supports in-place WASM upgrades through the
`upgrade` and `migrate` entrypoints. Contract instance storage survives the
WASM swap, so balances, admin state, staking configuration, and the stored
`MigratedVersion` remain available after the upgrade transaction completes.

## What changes during an upgrade

- `upgrade(new_wasm_hash)` replaces the current contract code with a new WASM blob.
- `migrate()` applies any storage or configuration changes required by the new code version.
- `CONTRACT_VERSION` in [`contracts/nova-rewards/src/lib.rs`](../contracts/nova-rewards/src/lib.rs) gates whether `migrate()` is allowed to run.

## Prerequisites

1. Install the Rust toolchain and the `wasm32-unknown-unknown` target.
2. Install the Stellar CLI used by the repository deployment scripts.
3. Have the admin secret or another signer that can authorize the current admin address.
4. Know the deployed contract ID for the `nova-rewards` instance you are upgrading.

```bash
rustup target add wasm32-unknown-unknown
cargo install --locked stellar-cli --features opt
```

## Build the new artifact

Build the specific contract crate so the output path matches the package name used by this repository.

```bash
cd contracts
cargo build --release --target wasm32-unknown-unknown -p nova_rewards
```

Optional optimization step:

```bash
wasm-opt -Oz --strip-debug \
  target/wasm32-unknown-unknown/release/nova_rewards.wasm \
  -o target/wasm32-unknown-unknown/release/nova_rewards.optimized.wasm
```

Use the optimized artifact if `wasm-opt` is available; otherwise use the raw release WASM.

## Upload the new WASM

Upload the artifact to the target network and capture the returned WASM hash.

```bash
stellar contract upload \
  --wasm target/wasm32-unknown-unknown/release/nova_rewards.optimized.wasm \
  --network-passphrase "Test SDF Network ; September 2015" \
  --rpc-url https://soroban-testnet.stellar.org \
  --source <DEPLOYER_SECRET>
```

The command returns the hash required by the `upgrade` entrypoint.

## Execute the upgrade

Call the contract's `upgrade` function with the uploaded hash. Only the current admin can authorize this call.

```bash
stellar contract invoke \
  --id <NOVA_REWARDS_CONTRACT_ID> \
  --network-passphrase "Test SDF Network ; September 2015" \
  --rpc-url https://soroban-testnet.stellar.org \
  --source <ADMIN_SECRET> \
  -- \
  upgrade \
  --new_wasm_hash <UPLOADED_WASM_HASH>
```

On success, the contract emits an `upgrade` event whose topics include the old identifier and new WASM hash, and whose data includes the migration version present before migration runs.

## Run the migration

Immediately invoke `migrate` after a successful WASM update.

```bash
stellar contract invoke \
  --id <NOVA_REWARDS_CONTRACT_ID> \
  --network-passphrase "Test SDF Network ; September 2015" \
  --rpc-url https://soroban-testnet.stellar.org \
  --source <ADMIN_SECRET> \
  -- \
  migrate
```

`migrate()` will panic with `migration already applied` if `CONTRACT_VERSION` is not greater than the stored `MigratedVersion`, so bump the version constant whenever the release requires a migration step.

## Verification checklist

After the upgrade:

1. Invoke `get_migrated_version` and confirm it matches the new `CONTRACT_VERSION`.
2. Query representative balances with `get_balance` to confirm state survived the code swap.
3. Re-run the repository upgrade tests in `contracts/nova-rewards/tests/upgrade.rs`.
4. If staking or swap logic changed, also run the staking and swap test suites before promoting the release.

## Rollback considerations

- Soroban upgrades are forward-only at the contract level, so rollback means uploading and upgrading to a previously known-good WASM.
- Keep the prior production WASM artifact and hash available before changing the live contract.
- Do not run a migration that destroys or rewrites state unless the rollback path has been tested against a backup network snapshot.

## Security notes

- `upgrade` and `migrate` both require admin authorization.
- Separate artifact upload from contract invocation so the WASM hash can be reviewed before promotion.
- Treat the optimized WASM as the release artifact and checksum it in CI or release notes.
