#![cfg(test)]

//! Comprehensive tests for staking functionality.
//!
//! Tests cover:
//! - Basic stake and unstake operations
//! - Yield calculations with different time periods
//! - Double-stake prevention
//! - Admin rate setting
//! - Edge cases and error conditions

use nova_rewards::{NovaRewardsContract, NovaRewardsContractClient, SECONDS_PER_YEAR};
use soroban_sdk::testutils::{Address as_, Ledger as _};
use soroban_sdk::{Address, Env};

fn deploy(env: &Env) -> NovaRewardsContractClient {
    let admin = Address::generate(env);
    let id = env.register_contract(None, NovaRewardsContract);
    let client = NovaRewardsContractClient::new(env, &id);
    client.initialize(&admin);
    client
}

// ---------------------------------------------------------------------------
// Basic staking tests
// ---------------------------------------------------------------------------

#[test]
fn test_basic_stake_and_unstake() {
    let env = Env::default();
    env.mock_all_auths();
    
    let contract = deploy(&env);
    let user = Address::generate(&env);
    let stake_amount = 1000i128;
    
    // Set initial balance
    contract.set_balance(&user, &stake_amount);
    assert_eq!(contract.get_balance(&user), stake_amount);
    
    // Set annual rate to 10% (1000 basis points)
    contract.set_annual_rate(&1000i128);
    assert_eq!(contract.get_annual_rate(), 1000i128);
    
    // Stake tokens
    contract.stake(&user, &stake_amount);
    
    // Verify stake record exists and balance is deducted
    let stake_record = contract.get_stake(&user).unwrap();
    assert_eq!(stake_record.amount, stake_amount);
    assert_eq!(contract.get_balance(&user), 0);
    
    // Advance time by 1 year
    env.ledger().set_timestamp(env.ledger().timestamp() + SECONDS_PER_YEAR);
    
    // Unstake and receive yield
    let total_return = contract.unstake(&user);
    
    // Expected: 1000 principal + 100 yield (10% of 1000)
    assert_eq!(total_return, 1100);
    assert_eq!(contract.get_balance(&user), 1100);
    
    // Verify stake record is removed
    assert!(contract.get_stake(&user).is_none());
}

#[test]
fn test_partial_period_yield_calculation() {
    let env = Env::default();
    env.mock_all_auths();
    
    let contract = deploy(&env);
    let user = Address::generate(&env);
    let stake_amount = 1000i128;
    
    contract.set_balance(&user, &stake_amount);
    contract.set_annual_rate(&1000i128); // 10% annual rate
    
    contract.stake(&user, &stake_amount);
    
    // Advance time by 6 months (half a year)
    let six_months = SECONDS_PER_YEAR / 2;
    env.ledger().set_timestamp(env.ledger().timestamp() + six_months);
    
    let total_return = contract.unstake(&user);
    
    // Expected: 1000 principal + 50 yield (10% * 0.5 * 1000)
    assert_eq!(total_return, 1050);
    assert_eq!(contract.get_balance(&user), 1050);
}

#[test]
fn test_zero_rate_yield() {
    let env = Env::default();
    env.mock_all_auths();
    
    let contract = deploy(&env);
    let user = Address::generate(&env);
    let stake_amount = 1000i128;
    
    contract.set_balance(&user, &stake_amount);
    // Rate is 0 by default
    
    contract.stake(&user, &stake_amount);
    
    // Advance time by 1 year
    env.ledger().set_timestamp(env.ledger().timestamp() + SECONDS_PER_YEAR);
    
    let total_return = contract.unstake(&user);
    
    // Expected: only principal, no yield
    assert_eq!(total_return, 1000);
    assert_eq!(contract.get_balance(&user), 1000);
}

#[test]
fn test_double_stake_prevention() {
    let env = Env::default();
    env.mock_all_auths();
    
    let contract = deploy(&env);
    let user = Address::generate(&env);
    
    contract.set_balance(&user, &2000i128);
    
    // First stake should succeed
    contract.stake(&user, &1000i128);
    assert!(contract.get_stake(&user).is_some());
    
    // Second stake should fail
    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        contract.stake(&user, &1000i128);
    }));
    
    assert!(result.is_err());
    
    // Verify only first stake remains
    let stake_record = contract.get_stake(&user).unwrap();
    assert_eq!(stake_record.amount, 1000);
}

#[test]
fn test_insufficient_balance_stake() {
    let env = Env::default();
    env.mock_all_auths();
    
    let contract = deploy(&env);
    let user = Address::generate(&env);
    
    contract.set_balance(&user, &500i128);
    
    // Try to stake more than balance
    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        contract.stake(&user, &1000i128);
    }));
    
    assert!(result.is_err());
    assert!(contract.get_stake(&user).is_none());
}

#[test]
fn test_unstake_without_active_stake() {
    let env = Env::default();
    env.mock_all_auths();
    
    let contract = deploy(&env);
    let user = Address::generate(&env);
    
    // Try to unstake without active stake
    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        contract.unstake(&user);
    }));
    
    assert!(result.is_err());
}

#[test]
fn test_stake_zero_amount() {
    let env = Env::default();
    env.mock_all_auths();
    
    let contract = deploy(&env);
    let user = Address::generate(&env);
    
    contract.set_balance(&user, &1000i128);
    
    // Try to stake zero amount
    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        contract.stake(&user, &0i128);
    }));
    
    assert!(result.is_err());
}

