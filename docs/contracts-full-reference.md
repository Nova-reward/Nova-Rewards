# Nova Rewards — Full Contract Reference

> Closes #387

This document is the authoritative reference for all Soroban smart contracts in the Nova Rewards platform. Each section covers: purpose, state variables, public functions, events, errors, usage examples, and security considerations.

---

## Table of Contents

1. [Shared Error Codes](#1-shared-error-codes)
2. [Nova Rewards Contract](#2-nova-rewards-contract)
3. [Nova Token Contract](#3-nova-token-contract)
4. [Campaign Contract](#4-campaign-contract)
5. [Governance Contract](#5-governance-contract)
6. [Vesting Contract](#6-vesting-contract)
7. [Referral Contract](#7-referral-contract)
8. [Distribution Contract](#8-distribution-contract)
9. [Reward Pool Contract](#9-reward-pool-contract)
10. [Escrow Contract](#10-escrow-contract)
11. [Redemption Contract](#11-redemption-contract)
12. [Admin Roles Contract](#12-admin-roles-contract)
13. [Contract State Contract](#13-contract-state-contract)
14. [Upgrade Guide](#14-upgrade-guide)

---

## 1. Shared Error Codes

**Source:** `contracts/errors/src/lib.rs`

The `ContractError` enum is shared across all contracts. Each variant maps to a `u32` code in the ABI so clients can match on numeric error codes.

| Code | Variant | Description |
|------|---------|-------------|
| 1 | `AlreadyInitialized` | Contract has already been initialized |
| 2 | `NotInitialized` | Contract has not been initialized yet |
| 3 | `Unauthorized` | Caller lacks required authorization |
| 4 | `InsufficientBalance` | Account balance too low |
| 5 | `InsufficientBudget` | Campaign budget exhausted |
| 6 | `CampaignNotFound` | No campaign with the given ID |
| 7 | `CampaignAlreadyExists` | Campaign ID already created |
| 8 | `CampaignExpired` | Campaign end ledger has passed |
| 9 | `CampaignNotActive` | Campaign is paused or ended |
| 10 | `CampaignAlreadyEnded` | Campaign permanently ended |
| 11 | `CampaignAlreadyPaused` | Campaign already paused |
| 12 | `CampaignNotPaused` | Resume called on non-paused campaign |
| 13 | `InvalidRewardAmount` | Reward amount must be > 0 |
| 14 | `InvalidBudget` | Max budget must be > 0 |
| 15 | `InvalidLedgerRange` | Start ledger must be before end ledger |
| 16 | `InvalidTokenAddress` | Token address is zero/invalid |
| 17 | `ContractPaused` | Contract-level pause is active |
| 18 | `AmountMustBePositive` | Numeric argument must be > 0 |
| 19 | `BatchTooLarge` | Batch exceeds maximum limit |
| 20 | `EmptyBatch` | Batch must contain at least one entry |
| 21 | `LengthMismatch` | Two parallel arrays have different lengths |
| 22 | `ClawbackWindowExpired` | 30-day clawback window has passed |
| 23 | `NoClawbackRecord` | No distribution record for recipient |
| 24 | `AlreadyVoted` | Address already voted on this proposal |
| 25 | `ProposalNotFound` | No proposal with the given ID |
| 26 | `ProposalNotActive` | Proposal not in Active state |
| 27 | `VotingPeriodEnded` | Voting window closed |
| 28 | `VotingPeriodNotEnded` | Finalise called before period ended |
| 29 | `ProposalNotPassed` | Execute called on non-passing proposal |
| 30 | `Overflow` | Arithmetic overflow detected |

---

## 2. Nova Rewards Contract

**Source:** `contracts/nova-rewards/src/lib.rs`

Core rewards contract. Manages user balances, staking with yield accrual, cross-asset swaps, emergency recovery, and WASM upgrades.

### State Variables

| Key | Type | Description |
|-----|------|-------------|
| `Admin` | `Address` | Admin authorized for all privileged operations |
| `RecoveryAdmin` | `Address` | Operator for emergency recovery (defaults to Admin) |
| `Balance(Address)` | `i128` | Per-user reward balance |
| `Stake(Address)` | `StakeRecord` | Active stake for a user |
| `AnnualRate` | `i128` | Staking APY in basis points (10000 = 100%) |
| `DailyLimit` | `i128` | Max withdrawal per user per 24h (0 = no limit) |
| `DailyUsage(Address)` | `DailyUsage` | Rolling 24h usage window per user |
| `Paused` | `bool` | Whether contract is paused |
| `EmergencyPauseExpiry` | `u64` | Timestamp for auto-unpause (0 = manual only) |
| `MigrationVersion` | `u32` | Target migration version set by `upgrade()` |
| `MigratedVersion` | `u32` | Last completed migration version |
| `NovaToken` | `Address` | Address of the Nova token contract |
| `XlmToken` | `Address` | Address of the XLM SAC token contract |
| `Router` | `Address` | DEX router for swap operations |
| `CooldownPeriod` | `u64` | Seconds required between stake and unstake |
| `Snapshot(Address)` | `AccountSnapshot` | Emergency account snapshot |

### Data Structures

```rust
struct StakeRecord { amount: i128, staked_at: u64, last_claimed_at: u64 }
struct AccountSnapshot { balance: i128, stake: Option<StakeRecord>, captured_at: u64 }
struct DailyUsage { amount_used: i128, window_start: u64 }
struct EventConfig { schema_version: u32 }
```

### Public Functions

#### `initialize(admin, nova_token, event_config)`
Sets up the contract for first use. Panics if already initialized or `event_config.schema_version == 0`.

#### `pause()` / `unpause()`
Admin-only. Blocks / unblocks all state-changing user operations.

#### `emergency_pause(duration_secs)`
Admin-only. Pauses with auto-expiry after `duration_secs`. Panics if `duration_secs == 0`.

#### `is_paused() → bool`
Returns current pause state, respecting auto-expiry.

#### `set_swap_config(xlm_token, router)`
Admin-only. Configures the XLM token and DEX router addresses for `swap_for_xlm`.

#### `set_recovery_admin(recovery_admin)`
Admin-only. Assigns a dedicated recovery operator.

#### `set_annual_rate(rate_bps)`
Admin-only. Sets staking APY in basis points.

#### `set_balance(user, amount)`
Admin-only. Directly sets a user's reward balance.

#### `set_daily_limit(limit)`
Admin-only. Sets the per-user daily withdrawal cap (0 = unlimited).

#### `set_cooldown_period(seconds)`
Admin-only. Sets minimum seconds between stake and unstake.

#### `get_balance(user) → i128`
Returns the user's current reward balance.

#### `stake(staker, amount)`
Requires `staker` auth. Moves `amount` from balance into a `StakeRecord`. Panics if balance insufficient.

#### `unstake(staker) → i128`
Requires `staker` auth. Returns principal + accrued yield. Enforces cooldown period.

#### `claim_staking_reward(staker) → i128`
Requires `staker` auth. Claims yield without touching principal. Resets `last_claimed_at`.

#### `swap_for_xlm(user, nova_amount, min_xlm_out, path)`
Requires `user` auth. Burns Nova tokens and swaps for XLM via the DEX router. Enforces daily limit. Panics if swap config not set.

#### `snapshot_account(account)`
Recovery admin only. Saves the current balance + stake of `account`.

#### `restore_account(account)`
Recovery admin only. Restores balance + stake from the saved snapshot.

#### `upgrade(new_wasm_hash)`
Admin-only. Sets pending WASM hash and increments `MigrationVersion`.

#### `migrate()`
Admin-only. Runs the migration logic for the pending version then increments `MigratedVersion`. Safe to call exactly once per upgrade cycle.

### Events

| Topics | Data | Trigger |
|--------|------|---------|
| `("nova_rwd", "init")` | `(admin, nova_token, schema_version)` | `initialize` |
| `("nova_rwd", "paused")` | `(procedure, timestamp)` | `pause` / `pause_for_recovery` |
| `("nova_rwd", "resumed")` | `timestamp` | `unpause` / `resume` |
| `("nova_rwd", "emrg_ps")` | `expiry_timestamp` | `emergency_pause` |
| `("nova_rwd", "staked")` | `(staker, amount, timestamp)` | `stake` |
| `("nova_rwd", "unstaked")` | `(staker, amount, yield, timestamp)` | `unstake` |
| `("claimed", staker)` | `(reward, timestamp)` | `claim_staking_reward` |
| `("nova_rwd", "swapped")` | `(user, nova_in, xlm_out)` | `swap_for_xlm` |
| `("recovery", "snapshot")` | `(account, balance, timestamp)` | `snapshot_account` |
| `("recovery", "restored")` | `(account, balance, timestamp)` | `restore_account` |
| `("recovery", "operator")` | `recovery_admin` | `set_recovery_admin` |
| `("nova_rwd", "upgraded")` | `new_wasm_hash` | `upgrade` |

### Usage Example

```rust
client.initialize(&admin, &nova_token_addr, &EventConfig { schema_version: 1 });
client.set_annual_rate(&500); // 5% APY
client.set_balance(&user, &10_000);
client.stake(&user, &5_000);
// time passes …
let reward = client.claim_staking_reward(&user);
let total = client.unstake(&user); // principal + accrued yield
```

### Security Considerations

- All admin functions require `admin.require_auth()` — never callable by arbitrary addresses.
- `swap_for_xlm` enforces a per-user daily limit to prevent balance draining.
- `emergency_pause` with auto-expiry ensures the contract cannot be frozen indefinitely.
- `snapshot_account` / `restore_account` are gated to `RecoveryAdmin` to limit the blast radius of recovery operations.
- Arithmetic uses `checked_mul` / `checked_div` throughout to panic on overflow rather than silently wrap.

---

## 3. Nova Token Contract

**Source:** `contracts/nova_token/src/lib.rs`

ERC-20-like fungible token on Soroban. Supports mint, burn, transfer, and approve/allowance with expiration.

### State Variables

| Key | Type | Description |
|-----|------|-------------|
| `Admin` | `Address` | Address authorized to call `mint` |
| `Initialized` | `bool` | Guards against double initialization |
| `Balance(Address)` | `i128` | Per-wallet token balance (persistent, 31-day TTL) |
| `Allowance(Address, Address)` | `AllowanceValue` | Approved spend amount + expiration ledger |

```rust
struct AllowanceValue { amount: i128, expiration_ledger: u32 }
```

### Public Functions

| Function | Auth | Description |
|----------|------|-------------|
| `initialize(admin)` | — | One-time setup. Panics `"already initialized"` if repeated. |
| `mint(to, amount)` | Admin | Credits `amount` to `to`. Panics if `amount <= 0`. |
| `burn(from, amount)` | `from` | Debits `amount` from `from`. Panics if balance insufficient. |
| `transfer(from, to, amount)` | `from` | Moves `amount` between accounts. |
| `approve(owner, spender, amount, expiration_ledger)` | `owner` | Sets allowance. Expired allowances treated as zero. |
| `transfer_from(spender, from, to, amount)` | `spender` | Uses allowance to transfer. Deducts from allowance. |
| `balance(addr) → i128` | — | Returns current balance. Extends persistent TTL. |
| `allowance(owner, spender) → i128` | — | Returns approved amount (0 if expired). |

### Events

| Topics | Data | Trigger |
|--------|------|---------|
| `("nova_tok", "mint")` | `(to, amount)` | `mint` |
| `("nova_tok", "burn")` | `(from, amount)` | `burn` |
| `("nova_tok", "transfer")` | `(from, to, amount)` | `transfer` / `transfer_from` |
| `("nova_tok", "approve")` | `(owner, spender, amount, expiration_ledger)` | `approve` |

### Usage Example

```rust
client.initialize(&admin);
client.mint(&user, &1_000_000);
client.approve(&user, &spender, &200_000, &expiration_ledger);
client.transfer_from(&spender, &user, &recipient, &100_000);
```

### Security Considerations

- Allowances include `expiration_ledger`: expired approvals are automatically treated as zero — delegated spenders lose access without an explicit revoke call.
- Persistent storage TTL is extended on every read/write so balances do not evict unexpectedly.
- `transfer_from` deducts from the allowance atomically; partial fills are supported.

---

## 4. Campaign Contract

**Source:** `contracts/campaign/src/lib.rs`

Multi-token reward campaigns with participant management and M-of-N multisig upgrades.

### State Variables

| Key | Type | Description |
|-----|------|-------------|
| `Admin` | `Address` | Contract admin |
| `Campaign(u64)` | `Campaign` | Campaign record keyed by ID |
| `Participants(u64)` | `Vec<Address>` | Participant list per campaign |
| `Joined(u64, Address)` | `bool` | Whether an address joined a campaign |
| `Paused` | `bool` | Global pause flag |
| `Signers` | `Vec<Address>` | Multisig signers for upgrade |
| `Threshold` | `u32` | Min approvals required |
| `UpgradeApprovals(BytesN<32>)` | `Vec<Address>` | Collected approvals per WASM hash |

```rust
struct Campaign {
  owner: Address, token: Address, reward_per_action: i128,
  start_ledger: u32, end_ledger: u32,
  max_budget: i128, spent_budget: i128, status: CampaignStatus
}
enum CampaignStatus { Active, Paused, Ended }
```

### Public Functions

| Function | Auth | Description |
|----------|------|-------------|
| `initialize(admin)` | — | One-time setup |
| `create_campaign(id, owner, token, reward_per_action, start_ledger, end_ledger, max_budget)` | Admin | Creates a new campaign. Panics if ID already exists or ledger range invalid. |
| `activate_campaign(id)` | Owner | Sets status to Active |
| `deactivate_campaign(id)` | Owner | Sets status to Paused |
| `end_campaign(id)` | Owner | Permanently ends campaign |
| `join_campaign(id, participant)` | `participant` | Registers participant. Rejects if campaign inactive/expired or already joined. |
| `issue_reward(id, participant)` | Admin | Deducts `reward_per_action` from budget and credits participant. |
| `pause()` / `unpause()` | Admin | Global contract pause |
| `approve_upgrade(new_wasm_hash)` | Signer | Collects multisig approval; executes upgrade at threshold |

### Events

| Topics | Data |
|--------|------|
| `("camp", "created")` | `(schema_v, id, owner, reward_count, max_participants)` |
| `("camp", "activated")` | `(schema_v, id, owner)` |
| `("camp", "deactivated")` | `(schema_v, id, owner)` |
| `("camp", "joined")` | `(schema_v, id, participant)` |
| `("camp", "reward_issued")` | `(schema_v, id, participant, reward_count)` |
| `("camp", "paused")` | `(schema_v, admin)` |
| `("camp", "unpaused")` | `(schema_v, admin)` |
| `("camp", "upgraded")` | `(schema_v, new_wasm_hash)` |

### Usage Example

```rust
client.initialize(&admin);
client.create_campaign(&1, &merchant, &token_addr, &100, &start, &end, &50_000);
client.activate_campaign(&1);
client.join_campaign(&1, &user);
client.issue_reward(&1, &user); // credits 100 tokens to user
```

### Security Considerations

- `max_budget` is enforced at reward issuance; `InsufficientBudget` prevents over-spend.
- `Joined(id, address)` prevents double-join and double-reward attacks.
- Campaign expiry (`end_ledger`) is checked before any participant action.
- Upgrades require M-of-N signatures from the configured signer set.

---

## 5. Governance Contract

**Source:** `contracts/governance/src/lib.rs`

On-chain governance for protocol parameter changes. Token holders propose and vote; admin executes passed proposals.

### Constants

| Name | Value | Description |
|------|-------|-------------|
| `VOTING_PERIOD` | `120_960 ledgers` | ~7 days at 5 s/ledger |
| `QUORUM` | `1` | Minimum yes-votes to pass |

### State Variables

| Key | Type | Description |
|-----|------|-------------|
| `Admin` | `Address` | Contract admin |
| `ProposalCount` | `u32` | Auto-incrementing proposal ID |
| `Proposal(u32)` | `Proposal` | Full proposal record |
| `HasVoted(u32, Address)` | `bool` | Whether address voted on proposal |
| `Signers` | `Vec<Address>` | Upgrade multisig signers |
| `Threshold` | `u32` | Min approvals for upgrade |
| `UpgradeApprovals(BytesN<32>)` | `Vec<Address>` | Per-hash approval list |

```rust
struct Proposal {
  id: u32, proposer: Address, title: String, description: String,
  yes_votes: u32, no_votes: u32, end_ledger: u32, status: ProposalStatus
}
enum ProposalStatus { Active, Passed, Rejected, Executed }
```

### Public Functions

| Function | Auth | Description |
|----------|------|-------------|
| `initialize(admin)` | — | One-time setup |
| `create_proposal(proposer, title, description)` | `proposer` | Opens vote; sets `end_ledger = current + VOTING_PERIOD` |
| `vote(voter, proposal_id, support)` | `voter` | Casts yes/no vote. Panics if period ended or already voted. |
| `finalise(proposal_id)` | Anyone | Tallies votes after period. Sets Passed/Rejected. |
| `execute(proposal_id)` | Admin | Marks passed proposal as Executed |
| `approve_upgrade(new_wasm_hash)` | Signer | Collects upgrade approval; executes at threshold |

### Events

| Topics | Data |
|--------|------|
| `("gov", "proposed")` | `(schema_v, id, proposer, title)` |
| `("gov", "voted")` | `(schema_v, proposal_id, voter, support)` |
| `("gov", "finalised")` | `(schema_v, proposal_id, passed)` |
| `("gov", "executed")` | `(schema_v, proposal_id, proposer)` |
| `("gov", "upgraded")` | `(schema_v, new_wasm_hash)` |

### Usage Example

```rust
client.initialize(&admin);
let id = client.create_proposal(&proposer, &title, &description);
client.vote(&voter_a, &id, &true);
client.vote(&voter_b, &id, &true);
// after VOTING_PERIOD ledgers:
client.finalise(&id);
client.execute(&id);
```

### Security Considerations

- `HasVoted` prevents double-voting per address per proposal.
- `finalise` is callable by anyone — reduces centralization risk.
- `execute` is admin-gated to prevent immediate execution without admin review.
- Upgrade mechanism requires M-of-N signers configured at initialization.

---

## 6. Vesting Contract

**Source:** `contracts/vesting/src/lib.rs`

Linear token vesting with optional cliff periods and admin revocation.

### Vesting Formula

- Before `start_time + cliff_duration`: 0 tokens vested.
- During vesting window: `total_amount * elapsed / total_duration` (linear).
- After `start_time + total_duration`: 100% vested.
- After revocation: vesting stops at revocation timestamp; already-vested amount claimable.

### State Variables

| Key | Type | Description |
|-----|------|-------------|
| `Admin` | `Address` | Contract admin |
| `Initialized` | `bool` | Initialization guard |
| `PoolBalance` | `i128` | Tokens available for vesting payouts |
| `Schedule(Address, u32)` | `VestingSchedule` | Schedule keyed by (beneficiary, id) |
| `NextId(Address)` | `u32` | Next schedule ID per beneficiary |

```rust
struct VestingSchedule {
  beneficiary: Address, total_amount: i128,
  start_time: u64, cliff_duration: u64, total_duration: u64,
  released: i128, revoked: bool, revoked_amount: i128
}
```

### Contract-Local Errors

| Code | Variant | Description |
|------|---------|-------------|
| 1 | `AlreadyInitialized` | Called initialize twice |
| 2 | `ScheduleRevoked` | Claim attempted on revoked schedule |

### Public Functions

| Function | Auth | Description |
|----------|------|-------------|
| `initialize(admin)` | — | One-time setup |
| `fund_pool(amount)` | Admin | Deposits tokens into the vesting pool |
| `create_schedule(beneficiary, total_amount, start_time, cliff_duration, total_duration)` | Admin | Creates a new vesting schedule; returns schedule ID |
| `claim_vested(beneficiary, schedule_id) → i128` | `beneficiary` | Transfers vested-but-unclaimed tokens to beneficiary |
| `revoke(beneficiary, schedule_id) → i128` | Admin | Stops vesting, returns unvested tokens to pool |
| `vested_amount(beneficiary, schedule_id) → i128` | — | Read-only view of total vested so far |

### Events

| Topics | Data |
|--------|------|
| `("vest", "funded")` | `(admin, amount)` |
| `("vest", "created")` | `(beneficiary, schedule_id, total_amount)` |
| `("vest", "claimed")` | `(beneficiary, schedule_id, amount)` |
| `("vest", "revoked")` | `(beneficiary, schedule_id, returned_amount)` |

### Usage Example

```rust
client.initialize(&admin);
client.fund_pool(&1_000_000);
let id = client.create_schedule(&beneficiary, &100_000, &start, &cliff, &duration);
// time passes …
let claimed = client.claim_vested(&beneficiary, &id);
// admin revokes remaining unvested:
let returned = client.revoke(&beneficiary, &id);
```

### Security Considerations

- `PoolBalance` is checked before `create_schedule` to ensure funds cover the allocation.
- `revoked` flag prevents claiming after revocation; already-vested amount is still claimable.
- `claim_vested` is idempotent: calling it twice for the same window returns 0 the second time.

---

## 7. Referral Contract

**Source:** `contracts/referral/src/lib.rs`

Tracks one-time referral relationships and distributes rewards to both referrer and referee upon successful onboarding.

### State Variables

| Key | Type | Description |
|-----|------|-------------|
| `Admin` | `Address` | Contract admin |
| `Initialized` | `bool` | Initialization guard |
| `Referral(Address)` | `Address` | referee → referrer mapping |
| `TotalReferrals(Address)` | `u32` | Successful referral count per referrer |
| `RewardClaimed(Address)` | `bool` | Whether reward was claimed for a referee |
| `PoolBalance` | `i128` | Internal reward budget |

All storage uses 31-day persistent TTL (`PERSISTENT_TTL = 2_678_400` ledgers).

### Contract-Local Errors

| Code | Variant | Description |
|------|---------|-------------|
| 1 | `SelfReferralNotAllowed` | Referrer and referee are the same address |
| 2 | `AlreadyReferred` | Referee already has a registered referrer |
| 3 | `AlreadyRewarded` | Referral reward already claimed for this referee |
| 4 | `ReferrerNotFound` | No referrer registered for the referee |
| 5 | `InsufficientPool` | Reward pool does not hold enough tokens |

### Public Functions

| Function | Auth | Description |
|----------|------|-------------|
| `initialize(admin)` | — | One-time setup |
| `fund_pool(amount)` | Admin | Seeds the reward budget |
| `register_referral(referrer, referee)` | `referee` | Records the referral relationship on-chain |
| `claim_referral_reward(referee, referrer_reward, referee_reward)` | Admin | Distributes rewards to both parties after onboarding |
| `get_referrer(referee) → Address` | — | Returns the registered referrer for a referee |
| `get_total_referrals(referrer) → u32` | — | Returns successful referral count |

### Events

| Topics | Data |
|--------|------|
| `("ref", "registered")` | `(referrer, referee)` |
| `("ref", "rewarded")` | `(referee, referrer, referrer_reward, referee_reward)` |
| `("ref", "funded")` | `(admin, amount)` |

### Usage Example

```rust
client.initialize(&admin);
client.fund_pool(&20_000);
client.register_referral(&referrer, &referee);
// referee completes onboarding off-chain …
client.claim_referral_reward(&referee, &500, &500);
```

### Security Considerations

- Self-referral is rejected at the contract level.
- Each referee can have exactly one referrer — prevents farming via re-registration.
- `RewardClaimed` flag ensures each referral is paid out at most once.
- `PoolBalance` is checked before any payout to prevent under-funded distribution.

---

## 8. Distribution Contract

**Source:** `contracts/distribution/src/lib.rs`

Merchant-controlled reward distribution with batch support (up to 50 recipients), fixed-point reward calculation, and a 30-day clawback window.

### State Variables

| Key | Type | Description |
|-----|------|-------------|
| `Admin` | `Address` | Contract admin |
| `TokenId` | `Address` | SEP-41 token used for distributions |
| `ClawbackDeadline(Address)` | `u64` | Ledger timestamp after which clawback is blocked |
| `Distributed(Address)` | `i128` | Amount originally distributed to recipient |
| `Signers` | `Vec<Address>` | Multisig upgrade signers |
| `Threshold` | `u32` | Min approvals for upgrade |
| `UpgradeApprovals(BytesN<32>)` | `Vec<Address>` | Per-hash upgrade approvals |

Persistent storage TTL: `CAMPAIGN_TTL = 535_680` ledgers (~31 days).

### Contract-Local Errors

| Code | Variant | Description |
|------|---------|-------------|
| 1 | `AlreadyInitialized` | Called initialize twice |
| 2 | `Unauthorized` | Not the contract admin |
| 3 | `NotCampaignMerchant` | Caller is not the campaign's registered merchant |
| 4 | `CampaignAlreadyExists` | Campaign ID already registered |
| 5 | `CampaignNotFound` | Campaign ID not found |
| 6 | `CampaignInactive` | Campaign not in active state |
| 7 | `InvalidAmount` | Reward amount must be positive |
| 8 | `InvalidBatchSize` | Batch is empty or exceeds 50 recipients |
| 9 | `BatchLengthMismatch` | `recipients` and `amounts` arrays differ in length |
| 10 | `InsufficientBalance` | Contract holds insufficient tokens |
| 11 | `NotInitialized` | Contract not yet initialized |
| 12 | `Ineligible` | Recipient has not met minimum action count |

### Public Functions

| Function | Auth | Description |
|----------|------|-------------|
| `initialize(admin, token)` | — | One-time setup with token address |
| `distribute(recipient, amount)` | Admin | Distributes tokens to one recipient; records clawback deadline |
| `batch_distribute(recipients, amounts)` | Admin | Distributes to up to 50 recipients in one call |
| `clawback(recipient)` | Admin | Recovers distributed tokens within 30-day window |
| `calculate_reward(base_amount, rate_bps) → i128` | — | Fixed-point reward calculation (basis points) |
| `approve_upgrade(new_wasm_hash)` | Signer | Collects multisig upgrade approval |

### Events

| Topics | Data |
|--------|------|
| `("dist", "distributed")` | `(schema_v, recipient, amount, deadline)` |
| `("dist", "batch_dist")` | `(schema_v, count, total_amount)` |
| `("dist", "clawback")` | `(schema_v, recipient, amount)` |
| `("dist", "upgraded")` | `(schema_v, new_wasm_hash)` |

### Usage Example

```rust
client.initialize(&admin, &token_addr);
client.distribute(&user, &1_000);
// within 30 days if needed:
client.clawback(&user);
// batch:
client.batch_distribute(&vec![user_a, user_b], &vec![500, 500]);
```

### Security Considerations

- Batch size capped at 50 to prevent compute-limit DoS attacks.
- 30-day clawback window provides a correction mechanism for erroneous distributions.
- `ClawbackWindowExpired` (error 22) is returned if clawback is attempted after the window.
- Fixed-point arithmetic in `calculate_reward` prevents rounding errors from accumulating.

---

## 9. Reward Pool Contract

**Source:** `contracts/reward_pool/src/lib.rs`

Shared liquidity pool. Merchants deposit; users withdraw subject to a configurable daily cap.

### State Variables

| Key | Type | Description |
|-----|------|-------------|
| `Admin` | `Address` | Contract admin |
| `NovaToken` | `Address` | Nova token contract address |
| `LockedUntil` | `u64` | Timestamp before which withdrawals are blocked |

### Contract-Local Errors

| Code | Variant | Description |
|------|---------|-------------|
| 1 | `PoolLocked` | Withdrawals blocked until `LockedUntil` timestamp |
| 2 | `InsufficientBalance` | Pool holds less than requested amount |
| 3 | `Unauthorized` | Caller is not the admin |

### Public Functions

| Function | Auth | Description |
|----------|------|-------------|
| `initialize(admin, nova_token)` | — | One-time setup |
| `deposit(merchant, amount)` | `merchant` | Deposits tokens into the pool |
| `withdraw(user, amount)` | `user` | Withdraws tokens, subject to daily limit and lock |
| `set_daily_limit(limit)` | Admin | Sets per-wallet daily withdrawal cap |
| `lock_pool(until_timestamp)` | Admin | Blocks all withdrawals until given timestamp |
| `unlock_pool()` | Admin | Clears the lock immediately |
| `get_balance() → i128` | — | Returns current pool balance |

### Events

| Topics | Data |
|--------|------|
| `("pool", "deposit")` | `(merchant, amount)` |
| `("pool", "withdraw")` | `(user, amount)` |
| `("pool", "locked")` | `until_timestamp` |
| `("pool", "unlocked")` | `timestamp` |

### Security Considerations

- `PoolLocked` prevents withdrawals during emergency or maintenance windows.
- Daily limit prevents a single wallet from draining the pool.

---

## 10. Escrow Contract

**Source:** `contracts/escrow/src/lib.rs`

Holds funds until release conditions are met. Supports multi-sig release and timeout-based refund.

### State Variables

| Key | Type | Description |
|-----|------|-------------|
| `Admin` | `Address` | Contract admin |
| `NextId` | `u32` | Auto-incrementing escrow ID |
| `Escrow(u32)` | `Escrow` | Escrow record by ID |
| `Signers` | `Vec<Address>` | Upgrade multisig signers |
| `Threshold` | `u32` | Min approvals for upgrade |
| `UpgradeApprovals(BytesN<32>)` | `Vec<Address>` | Per-hash upgrade approvals |

```rust
struct Escrow {
  depositor: Address, beneficiary: Address,
  timeout: u64, amount: i128, status: EscrowStatus
}
enum EscrowStatus { Open, Released, Refunded }
```

Storage TTL: `TTL = 31_536_000` (1 year in ledgers).

### Public Functions

| Function | Auth | Description |
|----------|------|-------------|
| `initialize(admin, signers, threshold)` | — | One-time setup |
| `create(depositor, beneficiary, timeout) → u32` | `depositor` | Opens a new escrow; returns ID |
| `fund(escrow_id, amount)` | `depositor` | Adds tokens to the escrow |
| `release(escrow_id)` | Both parties or admin after timeout | Releases funds to beneficiary |
| `refund(escrow_id)` | `depositor` after timeout | Returns funds to depositor |
| `approve_upgrade(new_wasm_hash)` | Signer | Collects multisig upgrade approval |

### Events

| Topics | Data |
|--------|------|
| `("escrow", "created")` | `(schema_v, id, depositor, beneficiary, timeout)` |
| `("escrow", "funded")` | `(schema_v, id, amount)` |
| `("escrow", "released")` | `(schema_v, id, beneficiary, amount)` |
| `("escrow", "refunded")` | `(schema_v, id, depositor, amount)` |
| `("escrow", "upgraded")` | `(schema_v, new_wasm_hash)` |

### Security Considerations

- Release requires authorization from both depositor and beneficiary, or admin after timeout.
- `timeout` prevents funds being locked forever if one party disappears.
- `EscrowStatus` prevents double-release or double-refund.

---

## 11. Redemption Contract

**Source:** `contracts/redemption/src/lib.rs`

Issues, tracks, and processes NOVA token redemption requests with per-campaign expiry windows.

### State Variables

| Key | Type | Description |
|-----|------|-------------|
| `Admin` | `Address` | Contract admin |
| `CampaignExpiry(u64)` | `u32` | Ledger offset for expiry per campaign |
| `Reward(u64, Address)` | `RewardRecord` | Per-(campaign, user) reward record |

```rust
struct RewardRecord { amount: i128, expiration_ledger: u32, redeemed: bool }
```

Persistent storage TTL: `PERSISTENT_TTL = 2_678_400` ledgers.

### Contract-Local Errors

| Code | Variant | Description |
|------|---------|-------------|
| 1 | `RewardExpired` | Reward past expiration ledger |
| 2 | `RewardNotFound` | No reward issued to this user for this campaign |
| 3 | `AlreadyRedeemed` | Reward already redeemed |
| 4 | `RewardNotExpired` | Reclaim attempted before expiry |

### Public Functions

| Function | Auth | Description |
|----------|------|-------------|
| `initialize(admin)` | — | One-time setup |
| `set_campaign_expiry(campaign_id, offset)` | Admin | Configures expiry window in ledgers |
| `issue_reward(campaign_id, user, amount)` | Admin | Issues tokens to user; records expiration |
| `redeem(campaign_id, user)` | `user` | Burns reward record and transfers tokens |
| `reclaim_expired(campaign_id, user)` | Admin | Sweeps expired unclaimed rewards back to pool |

### Events

| Topics | Data |
|--------|------|
| `("redeem", "issued")` | `(campaign_id, user, amount, expiration_ledger)` |
| `("redeem", "redeemed")` | `(campaign_id, user, amount)` |
| `("redeem", "expired")` | `(campaign_id, user, amount)` |
| `("redeem", "reclaimed")` | `(campaign_id, user, amount)` |

### Usage Example

```rust
client.initialize(&admin);
client.set_campaign_expiry(&campaign_id, &50_000);
client.issue_reward(&campaign_id, &user, &1_000);
// before expiry:
client.redeem(&campaign_id, &user);
// or after expiry:
client.reclaim_expired(&campaign_id, &user);
```

### Security Considerations

- `AlreadyRedeemed` flag prevents double-spend.
- Expiry ledger is set at issuance time and cannot be extended by the user.
- `reclaim_expired` is admin-only to prevent user-initiated reward removal.

---

## 12. Admin Roles Contract

**Source:** `contracts/admin_roles/src/lib.rs`

Role-based access control (RBAC) with two-step admin transfer and multisig upgrade.

### Roles

| Variant | Description |
|---------|-------------|
| `Admin` | Full access to all admin operations |
| `Merchant` | Access to merchant-scoped operations |
| `Operator` | Access to operational (non-financial) operations |

### State Variables

| Key | Type | Description |
|-----|------|-------------|
| `Owner` | `Address` | Current admin/owner |
| `PendingOwner` | `Address` | Proposed new admin (two-step transfer) |
| `Signers` | `Vec<Address>` | Multisig signers for upgrade |
| `Threshold` | `u32` | Min approvals for upgrade |
| `Initialized` | `bool` | Initialization guard |
| `UpgradeApprovals(BytesN<32>)` | `Vec<Address>` | Per-hash upgrade approvals |

### Contract-Local Errors

| Code | Variant | Description |
|------|---------|-------------|
| 1 | `AlreadyInitialized` | Called initialize twice |
| 2 | `NotInitialized` | Contract not initialized |
| 3 | `Unauthorized` | Caller is not the owner |
| 4 | `NoPendingAdmin` | `accept_admin` called with no pending transfer |

### Public Functions

| Function | Auth | Description |
|----------|------|-------------|
| `initialize(admin, signers, threshold)` | — | One-time setup |
| `propose_admin(proposed)` | Owner | Starts two-step admin transfer |
| `accept_admin()` | `PendingOwner` | Completes transfer; clears pending |
| `grant_role(target, role)` | Owner | Grants a role to a target address |
| `revoke_role(target, role)` | Owner | Revokes a role from a target address |
| `has_role(target, role) → bool` | — | Checks if address holds a role |
| `approve_upgrade(new_wasm_hash)` | Signer | Collects upgrade approval; executes at threshold |

### Events

| Topics | Data |
|--------|------|
| `("adm_roles", "adm_prop")` | `(schema_v, current_admin, proposed)` |
| `("adm_roles", "adm_xfer")` | `(schema_v, old_admin, new_admin)` |
| `("adm_roles", "role_chg")` | `(schema_v, admin, operation, target)` |
| `("adm_roles", "upgraded")` | `(schema_v, new_wasm_hash)` |

### Security Considerations

- Two-step transfer prevents accidental ownership loss to a wrong address.
- `NoPendingAdmin` guard prevents spurious `accept_admin` calls.
- Role grants/revokes are logged via event for auditability.

---

## 13. Contract State Contract

**Source:** `contracts/contract_state/src/lib.rs`

Shared state management utilities used across contracts for version tracking, pause state, and storage TTL management.

### Purpose

Provides a common pattern for:
- Tracking `initialized` flag to guard one-time setup.
- Reading and writing `paused` state.
- Managing persistent storage TTL extensions.
- Versioning contract migrations.

This contract is used as a library crate (`no_std`) by other contracts — it is not independently deployable.

---

## 14. Upgrade Guide

All contracts that support upgrades use one of two patterns:

### Pattern A — Two-Step Admin Upgrade (nova-rewards)

Used by `nova-rewards`. Separates the WASM swap from data migration.

**Storage keys involved:**

| Key | Description |
|-----|-------------|
| `MigrationVersion` | Target version — incremented by `upgrade()` |
| `MigratedVersion` | Last completed migration — incremented by `migrate()` |
| `PendingWasmHash` | WASM hash stored by `upgrade()`, used by `migrate()` |

**Steps:**

```bash
# 1. Build the new WASM
cd contracts/nova-rewards
cargo build --release --target wasm32v1-none
# Output: ../../target/wasm32v1-none/release/nova_rewards.wasm

# 2. Upload the new WASM to the network
stellar contract upload \
  --source ADMIN_SECRET \
  --network testnet \
  --wasm ../../target/wasm32v1-none/release/nova_rewards.wasm
# Note the returned WASM hash

# 3. Call upgrade() — swaps WASM, increments MigrationVersion
stellar contract invoke \
  --id CONTRACT_ID \
  --source ADMIN_SECRET \
  --network testnet \
  -- upgrade --new_wasm_hash <HASH>

# 4. Call migrate() — runs migration logic, increments MigratedVersion
stellar contract invoke \
  --id CONTRACT_ID \
  --source ADMIN_SECRET \
  --network testnet \
  -- migrate
```

**Adding migration logic in Rust:**

```rust
// In contracts/nova-rewards/src/lib.rs, inside migrate():
pub fn migrate(env: Env) {
    Self::require_admin(&env);
    let migration_version: u32 = env.storage().instance()
        .get(&DataKey::MigrationVersion).unwrap_or(0);
    let migrated_version: u32 = env.storage().instance()
        .get(&DataKey::MigratedVersion).unwrap_or(0);
    assert!(migrated_version < migration_version, "already migrated");

    // Add a versioned block for each release:
    if migration_version == 2 {
        // backfill new storage field, rename keys, etc.
    }

    env.storage().instance()
        .set(&DataKey::MigratedVersion, &migration_version);
}
```

### Pattern B — M-of-N Multisig Upgrade

Used by `campaign`, `governance`, `distribution`, `escrow`, `admin_roles`.

Each signer calls `approve_upgrade(new_wasm_hash)`. When the number of unique approvals reaches `Threshold`, the contract immediately executes `env.deployer().update_current_contract_wasm(new_wasm_hash)`.

```bash
# Each signer calls:
stellar contract invoke \
  --id CONTRACT_ID \
  --source SIGNER_SECRET \
  --network testnet \
  -- approve_upgrade --new_wasm_hash <HASH>
# The last signer to reach threshold triggers the upgrade automatically.
```

### Post-Upgrade Verification

```bash
# Verify the contract is still responsive
stellar contract invoke --id CONTRACT_ID --network testnet -- is_paused

# Check migration versions match (nova-rewards only)
stellar contract invoke --id CONTRACT_ID --network testnet -- get_migration_version
stellar contract invoke --id CONTRACT_ID --network testnet -- get_migrated_version
# Both should return the same value
```

### Rollback

Soroban WASM upgrades are not automatically reversible. To roll back, upload the previous WASM artifact and follow the same upgrade procedure with the old hash. Keep all WASM artifacts and their hashes in `deployments/`.
