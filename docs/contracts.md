# Contract Addresses

All Nova Rewards smart contracts are deployed on the Stellar network using the Soroban runtime.

## Networks

| Network | RPC Endpoint | Explorer |
|---------|-------------|---------|
| Testnet | `https://soroban-testnet.stellar.org` | [Stellar Expert (Testnet)](https://stellar.expert/explorer/testnet) |
| Mainnet | `https://soroban-mainnet.stellar.org` | [Stellar Expert (Mainnet)](https://stellar.expert/explorer/public) |

---

## Contract Addresses

> **Note:** Addresses below are placeholders. Replace with actual deployed contract IDs after running `stellar contract deploy`.

### Testnet

| Contract | Contract ID | Deployed At (Ledger) | Version |
|----------|------------|----------------------|---------|
| `nova-rewards` | `CXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX` | — | 1.0.0 |
| `nova_token` | `CXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX` | — | 1.0.0 |
| `governance` | `CXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX` | — | 1.0.0 |
| `reward_pool` | `CXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX` | — | 1.0.0 |
| `vesting` | `CXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX` | — | 1.0.0 |
| `referral` | `CXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX` | — | 1.0.0 |
| `distribution` | `CXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX` | — | 1.0.0 |
| `admin_roles` | `CXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX` | — | 1.0.0 |

### Mainnet

| Contract | Contract ID | Deployed At (Ledger) | Version |
|----------|------------|----------------------|---------|
| `nova-rewards` | `CXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX` | — | — |
| `nova_token` | `CXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX` | — | — |
| `governance` | `CXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX` | — | — |
| `reward_pool` | `CXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX` | — | — |
| `vesting` | `CXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX` | — | — |
| `referral` | `CXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX` | — | — |
| `distribution` | `CXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX` | — | — |
| `admin_roles` | `CXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX` | — | — |

---

## Deploying Contracts

### Prerequisites

```bash
# Install Stellar CLI
cargo install stellar-cli --features opt

# Configure testnet identity
stellar keys generate deployer --network testnet
stellar keys fund deployer --network testnet
```

### Build

```bash
cd contracts
cargo build --release --target wasm32-unknown-unknown
```

Or use the provided script:

```bash
./scripts/build-contracts.sh
```

### Deploy (Testnet)

```bash
# Deploy nova_token
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/nova_token.wasm \
  --source deployer \
  --network testnet

# Deploy nova-rewards
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/nova_rewards.wasm \
  --source deployer \
  --network testnet
```

Repeat for each contract. Record the returned contract IDs and update the tables above.

### Initialize After Deploy

Each contract requires a one-time `initialize` call:

```bash
# Initialize nova_token
stellar contract invoke \
  --id <NOVA_TOKEN_CONTRACT_ID> \
  --source deployer \
  --network testnet \
  -- initialize \
  --admin <ADMIN_ADDRESS>

# Initialize distribution (requires token address)
stellar contract invoke \
  --id <DISTRIBUTION_CONTRACT_ID> \
  --source deployer \
  --network testnet \
  -- initialize \
  --admin <ADMIN_ADDRESS> \
  --token_id <NOVA_TOKEN_CONTRACT_ID>
```

---

## Contract Dependencies

```
admin_roles          (standalone)
nova_token           (standalone)
reward_pool          (standalone)
vesting              (standalone)
referral             (standalone)
governance           (standalone)
distribution    ──►  nova_token  (calls transfer / transfer_from)
nova-rewards    ──►  DEX router  (calls swap_exact_in via set_swap_config)
```

---

## Upgrade Process

Contracts support in-place WASM upgrades via the two-step `upgrade` → `migrate` pattern:

```bash
# 1. Build new WASM
cargo build --release --target wasm32-unknown-unknown

# 2. Upload new WASM and get hash
stellar contract install \
  --wasm target/wasm32-unknown-unknown/release/nova_rewards.wasm \
  --source deployer \
  --network testnet

# 3. Trigger upgrade (admin only)
stellar contract invoke \
  --id <CONTRACT_ID> \
  --source admin \
  --network testnet \
  -- upgrade \
  --new_wasm_hash <WASM_HASH>

# 4. Run migration (admin only)
stellar contract invoke \
  --id <CONTRACT_ID> \
  --source admin \
  --network testnet \
  -- migrate
```

See [upgrade-guide.md](upgrade-guide.md) for full details.
