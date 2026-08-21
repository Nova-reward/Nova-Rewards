#![no_main]
//! Fuzz harness for the reward_pool contract.
//!
//! Wires a real NovaToken contract into `RewardPool` (mirroring the token
//! wiring fixed in #1228) and drives an arbitrary interleaving of deposit,
//! withdraw, fee configuration, treasury configuration, and pool-lock
//! operations, checking after every single operation that the pool's real
//! on-chain token balance never goes negative.
//!
//! Rejections by the contract (pool locked, insufficient balance, treasury
//! not set) are valid behaviour and are observed via the `try_` client
//! methods; only invariant violations count as crashes.
//!
//! NOTE: gated behind the `broken-contracts` feature — as of this writing
//! `reward_pool` does not build on `main` (duplicated `get_balance`
//! definitions and a dangling code fragment left over from a bad merge,
//! tracked in #1225). This target builds and runs once that crate is
//! repaired; nothing here depends on the corrupted tail of that file.

use libfuzzer_sys::fuzz_target;
use nova_token::{NovaToken, NovaTokenClient};
use reward_pool::{RewardPoolContract, RewardPoolContractClient};
use soroban_sdk::testutils::{Address as _, Ledger};
use soroban_sdk::{Address, Env};

/// treasury-enabled flag(1)
const HEADER_LEN: usize = 1;
/// op selector(1) + amount(16) + extra(8, reused for fee_bps / lock timestamp)
const OP_LEN: usize = 25;

/// Reduces an arbitrary byte-derived `i128` to a small, always-nonnegative
/// range so repeated deposits cannot overflow the harness's own bookkeeping.
fn bounded_amount(bytes: &[u8]) -> i128 {
    let raw = i128::from_le_bytes(bytes.try_into().unwrap());
    raw.checked_abs().unwrap_or(i128::MAX) % (i128::MAX / 4)
}

fuzz_target!(|data: &[u8]| {
    if data.len() < HEADER_LEN + OP_LEN {
        return;
    }

    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let merchant = Address::generate(&env);
    let recipient = Address::generate(&env);
    let treasury = Address::generate(&env);

    let token_id = env.register(NovaToken, ());
    let token = NovaTokenClient::new(&env, &token_id);
    token.initialize(&admin);
    token.mint(&merchant, &i128::MAX);

    let pool_id = env.register(RewardPoolContract, ());
    let pool = RewardPoolContractClient::new(&env, &pool_id);
    pool.initialize(&admin, &token_id);

    if data[0] & 1 == 1 {
        let _ = pool.try_update_treasury(&treasury);
    }

    for op in data[HEADER_LEN..].chunks_exact(OP_LEN) {
        match op[0] & 0x03 {
            0 => {
                let amount = bounded_amount(&op[1..17]);
                if amount > 0 {
                    // A merchant with a fresh, unconstrained auth deposits
                    // into the pool. try_ guards against the underlying
                    // token transfer panicking on an exhausted balance.
                    let _ = pool.try_deposit(&merchant, &amount);
                }
            }
            1 => {
                let amount = bounded_amount(&op[1..17]);
                if amount > 0 {
                    let _ = pool.try_withdraw(&recipient, &amount);
                }
            }
            2 => {
                let fee_bps = u32::from_le_bytes(op[17..21].try_into().unwrap()) % 10_001;
                let _ = pool.try_update_fee(&fee_bps);
            }
            _ => {
                let advance = u64::from_le_bytes(op[17..25].try_into().unwrap()) % 1_000;
                env.ledger()
                    .with_mut(|l| l.timestamp = l.timestamp.saturating_add(advance));
                let _ = pool.try_set_locked_until(&env.ledger().timestamp());
            }
        }

        // Core invariant after every single operation: the pool's real
        // on-chain token balance can never go negative.
        assert!(pool.get_balance() >= 0, "reward pool token balance went negative");
        assert!(token.balance(&recipient) >= 0);
        assert!(pool.get_treasury_balance() >= 0);
    }
});
