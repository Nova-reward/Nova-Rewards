# Deployment Guide

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

Create a `.env.testnet` or `.env.mainnet` file (or export variables in your shell):

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

## What the script does

For each contract — **NovaToken**, **RewardPool**, **ClaimDistribution** (vesting), **Staking** (referral), **AdminRoles** — the script:

1. Builds the contract with `cargo build --target wasm32-unknown-unknown --release`
2. Optimises the `.wasm` binary with `wasm-opt -Oz --strip-debug`
3. Uploads the binary with `stellar contract upload` and captures the wasm hash
4. Deploys a contract instance with `stellar contract deploy` and captures the contract ID
5. Writes the contract ID to `.env.<NETWORK>` (e.g. `NOVA_TOKEN_CONTRACT_ID=C...`)
6. Calls `initialize` on the contract with the appropriate arguments

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

## Re-deploying / Upgrading

To upgrade a single contract, comment out the other `deploy` calls in `scripts/deploy-contracts.sh` and re-run. The new contract ID will overwrite the old one in the env file.
