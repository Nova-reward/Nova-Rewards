# Error Code Reference

All Nova Rewards Soroban contracts use `panic!` with a string message as the error mechanism.
Soroban surfaces these as `InvokeHostFunctionTrapped` with the panic message in the diagnostic events.

> **Tip:** When a transaction fails, check the `diagnosticEvents` field in the simulation or transaction result for the panic message.

---

## How to Read Errors

```typescript
// Stellar SDK: catch and inspect errors
try {
  await server.simulateTransaction(tx);
} catch (e) {
  // e.message contains the panic string, e.g. "insufficient balance"
  console.error("Contract error:", e.message);
}
```

---

## Error Reference

### nova-rewards

| Error Message | Contract Function(s) | Description | Remediation |
|---------------|---------------------|-------------|-------------|
| `"already initialized"` | `initialize` | Contract has already been initialized. | Call `initialize` only once after deployment. |
| `"contract is paused"` | All state-changing functions | The contract is in a paused state. | Wait for admin to call `resume` or `unpause`, or check `is_paused()`. |
| `"contract must be paused"` | `restore_account`, `recover_transaction`, `recover_funds` | Recovery operations require the contract to be paused first. | Admin must call `pause` before executing recovery operations. |
| `"duration must be > 0"` | `emergency_pause` | Emergency pause duration must be a positive number of seconds. | Pass a `duration_secs` value greater than 0. |
| `"not initialized"` | All functions | Contract storage has no admin set. | Call `initialize` first. |
| `"nova_amount must be positive"` | `swap_for_xlm` | Swap amount must be greater than zero. | Pass a positive `nova_amount`. |
| `"min_xlm_out must be non-negative"` | `swap_for_xlm` | Slippage floor cannot be negative. | Pass `min_xlm_out >= 0`. |
| `"path exceeds maximum of 5 hops"` | `swap_for_xlm` | Swap path is too long. | Reduce the swap path to at most 5 token addresses. |
| `"insufficient Nova balance"` | `swap_for_xlm` | User does not have enough Nova points to burn. | Check `get_balance` before calling `swap_for_xlm`. |
| `"router not configured"` | `swap_for_xlm` | DEX router address has not been set. | Admin must call `set_swap_config` before swaps are available. |
| `"slippage: received X < min Y"` | `swap_for_xlm` | DEX returned fewer XLM than the minimum specified. | Increase `min_xlm_out` tolerance or retry when market conditions improve. |
| `"migration already applied"` | `migrate` | The current migration version has already been run. | Do not call `migrate` twice for the same version. |
| `"no pending wasm hash"` | `migrate` | `upgrade` was not called before `migrate`. | Call `upgrade` with the new WASM hash first. |
| `"rate must be between 0 and 10000 basis points"` | `set_annual_rate` | Staking rate is out of the valid range. | Pass a rate between `0` and `10000` (inclusive). |
| `"amount must be positive"` | `stake` | Stake amount must be greater than zero. | Pass a positive `amount`. |
| `"user already has an active stake"` | `stake` | The staker already has an open stake position. | Call `unstake` to close the existing position before staking again. |
| `"insufficient balance for staking"` | `stake` | User's balance is less than the requested stake amount. | Check `get_balance` and ensure sufficient funds before staking. |
| `"no active stake found"` | `unstake` | The staker has no open stake position. | Only call `unstake` after a successful `stake`. |
| `"snapshot not found"` | `restore_account` | No snapshot exists for the given user. | Call `snapshot_account` before attempting a restore. |
| `"recovery would overdraw balance"` | `recover_transaction` | Applying the delta would result in a negative balance. | Use a smaller or positive `amount_delta`. |
| `"insufficient balance for fund recovery"` | `recover_funds` | Source account has insufficient balance for the transfer. | Verify `get_balance(from)` before calling `recover_funds`. |

---

### nova_token

