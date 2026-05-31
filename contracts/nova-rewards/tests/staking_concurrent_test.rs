#![cfg(test)]

//! Tests for concurrent staking, cooldown enforcement, and reward claiming.
//! Covers acceptance criteria for issue #551.

use nova_rewards::{NovaRewardsContract, NovaRewardsContractClient, SECONDS_PER_YEAR};
use soroban_sdk::testutils::{Address as _, Events, Ledger as _};
use soroban_sdk::{Address, Env};

fn deploy(env: &Env) -> NovaRewardsContractClient {
    let admin = Address::generate(env);
    let id = env.register_contract(None, NovaRewardsContract);
    let client = NovaRewardsContractClient::new(env, &id);
    client.initialize(&admin);
    client
}

// ---------------------------------------------------------------------------
// Multiple concurrent stakers
// ---------------------------------------------------------------------------

#[test]
fn test_multiple_concurrent_stakers_same_start() {
    let env = Env::default();
    env.mock_all_auths();

    let contract = deploy(&env);
    let a = Address::generate(&env);
    let b = Address::generate(&env);
    let c = Address::generate(&env);

    contract.set_annual_rate(&1000i128); // 10%
    contract.set_balance(&a, &1000i128);
    contract.set_balance(&b, &2000i128);
    contract.set_balance(&c, &3000i128);

    // All three stake at the same ledger timestamp
    contract.stake(&a, &1000i128);
    contract.stake(&b, &2000i128);
    contract.stake(&c, &3000i128);

    assert_eq!(contract.get_stake(&a).unwrap().amount, 1000);
    assert_eq!(contract.get_stake(&b).unwrap().amount, 2000);
    assert_eq!(contract.get_stake(&c).unwrap().amount, 3000);

    // Advance 1 year
    env.ledger().set_timestamp(env.ledger().timestamp() + SECONDS_PER_YEAR);

    assert_eq!(contract.unstake(&a), 1100); // 1000 + 10%
    assert_eq!(contract.unstake(&b), 2200); // 2000 + 10%
    assert_eq!(contract.unstake(&c), 3300); // 3000 + 10%

    assert!(contract.get_stake(&a).is_none());
    assert!(contract.get_stake(&b).is_none());
    assert!(contract.get_stake(&c).is_none());
}

#[test]
fn test_concurrent_stakers_independent_timing() {
    let env = Env::default();
    env.mock_all_auths();

    let contract = deploy(&env);
    let a = Address::generate(&env);
    let b = Address::generate(&env);

    contract.set_annual_rate(&1000i128); // 10%
    contract.set_balance(&a, &1000i128);
    contract.set_balance(&b, &1000i128);

    // A stakes at T=0
    contract.stake(&a, &1000i128);

    // B stakes at T=6 months
    let six_months = SECONDS_PER_YEAR / 2;
    env.ledger().set_timestamp(env.ledger().timestamp() + six_months);
    contract.stake(&b, &1000i128);

    // Advance another 6 months → A staked 1yr, B staked 6mo
    env.ledger().set_timestamp(env.ledger().timestamp() + six_months);

    assert_eq!(contract.unstake(&a), 1100); // 1yr at 10%
    assert_eq!(contract.unstake(&b), 1050); // 6mo at 10%
}

#[test]
fn test_concurrent_stakers_do_not_interfere() {
    let env = Env::default();
    env.mock_all_auths();

    let contract = deploy(&env);
    let a = Address::generate(&env);
    let b = Address::generate(&env);

    contract.set_annual_rate(&500i128); // 5%
    contract.set_balance(&a, &4000i128);
    contract.set_balance(&b, &8000i128);

    contract.stake(&a, &4000i128);
    contract.stake(&b, &8000i128);

    // A unstakes after 6 months
    env.ledger().set_timestamp(env.ledger().timestamp() + SECONDS_PER_YEAR / 2);
    let a_return = contract.unstake(&a);
    assert_eq!(a_return, 4100); // 4000 + 2.5% (5% for half year)

    // B still staked — advance another 6 months (1yr total for B)
    env.ledger().set_timestamp(env.ledger().timestamp() + SECONDS_PER_YEAR / 2);
    let b_return = contract.unstake(&b);
    assert_eq!(b_return, 8400); // 8000 + 5%

    // A's unstake did not affect B's rewards
    assert_eq!(contract.get_balance(&b), 8400);
}

