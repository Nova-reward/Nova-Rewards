# Nova Rewards Contract Upgrade Guide

This guide covers the upgrade path for the standalone `contracts/nova-rewards` Soroban contract. The contract exposes two admin-only entrypoints for this process:

- `upgrade(new_wasm_hash)` swaps the deployed contract code to a newly uploaded WASM artifact.
- `migrate()` applies the release-specific migration logic guarded by `CONTRACT_VERSION`.

Because the contract stores its operational state in instance storage, balances, staking records, swap configuration, and the saved migration version remain available after a successful code swap.

## Prerequisites

1. Install Rust and the `wasm32-unknown-unknown` target.
2. Install the Stellar CLI used by the repository deployment workflow.
3. Have the admin secret, or another signer authorized to act for the current admin.
4. Know the deployed contract ID for the `nova-rewards` instance you are updating.

```bash
rustup target add wasm32-unknown-unknown
cargo install --locked stellar-cli --features opt
```

## Build the New Artifact

Build the dedicated `nova-rewards` crate from the repository root:

```bash
cargo build \
  --manifest-path contracts/nova-rewards/Cargo.toml \
  --target wasm32-unknown-unknown \
  --release
```

Optional optimization step:

```bash
wasm-opt -Oz --strip-debug \
  contracts/nova-rewards/target/wasm32-unknown-unknown/release/nova_rewards.wasm \
  -o contracts/nova-rewards/target/wasm32-unknown-unknown/release/nova_rewards.optimized.wasm
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

If you skipped optimization, point `--wasm` at `nova_rewards.wasm` instead. The command returns the hash required by `upgrade`.

## Execute the Upgrade

Call the deployed contract's `upgrade` entrypoint with the uploaded hash:

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

On success, the contract emits an `upgrade` event that includes the previous migration version.

## Run the Migration

Immediately invoke `migrate` after the code swap:

```bash
stellar contract invoke \
  --id <NOVA_REWARDS_CONTRACT_ID> \
  --network-passphrase "Test SDF Network ; September 2015" \
  --rpc-url https://soroban-testnet.stellar.org \
  --source <ADMIN_SECRET> \
  -- \
  migrate
```

`migrate()` panics with `migration already applied` when the stored version is already equal to or ahead of `CONTRACT_VERSION`, so bump the version constant whenever a release needs a migration step.

## Verification Checklist

After the upgrade:

1. Invoke `get_migrated_version` and confirm it matches `CONTRACT_VERSION` in [`contracts/nova-rewards/src/lib.rs`](../contracts/nova-rewards/src/lib.rs).
2. Query representative balances with `get_balance` to confirm state survived the code swap.
3. Re-run [`contracts/nova-rewards/tests/upgrade.rs`](../contracts/nova-rewards/tests/upgrade.rs).
4. If the release touched swaps or staking, also run the swap and staking test suites.

## Security Notes

- `upgrade` and `migrate` both require admin authorization.
- Keep the previous production WASM hash available so you can roll forward to a known-good build if needed.
- Review the exact release artifact before invoking `upgrade`, especially when using an optimized WASM in production.
