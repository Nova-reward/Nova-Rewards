# Optimized Storage Schema

This document describes the storage layout optimizations applied to Nova Rewards smart contracts to stay within Soroban's WASM size and storage budget limits.

## Optimization Strategy

### 1. Storage Key Consolidation
Where multiple fields are always read/written together, they have been consolidated into single struct values to reduce storage overhead.

### 2. Fixed-Length Identifiers
Using `Bytes` or `BytesN` instead of `String` for fixed-length identifiers reduces encoding overhead.

### 3. TTL Management
All persistent storage entries have appropriate TTL extensions to prevent ledger expiry.

## Contract Storage Layouts

### Nova Rewards Contract (`nova-rewards`)

**Storage Keys:**
- `Admin` (instance) - Administrator address
- `Balance(Address)` (instance) - User point balances
- `MigratedVersion` (instance) - Contract version for migrations
- `XlmToken` (instance) - XLM SAC token contract address
- `Router` (instance) - DEX router contract address

**Optimizations Applied:**
- All configuration fields use instance storage (no TTL management needed)
- Balance lookups use composite keys `Balance(Address)` instead of separate mapping
- Fixed-point arithmetic uses `i128` to prevent overflow without additional storage

**WASM Size:** Measured with `stellar contract inspect --wasm`

### Nova Token Contract (`nova_token`)

**Storage Keys:**
- `Admin` (instance) - Administrator address
- `Balance(Address)` (persistent) - Token balances per address
- `Allowance(Address, Address)` (persistent) - Spending allowances

**Optimizations Applied:**
- Composite keys for balances and allowances eliminate need for nested maps
- Persistent storage used only for user data that must survive contract upgrades
- Instance storage for admin (immutable after init)

**TTL Extensions:**
- Balance and Allowance entries: Extended on every read/write operation
- Recommended TTL: 31 days (2,678,400 ledgers)

### Vesting Contract (`vesting`)

**Storage Keys:**
- `Admin` (instance) - Administrator address
- `PoolBalance` (instance) - Total pool balance
- `Schedule(Address, u32)` (persistent) - Vesting schedules by beneficiary and ID
- `NextId(Address)` (instance) - Counter for schedule IDs per beneficiary

**Optimizations Applied:**
- `VestingSchedule` struct consolidates all schedule fields (beneficiary, amounts, times, released)
- Composite key `Schedule(Address, u32)` enables efficient per-user schedule lookups
- Pool balance in instance storage (single global value)

**TTL Extensions:**
- Schedule entries: Extended when created and on each release
- Recommended TTL: 365 days (31,536,000 ledgers) for long-term vesting

### Admin Roles Contract (`admin_roles`)

**Storage Keys:**
- `Admins` (instance) - Set of admin addresses
- `MultisigThreshold` (instance) - Required signature count
- `PendingAdmin` (instance) - Two-step transfer state

**Optimizations Applied:**
- All admin data in instance storage (configuration-level data)
- No persistent storage needed (admin changes are rare)

### Referral Contract (`referral`)

**Storage Keys:**
- `Admin` (instance) - Administrator address
- `UserReferrer(Address)` (persistent) - Referrer for each user
- `ReferralCount(Address)` (persistent) - Count of referrals per user
- `RegistrationCounter` (instance) - Global registration counter

**Optimizations Applied:**
- Composite keys for user-specific data
- Global counter in instance storage
- Persistent storage only for user relationships

**TTL Extensions:**
- UserReferrer and ReferralCount: Extended on registration and queries
- Recommended TTL: 90 days (7,776,000 ledgers)

### Reward Pool Contract (`reward_pool`)

**Storage Keys:**
- `Admin` (instance) - Administrator address
- `Balance` (instance) - Pool balance
- `Deposits(Address)` (persistent) - Deposit amounts per address
- `Withdrawals(Address)` (persistent) - Withdrawal amounts per address

**Optimizations Applied:**
- Single balance field instead of multiple pool tracking fields
- Per-user deposit/withdrawal history in persistent storage
- Admin and global balance in instance storage

**TTL Extensions:**
- Deposit and Withdrawal entries: Extended on each operation
- Recommended TTL: 180 days (15,552,000 ledgers)

## Storage Budget Guidelines

### Instance Storage
- Used for: Configuration, admin addresses, global counters
- Lifetime: Tied to contract instance
- No TTL management required
- Limit: ~10KB per contract instance

### Persistent Storage
- Used for: User balances, schedules, relationships
- Lifetime: Managed via TTL extensions
- Must call `extend_ttl()` on read/write
- Limit: ~100KB per entry

### Temporary Storage
- Not currently used in Nova Rewards contracts
- Lifetime: Single ledger
- Use case: Intermediate computation results

## TTL Extension Pattern

```rust
// Example: Extending TTL on persistent storage read
let balance: i128 = env
    .storage()
    .persistent()
    .get(&DataKey::Balance(addr.clone()))
    .unwrap_or(0);

// Extend TTL by 31 days (2,678,400 ledgers at 5s/ledger)
env.storage()
    .persistent()
    .extend_ttl(&DataKey::Balance(addr.clone()), 2_678_400, 2_678_400);
```

## WASM Size Measurements

Run before and after optimization:

```bash
cd contracts
stellar contract build
stellar contract inspect --wasm target/wasm32-unknown-unknown/release/nova_rewards.wasm
stellar contract inspect --wasm target/wasm32-unknown-unknown/release/nova_token.wasm
stellar contract inspect --wasm target/wasm32-unknown-unknown/release/vesting.wasm
```

### Size Targets
- Maximum WASM size: 256 KB (Soroban limit)
- Target size: < 128 KB (50% headroom for future features)
- Current sizes: (to be measured)

## Future Optimization Opportunities

1. **Pagination**: For contracts with unbounded lists, implement pagination to avoid loading entire collections
2. **Lazy Loading**: Load struct fields on-demand rather than entire structs
3. **Compression**: Use bit-packing for boolean flags and small enums
4. **Archive Old Data**: Move historical data to off-chain storage, keep only recent entries on-chain

## References

- [Soroban Storage Documentation](https://soroban.stellar.org/docs/fundamentals-and-concepts/storage)
- [Soroban Resource Limits](https://soroban.stellar.org/docs/fundamentals-and-concepts/resource-limits)
- [TTL Best Practices](https://soroban.stellar.org/docs/fundamentals-and-concepts/storage#time-to-live-ttl)
