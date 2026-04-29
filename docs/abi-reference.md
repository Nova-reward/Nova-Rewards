# Nova Rewards — ABI Reference

> Auto-generated from `docs/abis/*.json`. Closes #566.

## Contracts

| Contract | Description |
|---|---|
| [nova_token](#nova_token) | Fungible NOVA token (mint, burn, transfer, allowance) |
| [nova_rewards](#nova_rewards) | Core contract: staking, swaps, recovery |
| [campaign](#campaign) | Reward campaign lifecycle |
| [reward_pool](#reward_pool) | Pooled token storage with Merkle claims |
| [governance](#governance) | On-chain voting and proposal execution |
| [vesting](#vesting) | Linear token vesting with cliff |
| [referral](#referral) | Referral registration and bonus crediting |
| [distribution](#distribution) | Batch token distribution with clawback |
| [redemption](#redemption) | On-chain redemption requests |
| [escrow](#escrow) | Time-locked conditional token release |
| [admin_roles](#admin_roles) | Multi-sig admin role management |

---

## nova_token

### Functions

| Function | Params | Returns | Description |
|---|---|---|---|
| `initialize` | `admin: Address` | — | Initialize. Panics if called twice. |
| `mint` | `to: Address, amount: i128` | — | Mint tokens. Admin only. |
| `burn` | `from: Address, amount: i128` | — | Burn tokens from balance. |
| `transfer` | `from, to: Address, amount: i128` | — | Transfer tokens. |
| `transfer_from` | `spender, from, to: Address, amount: i128` | — | Transfer via allowance. |
| `approve` | `owner, spender: Address, amount: i128` | — | Set allowance. |
| `increase_allowance` | `owner, spender: Address, amount: i128` | — | Increase allowance. |
| `decrease_allowance` | `owner, spender: Address, amount: i128` | — | Decrease allowance. |
| `balance_of` | `address: Address` | `i128` | Query balance. |
| `allowance` | `owner, spender: Address` | `i128` | Query allowance. |
| `admin` | — | `Address` | Returns admin address. |

### Error Codes

| Code | Name | Message |
|---|---|---|
| 1 | AlreadyInitialized | already initialized |
| 2 | Unauthorized | unauthorized |
| 3 | InsufficientBalance | insufficient balance |
| 4 | InsufficientAllowance | insufficient allowance |
| 5 | AmountMustBePositive | amount must be positive |

---

## nova_rewards

### Functions

| Function | Params | Returns | Description |
|---|---|---|---|
| `initialize` | `admin, recovery_admin: Address` | — | Initialize. |
| `stake` | `user: Address, amount: i128` | — | Stake NOVA for yield. |
| `unstake` | `user: Address` | — | Unstake and claim yield. |
| `get_stake` | `user: Address` | `StakeRecord` | Query stake. |
| `calculate_yield` | `user: Address` | `i128` | Preview accrued yield. |
| `set_annual_rate` | `rate_bps: u32` | — | Set yield rate (bps). Admin only. |
| `get_annual_rate` | — | `u32` | Query yield rate. |
| `swap_for_xlm` | `user: Address, nova_amount: i128, min_xlm_out: i128` | `i128` | Burn NOVA, receive XLM. |
| `pause` / `resume` | — | — | Emergency pause. Admin only. |
| `is_paused` | — | `bool` | Query pause state. |
| `upgrade` | `new_wasm_hash: BytesN<32>` | — | Upgrade WASM. Admin only. |
| `migrate` | — | — | Post-upgrade migration. Admin only. |
| `snapshot_account` | `account: Address` | — | Snapshot for recovery. Recovery admin only. |
| `restore_account` | `account: Address` | — | Restore from snapshot. Recovery admin only. |
| `recover_transaction` | `operation_id: BytesN<32>, kind: RecoveryKind, amount: i128` | — | Record recovery tx. |
| `recover_funds` | `from, to: Address, amount: i128` | — | Move funds in recovery. |

### Types

```
StakeRecord { amount: i128, staked_at: u64 }
RecoveryKind: FundsRecovery | TransactionRecovery | AccountRestore
```

### Error Codes

| Code | Name | Message |
|---|---|---|
| 1 | AlreadyInitialized | already initialized |
| 2 | Unauthorized | unauthorized |
| 3 | AlreadyStaked | already staked |
| 4 | NoActiveStake | no active stake |
| 5 | InsufficientBalance | insufficient balance |
| 6 | SlippageExceeded | slippage exceeded |
| 7 | Paused | contract is paused |
| 8 | AlreadyMigrated | already migrated |

---

## campaign

### Functions

| Function | Params | Returns | Description |
|---|---|---|---|
| `initialize` | `admin: Address` | — | Initialize. |
| `create_campaign` | `owner: Address, rewards: Vec<TokenReward>, max_participants: u32` | `u64` | Create campaign. Admin only. |
| `set_active` | `campaign_id: u64, active: bool` | — | Activate/deactivate. Owner only. |
| `join_campaign` | `user: Address, campaign_id: u64` | — | Join a campaign. |
| `distribute_reward` | `campaign_id: u64, recipient: Address` | — | Distribute rewards. Owner only. |
| `get_campaign` | `campaign_id: u64` | `CampaignData` | Query campaign. |
| `pause` / `unpause` | — | — | Pause controls. Admin only. |

### Types

```
TokenReward { token: Address, amount: i128 }
CampaignData { owner, rewards, active, completed, max_participants, current_participants }
```

---

## governance

### Functions

| Function | Params | Returns | Description |
|---|---|---|---|
| `initialize` | `admin: Address` | — | Initialize. |
| `create_proposal` | `proposer: Address, title: String, description: String` | `u32` | Create proposal. |
| `vote` | `voter: Address, proposal_id: u32, support: bool` | — | Cast vote. |
| `finalise` | `proposal_id: u32` | — | Tally after voting period. |
| `execute` | `proposal_id: u32` | — | Execute passed proposal. Admin only. |
| `get_proposal` | `proposal_id: u32` | `Proposal` | Query proposal. |
| `proposal_count` | — | `u32` | Total proposals. |
| `has_voted` | `voter: Address, proposal_id: u32` | `bool` | Check if voted. |

Voting period: **120,960 ledgers (~7 days)**. Quorum: **1 yes-vote**.

---

## vesting

### Functions

| Function | Params | Returns | Description |
|---|---|---|---|
| `initialize` | `admin, token: Address` | — | Initialize. |
| `fund_pool` | `from: Address, amount: i128` | — | Fund vesting pool. |
| `create_schedule` | `beneficiary: Address, amount: i128, cliff_seconds: u64, duration_seconds: u64` | `u32` | Create schedule. Admin only. |
| `release` | `beneficiary: Address, schedule_id: u32` | `i128` | Release vested tokens. |
| `vested_amount` | `beneficiary: Address, schedule_id: u32` | `i128` | Preview releasable amount. |
| `get_schedule` | `beneficiary: Address, schedule_id: u32` | `VestingSchedule` | Query schedule. |
| `pool_balance` | — | `i128` | Query pool balance. |

---

## referral

### Functions

| Function | Params | Returns | Description |
|---|---|---|---|
| `initialize` | `admin, token: Address` | — | Initialize. |
| `fund_pool` | `from: Address, amount: i128` | — | Fund referral pool. |
| `register_referral` | `new_user, referrer: Address` | — | Register referral. |
| `credit_referrer` | `referrer: Address, amount: i128` | — | Credit bonus. Admin only. |
| `get_referrer` | `user: Address` | `Option<Address>` | Query referrer. |
| `total_referrals` | `referrer: Address` | `u32` | Count referrals. |
| `pool_balance` | — | `i128` | Query pool balance. |

---

## distribution

### Functions

| Function | Params | Returns | Description |
|---|---|---|---|
| `initialize` | `admin, token: Address` | — | Initialize. |
| `distribute` | `recipient: Address, amount: i128` | — | Single distribution. Admin only. |
| `distribute_batch` | `recipients: Vec<Address>, amounts: Vec<i128>` | — | Batch distribution. Admin only. |
| `clawback` | `recipient: Address, amount: i128` | — | Clawback within window. Admin only. |
| `calculate_reward` | `base_amount: i128, rate_bps: u32` | `i128` | Calculate reward amount. |
| `get_distributed` | `recipient: Address` | `i128` | Total distributed to recipient. |
| `get_clawback_deadline` | — | `u32` | Clawback deadline ledger. |

---

## redemption

### Functions

| Function | Params | Returns | Description |
|---|---|---|---|
| `initialize` | `admin, token: Address` | — | Initialize. |
| `set_redemption_rate` | `rate: u32` | — | Set rate. Admin only. |
| `request` | `user: Address, amount: i128` | `u32` | Create redemption request. |
| `confirm` | `request_id: u32` | — | Confirm request. Admin only. |
| `cancel` | `user: Address, request_id: u32` | — | Cancel pending request. |
| `redeem` | `user: Address, amount: i128` | `RedemptionProof` | Burn and redeem. |
| `get_redemption_rate` | — | `u32` | Query rate. |
| `get_total_redemptions` | — | `u32` | Total redemption count. |

---

## escrow

### Functions

| Function | Params | Returns | Description |
|---|---|---|---|
| `initialize` | `admin: Address` | — | Initialize. |
| `create` | `depositor, beneficiary, token: Address, amount: i128, timeout_ledger: u32` | `u32` | Create escrow. |
| `fund` | `escrow_id: u32, from: Address` | — | Fund escrow. |
| `release` | `escrow_id: u32` | — | Release to beneficiary. Admin only. |
| `refund` | `escrow_id: u32, depositor: Address` | — | Refund after timeout. |
| `get` | `escrow_id: u32` | `Escrow` | Query escrow. |

---

## admin_roles

### Functions

| Function | Params | Returns | Description |
|---|---|---|---|
| `initialize` | `admin: Address, signers: Vec<Address>, threshold: u32` | — | Initialize. |
| `propose_admin` | `new_admin: Address` | — | Propose new admin. Current admin only. |
| `accept_admin` | `new_admin: Address` | — | Accept admin role. Proposed admin only. |
| `update_signers` | `signers: Vec<Address>` | — | Replace signer list. Admin only. |
| `update_threshold` | `threshold: u32` | — | Update multisig threshold. Admin only. |
| `mint` / `withdraw` / `update_rate` / `pause` | various | — | Privileged operations. Admin only. |
| `get_admin` | — | `Address` | Query admin. |
| `get_pending_admin` | — | `Option<Address>` | Query pending admin. |
| `get_signers` | — | `Vec<Address>` | Query signers. |
| `get_threshold` | — | `u32` | Query threshold. |

---

## TypeScript SDK

Install from the monorepo:

```bash
# From repo root
npm install packages/nova-contracts-sdk
```

Usage:

```typescript
import type { NovaTokenClient, CampaignClient, i128 } from '@nova-rewards/contracts-sdk';
import { ContractErrors, getErrorMessage } from '@nova-rewards/contracts-sdk';

// Error handling
try {
  await tokenClient.mint(recipient, 1_000_000n);
} catch (err: unknown) {
  const code = (err as { code?: number }).code;
  console.error(getErrorMessage(code ?? 0));
}
```

Full type definitions: [`packages/nova-contracts-sdk/src/index.ts`](../packages/nova-contracts-sdk/src/index.ts)
