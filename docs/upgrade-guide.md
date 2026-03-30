# Nova Rewards Contract Upgrade Guide

## Overview

The `nova-rewards` Soroban contract supports in-place Wasm upgrades via
`env.deployer().update_current_contract_wasm()`. Contract instance storage such
as balances, admin state, and migration version is retained across upgrades.

## Prerequisites

```bash
rustup target add wasm32v1-none
cargo install --locked stellar-cli
```

## Step 1: Build the new Wasm

```bash
cd contracts
cargo build --release --target wasm32v1-none -p nova-rewards
```

The build artifact is:

```text
target/wasm32v1-none/release/nova_rewards.wasm
```

## Step 2: Upload the Wasm

```bash
stellar contract upload \
  --network testnet \
  --source-account alice \
  --wasm target/wasm32v1-none/release/nova_rewards.wasm
```

This returns the Wasm hash.

## Step 3: Trigger the upgrade

```bash
stellar contract invoke \
  --network testnet \
  --source-account alice \
  --id <CONTRACT_ID> \
  -- \
  upgrade \
  --new_wasm_hash <WASM_HASH>
```

## Step 4: Run the migration

```bash
stellar contract invoke \
  --network testnet \
  --source-account alice \
  --id <CONTRACT_ID> \
  -- \
  migrate
```

`migrate` is intentionally idempotent per version bump and will reject running
the same migration twice.
