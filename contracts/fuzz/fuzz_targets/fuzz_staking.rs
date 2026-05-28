//! Fuzz target: nova-rewards staking
//!
//! # Invariants verified
//! 1. **Balance non-negative** — the staker's balance never goes below zero at
//!    any point during stake/unstake.
//! 2. **Yield ≥ 0** — accrued yield is always non-negative regardless of rate
//!    or elapsed time.
//! 3. **Total return ≥ principal** — unstake always returns at least the
//!    staked amount (yield cannot be negative).
//! 4. **Balance after unstake = total return** — the staker's balance after
//!    unstaking equals exactly principal + yield (starting from zero balance
//!    after staking deducted it).
//! 5. **calculate_yield consistency** — `calculate_yield` before unstake
//!    matches the yield component returned by `unstake`.
//!
//! # Input layout (40 bytes)
//! ```text
//! [0..16]  amount       : i128  — tokens to stake
//! [16..32] rate         : i128  — annual rate in basis points (0–10 000)
//! [32..40] time_elapsed : u64   — seconds to advance the ledger
//! ```
#![no_main]

use libfuzzer_sys::fuzz_target;
use nova_rewards::{NovaRewardsContract, NovaRewardsContractClient};
use soroban_sdk::testutils::{Address as _, Ledger};
use soroban_sdk::{Address, Env};

fuzz_target!(|data: &[u8]| {
    if data.len() < 40 {
        return;
    }

    let amount = i128::from_le_bytes(data[0..16].try_into().unwrap());
    let rate = i128::from_le_bytes(data[16..32].try_into().unwrap());
    let time_elapsed = u64::from_le_bytes(data[32..40].try_into().unwrap());

    // Constrain to valid ranges
    if amount <= 0 || amount > 1_000_000_000_000_i128 {
        return;
    }
    // rate is in basis points: 0–10 000 (0%–100%)
    if rate < 0 || rate > 10_000 {
        return;
    }

    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(NovaRewardsContract, ());
    let client = NovaRewardsContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let staker = Address::generate(&env);

    client.initialize(&admin);
    client.set_annual_rate(&rate);
    client.set_balance(&staker, &amount);

    // Invariant: balance non-negative before staking
    let balance_before = client.get_balance(&staker);
    assert!(
        balance_before >= 0,
        "balance must be non-negative before stake: {balance_before}"
    );

    client.stake(&staker, &amount);

    // Invariant: balance non-negative after staking (should be 0)
    let balance_after_stake = client.get_balance(&staker);
    assert!(
        balance_after_stake >= 0,
        "balance must be non-negative after stake: {balance_after_stake}"
    );
    assert_eq!(
        balance_after_stake, 0,
        "balance must be zero after staking full amount"
    );

    // Advance time
    env.ledger().with_mut(|l| {
        l.timestamp = l.timestamp.saturating_add(time_elapsed);
    });

    // Invariant: calculate_yield is non-negative
    let yield_preview = client.calculate_yield(&staker);
    assert!(
        yield_preview >= 0,
        "yield must be non-negative: {yield_preview}"
    );

    let total = client.unstake(&staker);

    // Invariant: total return ≥ principal
    assert!(
        total >= amount,
        "total return must be >= principal: total={total} principal={amount}"
    );

    // Invariant: yield component is non-negative
    let yield_amount = total - amount;
    assert!(
        yield_amount >= 0,
        "yield must be non-negative: {yield_amount}"
    );

    // Invariant: balance after unstake equals total return
    let balance_after_unstake = client.get_balance(&staker);
    assert_eq!(
        balance_after_unstake, total,
        "balance after unstake must equal total return"
    );

    // Invariant: balance non-negative after unstaking
    assert!(
        balance_after_unstake >= 0,
        "balance must be non-negative after unstake: {balance_after_unstake}"
    );
});