// ---------------------------------------------------------------------------
// Cooldown period tests
// ---------------------------------------------------------------------------

#[test]
fn test_set_and_get_cooldown_period() {
    let env = Env::default();
    env.mock_all_auths();

    let contract = deploy(&env);

    assert_eq!(contract.get_cooldown_period(), 0); // default: no cooldown

    contract.set_cooldown_period(&(7 * 86_400u64)); // 7 days
    assert_eq!(contract.get_cooldown_period(), 7 * 86_400u64);

    contract.set_cooldown_period(&0u64);
    assert_eq!(contract.get_cooldown_period(), 0u64);
}

#[test]
fn test_cooldown_blocks_early_unstake() {
    let env = Env::default();
    env.mock_all_auths();

    let contract = deploy(&env);
    let user = Address::generate(&env);

    contract.set_balance(&user, &1000i128);
    contract.set_annual_rate(&1000i128);
    contract.set_cooldown_period(&(7 * 86_400u64)); // 7-day cooldown

    contract.stake(&user, &1000i128);

    // Attempt to unstake before cooldown elapses — must panic
    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        contract.unstake(&user);
    }));
    assert!(result.is_err(), "unstake before cooldown should fail");

    // Also fails at 6 days 23 hr 59 sec (one second short)
    env.ledger().set_timestamp(env.ledger().timestamp() + 7 * 86_400 - 1);
    let result2 = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        contract.unstake(&user);
    }));
    assert!(result2.is_err(), "unstake one second before cooldown should fail");
}

#[test]
fn test_cooldown_allows_unstake_after_period() {
    let env = Env::default();
    env.mock_all_auths();

    let contract = deploy(&env);
    let user = Address::generate(&env);

    contract.set_balance(&user, &1000i128);
    contract.set_annual_rate(&1000i128);
    contract.set_cooldown_period(&(7 * 86_400u64));

    contract.stake(&user, &1000i128);

    env.ledger().set_timestamp(env.ledger().timestamp() + 7 * 86_400 + 1);
    let total = contract.unstake(&user);
    assert!(total > 1000, "should receive principal + yield after cooldown");
}

#[test]
fn test_zero_cooldown_allows_immediate_unstake() {
    let env = Env::default();
    env.mock_all_auths();

    let contract = deploy(&env);
    let user = Address::generate(&env);

    contract.set_balance(&user, &1000i128);
    // Default cooldown = 0
    contract.stake(&user, &1000i128);
    let total = contract.unstake(&user); // immediate, no time elapsed
    assert_eq!(total, 1000);
}

// ---------------------------------------------------------------------------
// claim_staking_reward tests
// ---------------------------------------------------------------------------

#[test]
fn test_claim_reward_basic() {
    let env = Env::default();
    env.mock_all_auths();

    let contract = deploy(&env);
    let user = Address::generate(&env);

    contract.set_balance(&user, &1000i128);
    contract.set_annual_rate(&1000i128); // 10%
    contract.stake(&user, &1000i128);

    // 6-month claim
    env.ledger().set_timestamp(env.ledger().timestamp() + SECONDS_PER_YEAR / 2);
    let reward = contract.claim_staking_reward(&user);
    assert_eq!(reward, 50); // 10% * 0.5yr * 1000
    assert_eq!(contract.get_balance(&user), 50);

    // Stake still active, principal intact
    assert_eq!(contract.get_stake(&user).unwrap().amount, 1000);

    // Second 6-month claim — only from last_claimed_at
    env.ledger().set_timestamp(env.ledger().timestamp() + SECONDS_PER_YEAR / 2);
    let reward2 = contract.claim_staking_reward(&user);
    assert_eq!(reward2, 50);
    assert_eq!(contract.get_balance(&user), 100);

    // Unstake — only principal left (rewards already paid)
    let principal = contract.unstake(&user);
    assert_eq!(principal, 1000);
    assert_eq!(contract.get_balance(&user), 1100);
}