| Error Message | Contract Function(s) | Description | Remediation |
|---------------|---------------------|-------------|-------------|
| `"already initialized"` | `initialize` | Token contract already initialized. | Call `initialize` only once. |
| `"amount must be positive"` | `mint`, `burn`, `transfer`, `transfer_from`, `increase_allowance`, `decrease_allowance` | Token amount must be greater than zero. | Pass a positive `amount`. |
| `"insufficient balance"` | `burn`, `transfer`, `transfer_from` | Account does not hold enough tokens. | Check `balance(addr)` before the operation. |
| `"insufficient allowance"` | `transfer_from` | Spender's allowance is less than the requested amount. | Call `approve` or `increase_allowance` to grant sufficient allowance first. |

---

### governance

| Error Message | Contract Function(s) | Description | Remediation |
|---------------|---------------------|-------------|-------------|
| `"already initialised"` | `initialize` | Governance contract already initialized. | Call `initialize` only once. |
| `"proposal not found"` | `vote`, `finalise`, `execute`, `get_proposal` | No proposal exists with the given id. | Verify the proposal id using `proposal_count()`. |
| `"already voted"` | `vote` | The voter has already cast a vote on this proposal. | Each address may only vote once per proposal. |
| `"proposal not active"` | `vote`, `finalise` | The proposal is not in `Active` status. | Check `get_proposal(id).status` before voting or finalising. |
| `"voting period ended"` | `vote` | The current ledger sequence exceeds the proposal's `end_ledger`. | Voting is closed; call `finalise` instead. |
| `"voting period not ended"` | `finalise` | The voting period has not yet elapsed. | Wait until the ledger sequence exceeds `proposal.end_ledger`. |
| `"proposal not passed"` | `execute` | The proposal status is not `Passed`. | Only passed proposals can be executed. Check `get_proposal(id).status`. |

---

### reward_pool

| Error Message | Contract Function(s) | Description | Remediation |
|---------------|---------------------|-------------|-------------|
| `"already initialised"` | `initialize` | Pool already initialized. | Call `initialize` only once. |
| `"amount must be positive"` | `deposit`, `withdraw`, `set_daily_limit` | Amount or limit must be greater than zero. | Pass a positive value. |
| `"insufficient pool balance"` | `withdraw` | The pool holds fewer tokens than the requested withdrawal. | Check `get_balance()` before withdrawing. |
| `"daily withdrawal limit exceeded"` | `withdraw` | The wallet's 24-hour withdrawal total would exceed the configured cap. | Wait for the 24-hour window to reset, or request a limit increase from the admin. |

---

### vesting

| Error Message | Contract Function(s) | Description | Remediation |
|---------------|---------------------|-------------|-------------|
| `"already initialised"` | `initialize` | Vesting contract already initialized. | Call `initialize` only once. |
| `"amount must be positive"` | `fund_pool` | Pool funding amount must be positive. | Pass a positive `amount`. |
| `"total_duration must be > 0"` | `create_schedule` | Vesting duration cannot be zero. | Pass a `total_duration` greater than 0. |
| `"total_amount must be > 0"` | `create_schedule` | Total vesting amount must be positive. | Pass a `total_amount` greater than 0. |
| `"schedule not found"` | `release`, `get_schedule` | No schedule exists for the given beneficiary and id. | Verify the schedule id returned by `create_schedule`. |
| `"nothing to release"` | `release` | No new tokens have vested since the last release. | Wait for more time to pass, or check the schedule's cliff and duration. |
| `"insufficient pool balance"` | `release` | The vesting pool does not hold enough tokens. | Admin must call `fund_pool` to top up the pool. |

---

### referral

