# ABI Reference

Complete function signatures and event schemas for all Nova Rewards Soroban smart contracts.

All events follow the Soroban convention:

```
topics : (contract_namespace: Symbol, event_type: Symbol)
data   : tuple of relevant fields
```

Symbol keys use `symbol_short!` (≤ 9 ASCII chars). No sensitive data is ever included in event payloads.

---

## nova-rewards

**Crate:** `nova-rewards`  
**Purpose:** Core rewards contract — user balances, staking, cross-asset swaps, emergency recovery, and WASM upgrades.

### Functions

| Function | Signature | Auth | Description |
|----------|-----------|------|-------------|
| `initialize` | `(admin: Address)` | — | One-time setup; sets admin and migration state. |
| `pause` | `(procedure: Symbol)` | Admin | Pauses all state-changing operations. |
| `resume` | `()` | Admin | Resumes normal operations after recovery. |
| `emergency_pause` | `(duration_secs: u64)` | Admin | Pauses with auto-expiry after `duration_secs`. |
| `unpause` | `()` | Admin | Clears the pause flag immediately. |
| `is_paused` | `() → bool` | — | Returns current pause state. |
| `set_swap_config` | `(xlm_token: Address, router: Address)` | Admin | Configures XLM SAC and DEX router for swaps. |
| `set_recovery_admin` | `(recovery_admin: Address)` | Admin | Assigns a dedicated recovery operator. |
| `get_recovery_admin` | `() → Address` | — | Returns the recovery admin address. |
| `swap_for_xlm` | `(user: Address, nova_amount: i128, min_xlm_out: i128, path: Vec<Address>) → i128` | `user` | Burns Nova points and swaps for XLM. |
| `upgrade` | `(new_wasm_hash: BytesN<32>)` | Admin | Replaces contract WASM; increments migration version. |
| `migrate` | `()` | Admin | Applies data migrations for the pending version. |
| `set_balance` | `(user: Address, amount: i128)` | — | Test helper: writes balance directly. |
| `get_balance` | `(user: Address) → i128` | — | Returns user's Nova balance. |
| `get_migration_version` | `() → u32` | — | Returns target migration version. |
| `get_migrated_version` | `() → u32` | — | Returns last completed migration version. |
| `calc_payout` | `(balance: i128, rate: i128) → i128` | — | Fixed-point payout calculation helper. |
| `set_annual_rate` | `(rate: i128)` | Admin | Sets staking APY in basis points (0–10 000). |
| `get_annual_rate` | `() → i128` | — | Returns current annual staking rate. |
| `stake` | `(staker: Address, amount: i128)` | `staker` | Stakes Nova tokens to earn yield. |
| `unstake` | `(staker: Address) → i128` | `staker` | Unstakes and returns principal + yield. |
| `get_stake` | `(staker: Address) → Option<StakeRecord>` | — | Returns active stake record. |
| `calculate_yield` | `(staker: Address) → i128` | — | Computes accrued yield without unstaking. |
| `snapshot_account` | `(user: Address, operation_id: BytesN<32>) → AccountSnapshot` | Recovery Admin | Captures restorable state snapshot. |
| `get_account_snapshot` | `(user: Address) → Option<AccountSnapshot>` | — | Returns stored snapshot. |
| `restore_account` | `(user: Address, operation_id: BytesN<32>) → AccountSnapshot` | Recovery Admin | Restores snapshot (contract must be paused). |
| `recover_transaction` | `(user: Address, amount_delta: i128, operation_id: BytesN<32>) → i128` | Recovery Admin | Applies compensating balance delta (paused only). |
| `recover_funds` | `(from: Address, to: Address, amount: i128, operation_id: BytesN<32>)` | Recovery Admin | Moves funds between balances (paused only). |
| `get_recovery_operation` | `(operation_id: BytesN<32>) → Option<RecoveryOperation>` | — | Returns a recorded recovery operation. |

### Events

| Event | Topics | Data |
|-------|--------|------|
| Paused | `("paused",)` | `()` |
| Unpaused | `("unpaused",)` | `()` |
| Emergency pause | `("emrg_paus",)` | `expiry: u64` |
| Recovery operator set | `("recovery", "operator")` | `recovery_admin: Address` |
| Recovery paused | `("recovery", "paused")` | `(procedure: Symbol, timestamp: u64)` |
| Recovery resumed | `("recovery", "resumed")` | `timestamp: u64` |
| Swap | `("swap", user: Address)` | `(nova_amount: i128, xlm_received: i128, path: Vec<Address>)` |
| Upgraded | `("upgraded",)` | `(wasm_hash: BytesN<32>, migration_version: u32)` |
| Staked | `("staked", staker: Address)` | `(amount: i128, staked_at: u64)` |
| Unstaked | `("unstaked", staker: Address)` | `(principal: i128, yield_amount: i128, timestamp: u64)` |
| Snapshot | `("recovery", "snapshot")` | `(user: Address, balance: i128, captured_at: u64)` |
| Restore | `("recovery", "restore")` | `(user: Address, balance: i128, timestamp: u64)` |
| Recover TX | `("recovery", "tx")` | `(user: Address, amount_delta: i128, new_balance: i128)` |
| Recover funds | `("recovery", "funds")` | `(from: Address, to: Address, amount: i128)` |

