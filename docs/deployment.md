# Smart Contract Deployment Guide

This guide documents the deployment flow implemented by [`scripts/deploy-contracts.sh`](../scripts/deploy-contracts.sh) for the workspace contracts under `contracts/`:

- `nova_token`
- `reward_pool`
- `vesting`
- `referral`
- `admin_roles`

The script builds each package, optimizes the generated WASM, uploads it to the selected network, deploys a contract instance, invokes `initialize`, and records the contract ID in `.env.<network>`.

## Prerequisites

Install the required toolchain:

```bash
rustup target add wasm32-unknown-unknown
cargo install --locked stellar-cli --features opt
```

Install `wasm-opt`:

```bash
# macOS
brew install binaryen

# Ubuntu / Debian
sudo apt install binaryen
```

Fund the deployer account before broadcasting transactions. Use Friendbot on testnet, or your standard treasury process on mainnet.

## Environment Variables

Export these variables before running the deployment script:

| Variable | Required | Description |
| --- | --- | --- |
| `DEPLOYER_SECRET` | Yes | Secret key used for upload, deploy, and initialize transactions |
| `ADMIN_ADDRESS` | Yes | Address passed to each contract initializer |
| `NETWORK` | No | `testnet` by default, or `mainnet` |
| `TESTNET_RPC_URL` | No | Overrides the default testnet RPC endpoint |
| `MAINNET_RPC_URL` | No | Overrides the default mainnet RPC endpoint |
| `ADMIN_SIGNERS` | No | Space-separated signer list for `admin_roles`; defaults to `ADMIN_ADDRESS` |
| `ADMIN_THRESHOLD` | No | Threshold for `admin_roles`; defaults to `1` |

Example:

```bash
export DEPLOYER_SECRET=S...
export ADMIN_ADDRESS=G...
export NETWORK=testnet
export ADMIN_SIGNERS="$ADMIN_ADDRESS"
export ADMIN_THRESHOLD=1
```

## Run the Script

From the repository root:

```bash
bash scripts/deploy-contracts.sh
```

To preview the generated commands without broadcasting:

```bash
bash scripts/deploy-contracts.sh --dry-run
```

## Deployment Order

The script deploys contracts in this order:

| Order | Package | Output env key | `initialize` arguments |
| --- | --- | --- | --- |
| 1 | `nova_token` | `NOVA_TOKEN_CONTRACT_ID` | `admin` |
| 2 | `reward_pool` | `REWARD_POOL_CONTRACT_ID` | `admin` |
| 3 | `vesting` | `CLAIM_DISTRIBUTION_CONTRACT_ID` | `admin` |
| 4 | `referral` | `STAKING_CONTRACT_ID` | `admin` |
| 5 | `admin_roles` | `ADMIN_ROLES_CONTRACT_ID` | `admin`, `signers`, `threshold` |

For each package, it performs this pipeline:

1. `cargo build --manifest-path contracts/Cargo.toml --target wasm32-unknown-unknown --release -p <package>`
2. `wasm-opt -Oz --strip-debug`
3. `stellar contract upload`
4. `stellar contract deploy`
5. `stellar contract invoke -- initialize ...`
6. Upsert the resulting contract ID into `.env.<NETWORK>`

## Network Defaults

The script derives RPC settings from `NETWORK`:

| Network | Default RPC URL | Network passphrase |
| --- | --- | --- |
| `testnet` | `https://soroban-testnet.stellar.org` | `Test SDF Network ; September 2015` |
| `mainnet` | `https://soroban-rpc.stellar.org` | `Public Global Stellar Network ; September 2015` |

Override these with `TESTNET_RPC_URL` or `MAINNET_RPC_URL` when required.

## Output

After a successful run, `.env.testnet` or `.env.mainnet` will contain entries like:

```text
NOVA_TOKEN_CONTRACT_ID=C...
REWARD_POOL_CONTRACT_ID=C...
CLAIM_DISTRIBUTION_CONTRACT_ID=C...
STAKING_CONTRACT_ID=C...
ADMIN_ROLES_CONTRACT_ID=C...
```

Re-running the script updates existing values for the same keys.

## Post-Deployment Checks

After deployment:

1. Inspect `.env.<NETWORK>` and confirm all five contract IDs were written.
2. Invoke representative read methods on each deployed contract to confirm initialization succeeded.
3. Store the uploaded WASM hashes alongside the contract IDs for future upgrades.

Useful checks include:

- `nova_token.balance`
- `reward_pool.get_balance`
- `vesting.pool_balance`
- `referral.pool_balance`
- `admin_roles.get_admin`

## Notes

- This script only covers the workspace contracts listed in `contracts/Cargo.toml`.
- The separate `contracts/nova-rewards` crate is not part of that workspace and must be built and deployed independently.
- If an `initialize` signature changes, update the contract and [`scripts/deploy-contracts.sh`](../scripts/deploy-contracts.sh) together.