#[test]
fn test_claim_reward_emits_event() {
    let env = Env::default();
    env.mock_all_auths();

    let contract = deploy(&env);
    let user = Address::generate(&env);

    contract.set_balance(&user, &1000i128);
    contract.set_annual_rate(&1000i128);
    contract.stake(&user, &1000i128);

    env.ledger().set_timestamp(env.ledger().timestamp() + SECONDS_PER_YEAR);
    contract.claim_staking_reward(&user);

    let all_events = env.events().all();
    let claimed: Vec<_> = all_events
        .iter()
        .filter(|(topics, _)| topics[0] == soroban_sdk::Symbol::short("claimed"))
        .collect();

    assert_eq!(claimed.len(), 1);
}

#[test]
fn test_claim_reward_no_active_stake_panics() {
    let env = Env::default();
    env.mock_all_auths();

    let contract = deploy(&env);
    let user = Address::generate(&env);

    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        contract.claim_staking_reward(&user);
    }));
    assert!(result.is_err());
}

#[test]
fn test_claim_zero_reward_when_rate_is_zero() {
    let env = Env::default();
    env.mock_all_auths();

    let contract = deploy(&env);
    let user = Address::generate(&env);

    contract.set_balance(&user, &1000i128);
    // annual_rate = 0 (default)
    contract.stake(&user, &1000i128);

    env.ledger().set_timestamp(env.ledger().timestamp() + SECONDS_PER_YEAR);
    let reward = contract.claim_staking_reward(&user);
    assert_eq!(reward, 0);
    assert_eq!(contract.get_balance(&user), 0); // no balance added
}

#[test]
fn test_multiple_stakers_claim_independently() {
    let env = Env::default();
    env.mock_all_auths();

    let contract = deploy(&env);
    let a = Address::generate(&env);
    let b = Address::generate(&env);

    contract.set_annual_rate(&1000i128); // 10%
    contract.set_balance(&a, &1000i128);
    contract.set_balance(&b, &2000i128);

    contract.stake(&a, &1000i128);
    contract.stake(&b, &2000i128);

    env.ledger().set_timestamp(env.ledger().timestamp() + SECONDS_PER_YEAR);

    // A claims mid-way; B does not
    let a_reward = contract.claim_staking_reward(&a);
    assert_eq!(a_reward, 100); // 10% of 1000

    // B's stake is untouched by A's claim
    assert_eq!(contract.get_stake(&b).unwrap().amount, 2000);

    // B unstakes — full year of yield from original staked_at
    let b_total = contract.unstake(&b);
    assert_eq!(b_total, 2200); // 2000 + 10%

    // A unstakes — no additional yield (already claimed)
    let a_principal = contract.unstake(&a);
    assert_eq!(a_principal, 1000);
    assert_eq!(contract.get_balance(&a), 1100); // 100 claimed + 1000 returned
}

#[test]
fn test_staked_unstaked_reward_claimed_events_all_emitted() {
    let env = Env::default();
    env.mock_all_auths();

    let contract = deploy(&env);
    let user = Address::generate(&env);

    contract.set_balance(&user, &1000i128);
    contract.set_annual_rate(&1000i128);

    contract.stake(&user, &1000i128);
    env.ledger().set_timestamp(env.ledger().timestamp() + SECONDS_PER_YEAR / 2);
    contract.claim_staking_reward(&user);
    env.ledger().set_timestamp(env.ledger().timestamp() + SECONDS_PER_YEAR / 2);
    contract.unstake(&user);

    let all = env.events().all();

    let staked = all.iter().filter(|(t, _)| t[0] == soroban_sdk::Symbol::short("staked")).count();
    let unstaked = all.iter().filter(|(t, _)| t[0] == soroban_sdk::Symbol::short("unstaked")).count();
    let claimed = all.iter().filter(|(t, _)| t[0] == soroban_sdk::Symbol::short("claimed")).count();

    assert_eq!(staked, 1, "Staked event missing");
    assert_eq!(unstaked, 1, "Unstaked event missing");
    assert_eq!(claimed, 1, "RewardClaimed event missing");
}