---

## nova_token

**Crate:** `nova_token`  
**Purpose:** ERC20-like fungible token with mint, burn, transfer, and allowance support.

### Functions

| Function | Signature | Auth | Description |
|----------|-----------|------|-------------|
| `initialize` | `(admin: Address)` | — | One-time setup; sets the mint admin. |
| `mint` | `(to: Address, amount: i128)` | Admin | Mints new tokens to `to`. |
| `burn` | `(from: Address, amount: i128)` | `from` | Burns tokens from `from`'s balance. |
| `transfer` | `(from: Address, to: Address, amount: i128)` | `from` | Transfers tokens between accounts. |
| `transfer_from` | `(spender: Address, from: Address, to: Address, amount: i128)` | `spender` | Transfers using spender's allowance. |
| `approve` | `(owner: Address, spender: Address, amount: i128)` | `owner` | Sets allowance for `spender`. |
| `increase_allowance` | `(owner: Address, spender: Address, amount: i128)` | `owner` | Adds to existing allowance. |
| `decrease_allowance` | `(owner: Address, spender: Address, amount: i128)` | `owner` | Subtracts from existing allowance (saturates at 0). |
| `balance` | `(addr: Address) → i128` | — | Returns token balance. |
| `allowance` | `(owner: Address, spender: Address) → i128` | — | Returns remaining allowance. |

### Events

| Event | Topics | Data |
|-------|--------|------|
| Mint | `("nova_tok", "mint")` | `(to: Address, amount: i128)` |
| Burn | `("nova_tok", "burn")` | `(from: Address, amount: i128)` |
| Transfer | `("nova_tok", "transfer")` | `(from: Address, to: Address, amount: i128)` |
| Transfer From | `("nova_tok", "transfer_from")` | `(spender: Address, from: Address, to: Address, amount: i128)` |
| Approve | `("nova_tok", "approve")` | `(owner: Address, spender: Address, amount: i128)` |
| Increase Allowance | `("nova_tok", "inc_allow")` | `(owner: Address, spender: Address, new_allowance: i128)` |
| Decrease Allowance | `("nova_tok", "dec_allow")` | `(owner: Address, spender: Address, new_allowance: i128)` |

---

## governance

**Crate:** `governance`  
**Purpose:** On-chain governance for protocol parameter changes via proposal → vote → finalise → execute lifecycle.

### Functions

| Function | Signature | Auth | Description |
|----------|-----------|------|-------------|
| `initialize` | `(admin: Address)` | — | One-time setup; sets the execution admin. |
| `create_proposal` | `(proposer: Address, title: String, description: String) → u32` | `proposer` | Creates a new proposal; returns its id. |
| `vote` | `(voter: Address, proposal_id: u32, support: bool)` | `voter` | Casts a yes/no vote on an active proposal. |
| `finalise` | `(proposal_id: u32)` | — | Tallies votes after the voting period ends. |
| `execute` | `(proposal_id: u32)` | Admin | Marks a passed proposal as executed. |
| `get_proposal` | `(proposal_id: u32) → Proposal` | — | Returns the full proposal struct. |
| `proposal_count` | `() → u32` | — | Returns total number of proposals. |
| `has_voted` | `(proposal_id: u32, voter: Address) → bool` | — | Returns whether an address has voted. |

### Events

| Event | Topics | Data |
|-------|--------|------|
| Proposal created | `("gov", "proposed")` | `(id: u32, proposer: Address, title: String)` |
| Vote cast | `("gov", "voted")` | `(proposal_id: u32, voter: Address, support: bool)` |
| Finalised | `("gov", "finalised")` | `(proposal_id: u32, passed: bool)` |
| Executed | `("gov", "executed")` | `(proposal_id: u32, proposer: Address)` |

### Types

