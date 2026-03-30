# Deployment Guide

## Prerequisites

1. Install Rust and the Soroban contract target:

```bash
rustup target add wasm32v1-none
```

2. Install the current Stellar CLI:

```bash
cargo install --locked stellar-cli
```

Verify with:

```bash
stellar --version
```

3. Fund the deployer account.

On testnet:

```bash
curl "https://friendbot.stellar.org?addr=<DEPLOYER_PUBLIC_KEY>"
```

## Environment Variables

Create a `.env.testnet` or `.env.mainnet` file, or export these values in your
shell:

| Variable | Required | Description |
| --- | --- | --- |
| `DEPLOYER_SECRET` | Yes | Secret key (`S...`) of the account paying fees |
| `ADMIN_ADDRESS` | Yes | Public key (`G...`) set as contract admin |
| `NETWORK` | No | `testnet` (default) or `mainnet` |
| `TESTNET_RPC_URL` | No | Override testnet RPC (default: `https://soroban-testnet.stellar.org`) |
| `MAINNET_RPC_URL` | No | Override mainnet RPC (default: `https://soroban-rpc.stellar.org`) |
| `ADMIN_SIGNERS` | No | Space-separated list of multisig signer addresses |
| `ADMIN_THRESHOLD` | No | Multisig approval threshold (default: `1`) |

## Usage

Deploy to testnet:

```bash
export DEPLOYER_SECRET=S...
export ADMIN_ADDRESS=G...
NETWORK=testnet bash scripts/deploy-contracts.sh
```

Dry run:

```bash
export DEPLOYER_SECRET=S...
export ADMIN_ADDRESS=G...
NETWORK=testnet bash scripts/deploy-contracts.sh --dry-run
```

## What the script does

For each contract, the deployment script:

1. Builds the contract with `cargo build --target wasm32v1-none --release`
2. Optimizes the generated Wasm with `stellar contract optimize`
3. Uploads the optimized Wasm with `stellar contract upload`
4. Deploys a contract instance with `stellar contract deploy`
5. Writes the resulting contract ID to `.env.<NETWORK>`
6. Invokes `initialize` with the expected arguments
