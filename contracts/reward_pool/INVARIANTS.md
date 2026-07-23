# Reward pool invariants

`tests/invariant_pool.rs` is a stateful property suite that runs 500 generated
sequences. Every sequence starts with a funded pool and then mixes eight wallet
addresses, deposits, ledger-time changes, and admin lock/unlock operations.

## Checked invariants

- The recorded pool balance never becomes negative.
- At every transition, `pool balance + successful withdrawals == all deposits`.
  Consequently, the aggregate amount withdrawn by all wallets can never exceed
  the tokens that have funded the pool.
- A withdrawal larger than the current pool balance panics before it changes
  the balance; the harness catches that expected panic and verifies the balance
  is unchanged.
- While locked, each withdrawal returns `PoolError::PoolLocked` and leaves the
  balance unchanged. The focused lock test also verifies that its recipient's
  history is unchanged.
- A wallet cannot withdraw more than `DAILY_WITHDRAWAL_CAP` in one rolling
  24-hour period. Every successful generated withdrawal also checks its
  on-chain withdrawal-history value against the model; cap rejections leave
  the pool balance unchanged.
- At exactly `SECONDS_PER_DAY`, a wallet's cap is reset; at one second before
  that boundary it is still enforced.
- A lock remains effective after deposits and a ledger-day transition, and a
  withdrawal succeeds again only after the admin changes the state back to
  `Active`.

## Edge-case inputs

Generated withdrawals range from 1 through 1,500 tokens, deliberately
including requests larger than the 1,000-token per-wallet cap. Deposits range
from 1 through 2,000 tokens. Time movement includes `0`, one second before a
day, exactly one day, and arbitrary movements up to two days. The pool starts
with 2,500 tokens so both ordinary cap failures and genuine overdraft attempts
occur frequently, even before later re-seeding.

The harness uses Soroban's mocked authorization and ledger utilities. It
validates state-machine safety, not cryptographic signature enforcement; auth
policy is covered by contract-level authorization tests.