```rust
pub enum ProposalStatus { Active, Passed, Rejected, Executed }

pub struct Proposal {
    pub id: u32,
    pub proposer: Address,
    pub title: String,
    pub description: String,
    pub yes_votes: u32,
    pub no_votes: u32,
    pub end_ledger: u32,
    pub status: ProposalStatus,
}
```

---

## reward_pool

**Crate:** `reward_pool`  
**Purpose:** Shared liquidity pool with per-wallet daily withdrawal caps.

### Functions

| Function | Signature | Auth | Description |
|----------|-----------|------|-------------|
| `initialize` | `(admin: Address)` | — | One-time setup; sets admin and unlimited daily limit. |
| `deposit` | `(from: Address, amount: i128)` | `from` | Deposits tokens into the pool. |
| `withdraw` | `(to: Address, amount: i128)` | `to` | Withdraws tokens subject to daily limit. |
| `set_daily_limit` | `(limit: i128)` | Admin | Updates per-wallet daily withdrawal cap. |
| `get_balance` | `() → i128` | — | Returns total pool balance. |
| `get_daily_limit` | `() → i128` | — | Returns configured daily cap. |
| `get_daily_usage` | `(wallet: Address) → DailyUsage` | — | Returns wallet's 24-hour usage. |

### Events

| Event | Topics | Data |
|-------|--------|------|
| Deposited | `("rwd_pool", "deposited")` | `(from: Address, amount: i128)` |
| Withdrawn | `("rwd_pool", "withdrawn")` | `(to: Address, amount: i128)` |

### Types

```rust
pub struct DailyUsage {
    pub amount: i128,       // tokens withdrawn in current window
    pub window_start: u64,  // Unix timestamp of window start
}
```

---

## vesting

**Crate:** `vesting`  
**Purpose:** Linear token vesting with optional cliff periods.

### Functions

| Function | Signature | Auth | Description |
|----------|-----------|------|-------------|
| `initialize` | `(admin: Address)` | — | One-time setup; resets pool to 0. |
| `fund_pool` | `(amount: i128)` | Admin | Adds tokens to the vesting pool. |
| `create_schedule` | `(beneficiary: Address, total_amount: i128, start_time: u64, cliff_duration: u64, total_duration: u64) → u32` | Admin | Creates a vesting schedule; returns schedule id. |
| `release` | `(beneficiary: Address, schedule_id: u32) → i128` | — | Releases newly vested tokens to beneficiary. |
| `get_schedule` | `(beneficiary: Address, schedule_id: u32) → VestingSchedule` | — | Returns the stored schedule. |
| `pool_balance` | `() → i128` | — | Returns remaining pool balance. |

### Events

| Event | Topics | Data |
|-------|--------|------|
| Tokens released | `("vesting", "tok_rel")` | `(beneficiary: Address, amount: i128, timestamp: u64)` |

### Types

```rust
pub struct VestingSchedule {
    pub beneficiary: Address,
    pub total_amount: i128,
    pub start_time: u64,
    pub cliff_duration: u64,
    pub total_duration: u64,
    pub released: i128,
}
```

---

## referral

**Crate:** `referral`  
**Purpose:** One-time referral relationship tracking with reward pool payouts.

### Functions

| Function | Signature | Auth | Description |
|----------|-----------|------|-------------|
| `initialize` | `(admin: Address)` | — | One-time setup; resets pool to 0. |
| `fund_pool` | `(amount: i128)` | Admin | Adds tokens to the reward pool. |
| `register_referral` | `(referrer: Address, referred: Address)` | `referred` | Registers a one-time referral link. |
| `get_referrer` | `(referred: Address) → Option<Address>` | — | Returns the referrer for a wallet. |
| `credit_referrer` | `(referred: Address, reward_amount: i128)` | Admin | Pays reward from pool to referrer. |
| `total_referrals` | `(referrer: Address) → u32` | — | Returns referrer's total referral count. |
| `pool_balance` | `() → i128` | — | Returns remaining pool balance. |

### Events

| Event | Topics | Data |
|-------|--------|------|
| Referral registered | `("referral", "ref_reg")` | `(referrer: Address, referred: Address)` |
| Referrer credited | `("referral", "ref_cred")` | `(referrer: Address, referred: Address, amount: i128)` |

---

## distribution

**Crate:** `distribution`  
**Purpose:** Admin-controlled token distribution with batch support and 30-day clawback window.

### Functions