#[test]
fn test_negative_stake_amount() {
    let env = Env::default();
    env.mock_all_auths();
    
    let contract = deploy(&env);
    let user = Address::generate(&env);
    
    contract.set_balance(&user, &1000i128);
    
    // Try to stake negative amount
    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        contract.stake(&user, &-100i128);
    }));
    
    assert!(result.is_err());
}

// ---------------------------------------------------------------------------
// Admin rate setting tests
// ---------------------------------------------------------------------------

#[test]
fn test_set_annual_rate() {
    let env = Env::default();
    env.mock_all_auths();
    
    let contract = deploy(&env);
    let admin = Address::generate(&env);
    
    // Re-deploy with known admin
    let id = env.register_contract(None, NovaRewardsContract);
    let client = NovaRewardsContractClient::new(&env, &id);
    client.initialize(&admin);
    
    // Set rate as admin
    client.set_annual_rate(&500i128); // 5%
    assert_eq!(client.get_annual_rate(), 500i128);
    
    // Set maximum rate (100%)
    client.set_annual_rate(&10000i128);
    assert_eq!(client.get_annual_rate(), 10000i128);
    
    // Set zero rate
    client.set_annual_rate(&0i128);
    assert_eq!(client.get_annual_rate(), 0i128);
}

#[test]
fn test_set_invalid_rate() {
    let env = Env::default();
    env.mock_all_auths();
    
    let contract = deploy(&env);
    
    // Try negative rate
    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        contract.set_annual_rate(&-100i128);
    }));
    assert!(result.is_err());
    
    // Try rate above 10000
    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        contract.set_annual_rate(&10001i128);
    }));
    assert!(result.is_err());
}

// ---------------------------------------------------------------------------
// Yield calculation tests
// ---------------------------------------------------------------------------

#[test]
fn test_calculate_yield_without_unstaking() {
    let env = Env::default();
    env.mock_all_auths();
    
    let contract = deploy(&env);
    let user = Address::generate(&env);
    let stake_amount = 1000i128;
    
    contract.set_balance(&user, &stake_amount);
    contract.set_annual_rate(&1000i128); // 10%
    
    contract.stake(&user, &stake_amount);
    
    // Advance time by 3 months
    let three_months = SECONDS_PER_YEAR / 4;
    env.ledger().set_timestamp(env.ledger().timestamp() + three_months);
    
    // Calculate expected yield
    let expected_yield = stake_amount * 1000 * (three_months as i128) / (10000 * SECONDS_PER_YEAR as i128);
    let actual_yield = contract.calculate_yield(&user);
    
    assert_eq!(actual_yield, expected_yield);
    assert_eq!(actual_yield, 25); // 10% * 0.25 * 1000 = 25
}

#[test]
fn test_calculate_yield_no_active_stake() {
    let env = Env::default();
    env.mock_all_auths();
    
    let contract = deploy(&env);
    let user = Address::generate(&env);
    
    // Calculate yield without active stake should return 0
    let yield_amount = contract.calculate_yield(&user);
    assert_eq!(yield_amount, 0);
}

#[test]
fn test_precise_yield_calculation() {
    let env = Env::default();
    env.mock_all_auths();
    
    let contract = deploy(&env);
    let user = Address::generate(&env);
    let stake_amount = 1_000_000i128; // Large amount for precision testing
    
    contract.set_balance(&user, &stake_amount);
    contract.set_annual_rate(&333i128); // 3.33% - tricky decimal
    
    contract.stake(&user, &stake_amount);
    
    // Advance time by exactly 1 year
    env.ledger().set_timestamp(env.ledger().timestamp() + SECONDS_PER_YEAR);
    
    let total_return = contract.unstake(&user);
    
    // Expected: 1,000,000 + 33,300 (3.33% of 1,000,000)
    let expected_yield = stake_amount * 333 / 10000;
    let expected_total = stake_amount + expected_yield;
    
    assert_eq!(total_return, expected_total);
    assert_eq!(total_return, 1_033_300);
}

// ---------------------------------------------------------------------------
// Event tests
// ---------------------------------------------------------------------------

#[test]
fn test_staking_events() {
    let env = Env::default();
    env.mock_all_auths();
    
    let contract = deploy(&env);
    let user = Address::generate(&env);
    let stake_amount = 1000i128;
    
    contract.set_balance(&user, &stake_amount);
    contract.set_annual_rate(&1000i128);
    
    // Stake and capture event
    contract.stake(&user, &stake_amount);
    
    let staked_events = env.events().all().filter(|(topics, _data)| {
        topics[0] == soroban_sdk::Symbol::short("staked")
    }).collect::<Vec<_>>();
    
    assert_eq!(staked_events.len(), 1);
    assert_eq!(staked_events[0].0[1], user.into());
    assert_eq!(staked_events[0].1, (stake_amount, env.ledger().timestamp()).into());
    
    // Advance time and unstake
    env.ledger().set_timestamp(env.ledger().timestamp() + SECONDS_PER_YEAR);
    
    let total_return = contract.unstake(&user);
    
    let unstaked_events = env.events().all().filter(|(topics, _data)| {
        topics[0] == soroban_sdk::Symbol::short("unstaked")
    }).collect::<Vec<_>>();
    
    assert_eq!(unstaked_events.len(), 1);
    assert_eq!(unstaked_events[0].0[1], user.into());
    assert_eq!(unstaked_events[0].1, (stake_amount, 100, env.ledger().timestamp()).into());
}
