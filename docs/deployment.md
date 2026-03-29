# Deployment Guide

This guide documents the repository-supported deployment flow implemented by
[`scripts/deploy-contracts.sh`](../scripts/deploy-contracts.sh).

## Prerequisites

### 1. Install Rust + wasm32 target

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup target add wasm32-unknown-unknown
```

### 2. Install wasm-opt

```bash
# macOS
brew install binaryen

# Ubuntu / Debian
sudo apt install binaryen

# Or via cargo
cargo install wasm-opt
```

### 3. Install Stellar CLI

```bash
cargo install --locked stellar-cli --features opt
```

Verify: `stellar --version`

### 4. Fund the deployer account

On testnet, use Friendbot:

```bash
curl "https://friendbot.stellar.org?addr=<DEPLOYER_PUBLIC_KEY>"
```

On mainnet, fund the account via an exchange or existing wallet before deploying.

---

## Environment Variables

Create a `.env.testnet` or `.env.mainnet` file, or export the values directly in your shell before running the script:

| Variable | Required | Description |
|---|---|---|
| `DEPLOYER_SECRET` | ✅ | Secret key (`S...`) of the account paying fees |
| `ADMIN_ADDRESS` | ✅ | Public key (`G...`) set as contract admin |
| `NETWORK` | — | `testnet` (default) or `mainnet` |
| `TESTNET_RPC_URL` | — | Override testnet RPC (default: `https://soroban-testnet.stellar.org`) |
| `MAINNET_RPC_URL` | — | Override mainnet RPC (default: `https://soroban-rpc.stellar.org`) |
| `ADMIN_SIGNERS` | — | Space-separated list of multisig signer addresses (default: `ADMIN_ADDRESS`) |
| `ADMIN_THRESHOLD` | — | Multisig approval threshold (default: `1`) |

---

## Usage

### Deploy to testnet

```bash
export DEPLOYER_SECRET=S...
export ADMIN_ADDRESS=G...
NETWORK=testnet bash scripts/deploy-contracts.sh
```

### Deploy to mainnet

```bash
export DEPLOYER_SECRET=S...
export ADMIN_ADDRESS=G...
NETWORK=mainnet bash scripts/deploy-contracts.sh
```

### Dry run (simulate without broadcasting)

```bash
export DEPLOYER_SECRET=S...
export ADMIN_ADDRESS=G...
NETWORK=testnet bash scripts/deploy-contracts.sh --dry-run
```

Dry run prints every command that would be executed and exits without submitting any transactions.

---

## Deployment flow

The repository deploy script works contract-by-contract in a fixed order:

1. `nova_token`
2. `reward_pool`
3. `vesting`
4. `referral`
5. `admin_roles`

For each package it:

1. Builds the contract with `cargo build --manifest-path contracts/Cargo.toml --target wasm32-unknown-unknown --release -p <pkg>`.
2. Optimizes the generated WASM with `wasm-opt -Oz --strip-debug`.
3. Uploads the optimized WASM with `stellar contract upload`.
4. Deploys an instance with `stellar contract deploy`.
5. Writes the resulting contract ID into `.env.<NETWORK>`.
6. Invokes `initialize` with the package-specific arguments.

---

## What the script does

For each contract — **NovaToken**, **RewardPool**, **ClaimDistribution** (vesting), **Staking** (referral), **AdminRoles** — the script:

1. Builds the contract with `cargo build --target wasm32-unknown-unknown --release`
2. Optimises the `.wasm` binary with `wasm-opt -Oz --strip-debug`
3. Uploads the binary with `stellar contract upload` and captures the wasm hash
4. Deploys a contract instance with `stellar contract deploy` and captures the contract ID
5. Writes the contract ID to `.env.<NETWORK>` (e.g. `NOVA_TOKEN_CONTRACT_ID=C...`)
6. Calls `initialize` on the contract with the appropriate arguments

### Initialization arguments

| Contract | Package | `initialize` arguments |
|---|---|---|
| NovaToken | `nova_token` | `--admin "${ADMIN_ADDRESS}"` |
| RewardPool | `reward_pool` | `--admin "${ADMIN_ADDRESS}"` |
| ClaimDistribution | `vesting` | `--admin "${ADMIN_ADDRESS}"` |
| Staking | `referral` | `--admin "${ADMIN_ADDRESS}"` |
| AdminRoles | `admin_roles` | `--admin "${ADMIN_ADDRESS}" --signers "${SIGNERS_JSON}" --threshold "${ADMIN_THRESHOLD}"` |

---

## Network configuration

`scripts/deploy-contracts.sh` derives these values from `NETWORK`:

| Network | RPC URL default | Network passphrase |
|---|---|---|
| `testnet` | `https://soroban-testnet.stellar.org` | `Test SDF Network ; September 2015` |
| `mainnet` | `https://soroban-rpc.stellar.org` | `Public Global Stellar Network ; September 2015` |

Override the RPC endpoints with `TESTNET_RPC_URL` or `MAINNET_RPC_URL` when needed.

---

## Output

After a successful run, `.env.testnet` (or `.env.mainnet`) will contain:

```
NOVA_TOKEN_CONTRACT_ID=C...
REWARD_POOL_CONTRACT_ID=C...
CLAIM_DISTRIBUTION_CONTRACT_ID=C...
STAKING_CONTRACT_ID=C...
ADMIN_ROLES_CONTRACT_ID=C...
```

These values are automatically upserted — re-running the script after an upgrade will overwrite existing entries.

---

## Operational checks

Before broadcasting on a live network:

1. Run the script once with `--dry-run` to confirm environment variables and command generation.
2. Confirm the deployer account has enough XLM for upload, deployment, and initialization transactions.
3. Verify `ADMIN_SIGNERS` and `ADMIN_THRESHOLD` before deploying `admin_roles`, because the script serializes the signer list into JSON and sends it directly to the initializer.
4. Check that `wasm-opt` and `stellar` are available on the runner path.

After deployment:

1. Review the generated `.env.<NETWORK>` file for all five contract IDs.
2. Invoke representative read methods on each deployed contract to confirm initialization succeeded.
3. Store the uploaded WASM hashes alongside the deployed contract IDs for later upgrades.

---

## Re-deploying / Upgrading

To upgrade a single contract, comment out the other `deploy` calls in `scripts/deploy-contracts.sh` and re-run. The new contract ID will overwrite the old one in the env file.