| Function | Signature | Auth | Description |
|----------|-----------|------|-------------|
| `initialize` | `(admin: Address, token_id: Address)` | — | One-time setup with Nova token address. |
| `calculate_reward` | `(base_amount: i128, rate_bps: i128) → i128` | — | Fixed-point reward calculation (rate in basis points). |
| `distribute` | `(recipient: Address, amount: i128)` | Admin | Distributes tokens to a single recipient. |
| `distribute_batch` | `(recipients: Vec<Address>, amounts: Vec<i128>)` | Admin | Distributes to up to 50 recipients in one call. |
| `clawback` | `(recipient: Address)` | Admin | Reclaims tokens within 30-day window. |
| `get_distributed` | `(recipient: Address) → i128` | — | Returns amount distributed to recipient. |
| `get_clawback_deadline` | `(recipient: Address) → u64` | — | Returns clawback deadline timestamp. |
| `contract_balance` | `() → i128` | — | Returns contract's Nova token balance. |

### Events

| Event | Topics | Data |
|-------|--------|------|
| Distributed | `("dist", recipient: Address)` | `(amount: i128, deadline: u64)` |
| Clawback | `("clawback", recipient: Address)` | `amount: i128` |

---

## admin_roles

**Crate:** `admin_roles`  
**Purpose:** Centralized access control with two-step admin transfer and multisig configuration.

### Functions

| Function | Signature | Auth | Description |
|----------|-----------|------|-------------|
| `initialize` | `(admin: Address, signers: Vec<Address>, threshold: u32)` | — | One-time setup with admin and multisig config. |
| `propose_admin` | `(new_admin: Address)` | Admin | Initiates two-step admin transfer. |
| `accept_admin` | `()` | Pending Admin | Completes the admin transfer. |
| `update_threshold` | `(threshold: u32)` | Admin | Updates multisig approval threshold. |
| `update_signers` | `(signers: Vec<Address>)` | Admin | Replaces the multisig signer set. |
| `mint` | `(_to: Address, _amount: i128)` | Admin | Privileged mint stub (admin-gated). |
| `withdraw` | `(_to: Address, _amount: i128)` | Admin | Privileged withdrawal stub (admin-gated). |
| `update_rate` | `(_rate: u32)` | Admin | Privileged rate update stub (admin-gated). |
| `pause` | `()` | Admin | Privileged pause stub (admin-gated). |
| `get_admin` | `() → Address` | — | Returns the active admin address. |
| `get_pending_admin` | `() → Option<Address>` | — | Returns pending admin if transfer is in progress. |
| `get_threshold` | `() → u32` | — | Returns multisig threshold (default: 1). |
| `get_signers` | `() → Vec<Address>` | — | Returns configured signer set. |

### Events

| Event | Topics | Data |
|-------|--------|------|
| Admin proposed | `("adm_roles", "adm_prop")` | `(current_admin: Address, proposed: Address)` |
| Admin transferred | `("adm_roles", "adm_xfer")` | `(old_admin: Address, new_admin: Address)` |

---

## Integration Examples

### JavaScript / TypeScript (Stellar SDK)

```typescript
import { Contract, SorobanRpc, TransactionBuilder, Networks, BASE_FEE } from "@stellar/stellar-sdk";

const server = new SorobanRpc.Server("https://soroban-testnet.stellar.org");

// Read a user's Nova balance
async function getBalance(contractId: string, userAddress: string) {
  const contract = new Contract(contractId);
  const tx = new TransactionBuilder(sourceAccount, {
    fee: BASE_FEE,
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(contract.call("get_balance", userAddress))
    .setTimeout(30)
    .build();

  const result = await server.simulateTransaction(tx);
  return result; // i128 balance
}

// Listen for distribution events
async function watchDistributionEvents(contractId: string) {
  const events = await server.getEvents({
    startLedger: 1000000,
    filters: [{
      type: "contract",
      contractIds: [contractId],
      topics: [["dist"]],
    }],
  });

  for (const event of events.events) {
    const [amount, deadline] = event.value.value();
    console.log(`Distributed ${amount} tokens, clawback deadline: ${deadline}`);
  }
}
```

### Stellar CLI

```bash
# Check pool balance
stellar contract invoke \
  --id <REWARD_POOL_CONTRACT_ID> \
  --network testnet \
  -- get_balance

# Register a referral
stellar contract invoke \
  --id <REFERRAL_CONTRACT_ID> \
  --source referred_wallet \
  --network testnet \
  -- register_referral \
  --referrer <REFERRER_ADDRESS> \
  --referred <REFERRED_ADDRESS>

# Create a governance proposal
stellar contract invoke \
  --id <GOVERNANCE_CONTRACT_ID> \
  --source proposer_wallet \
  --network testnet \
  -- create_proposal \
  --proposer <PROPOSER_ADDRESS> \
  --title "Increase reward rate" \
  --description "Raise base reward rate from 1% to 2%"
```