| Error Message | Contract Function(s) | Description | Remediation |
|---------------|---------------------|-------------|-------------|
| `"already initialised"` | `initialize` | Referral contract already initialized. | Call `initialize` only once. |
| `"amount must be positive"` | `fund_pool` | Pool funding amount must be positive. | Pass a positive `amount`. |
| `"cannot refer yourself"` | `register_referral` | Referrer and referred addresses are the same. | Use two distinct addresses. |
| `"already referred"` | `register_referral` | The referred wallet already has a registered referrer. | Each wallet can only be referred once. |
| `"reward_amount must be positive"` | `credit_referrer` | Reward amount must be greater than zero. | Pass a positive `reward_amount`. |
| `"no referrer found"` | `credit_referrer` | The referred wallet has no registered referrer. | Call `register_referral` before crediting. |
| `"insufficient pool balance"` | `credit_referrer` | The reward pool does not hold enough tokens. | Admin must call `fund_pool` to top up the pool. |

---

### distribution

| Error Message | Contract Function(s) | Description | Remediation |
|---------------|---------------------|-------------|-------------|
| `"already initialized"` | `initialize` | Distribution contract already initialized. | Call `initialize` only once. |
| `"not initialized"` | All functions | Admin or token address not set. | Call `initialize` first. |
| `"amount must be positive"` | `distribute`, `distribute_batch` | Distribution amount must be positive. | Pass a positive `amount`. |
| `"insufficient contract balance"` | `distribute` | Contract holds fewer tokens than the requested amount. | Fund the contract with Nova tokens before distributing. |
| `"recipients and amounts length mismatch"` | `distribute_batch` | The `recipients` and `amounts` vectors have different lengths. | Ensure both vectors have the same number of elements. |
| `"empty batch"` | `distribute_batch` | The batch is empty. | Provide at least one recipient. |
| `"batch exceeds maximum of 50"` | `distribute_batch` | More than 50 recipients were provided. | Split into multiple calls of ≤ 50 recipients each. |
| `"insufficient contract balance for batch"` | `distribute_batch` | Contract cannot cover the total batch amount. | Fund the contract before calling `distribute_batch`. |
| `"base_amount must be non-negative"` | `calculate_reward` | Base amount for reward calculation is negative. | Pass `base_amount >= 0`. |
| `"rate_bps must be 0–10 000"` | `calculate_reward` | Rate in basis points is out of range. | Pass a `rate_bps` between `0` and `10000`. |
| `"no clawback record for recipient"` | `clawback` | No distribution was recorded for this recipient. | Only call `clawback` after a successful `distribute`. |
| `"clawback window has expired"` | `clawback` | More than 30 days have passed since the distribution. | Clawback is no longer possible after the window expires. |
| `"nothing to clawback"` | `clawback` | The recorded distribution amount is zero. | The distribution may have already been clawed back. |

---

### admin_roles

| Error Message | Contract Function(s) | Description | Remediation |
|---------------|---------------------|-------------|-------------|
| `"already initialised"` | `initialize` | Admin roles contract already initialized. | Call `initialize` only once. |
| `"no pending admin"` | `accept_admin` | No admin transfer is in progress. | Current admin must call `propose_admin` first. |

---

## Common Patterns

### Checking Before Calling

```typescript
// Always check balance before withdrawing
const balance = await client.get_balance({ user: userAddress });
if (balance < withdrawAmount) {
  throw new Error("Insufficient balance");
}
await client.withdraw({ to: userAddress, amount: withdrawAmount });
```

### Handling Paused State

```typescript
const isPaused = await client.is_paused();
if (isPaused) {
  console.warn("Contract is paused. Operations are temporarily unavailable.");
  return;
}
```

### Retry on Slippage

```typescript
async function swapWithRetry(novaAmount: bigint, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      // Reduce min_xlm_out by 1% per retry
      const minXlm = (expectedXlm * BigInt(99 - i)) / 100n;
      return await client.swap_for_xlm({ user, nova_amount: novaAmount, min_xlm_out: minXlm, path });
    } catch (e) {
      if (!e.message.includes("slippage") || i === maxRetries - 1) throw e;
    }
  }
}
```
