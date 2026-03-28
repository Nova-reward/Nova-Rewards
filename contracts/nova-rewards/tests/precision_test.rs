#![cfg(test)]

//! Precision tests for Issue #205 — fixed-point arithmetic in calculate_payout.
//!
//! All rates are expressed as integers scaled by SCALE_FACTOR (1_000_000).
//! e.g. 3.3333% → rate = 33_333

use nova_rewards::{calculate_payout, NovaRewardsContract, NovaRewardsContractClient, SCALE_FACTOR};
use soroban_sdk::{testutils::Address as _, Address, Env};

fn deploy(env: &Env) -> NovaRewardsContractClient {
    let admin = Address::generate(env);
    let id = env.register_contract(None, NovaRewardsContract);
    let client = NovaRewardsContractClient::new(env, &id);
    client.initialize(&admin);
    client
}

// ---------------------------------------------------------------------------
// Bug reproduction — "difficult" numbers
// ---------------------------------------------------------------------------

/// Balance: 1_000_000_000_001, rate: 3.3333% (33_333 / 1_000_000)
///
/// Naïve (broken) formula:  (1_000_000_000_001 / 1_000_000) * 33_333
///                        = 1_000_000 * 33_333
///                        = 33_333_000_000          ← loses the trailing 1
///
/// Correct formula:        (1_000_000_000_001 * 33_333) / 1_000_000
///                        = 33_333_000_033_333 / 1_000_000
///                        = 33_333_000            ← exact, no dust
#[test]
fn test_difficult_numbers_exact_payout() {
    let balance: i128 = 1_000_000_000_001;
    let rate: i128 = 33_333; // 0.033333 × SCALE_FACTOR

    // Expected: multiply-first result, truncated
    let expected: i128 = (balance * rate) / SCALE_FACTOR;

    let actual = calculate_payout(balance, rate);
    assert_eq!(actual, expected, "payout must match to the last integer digit");

    // Also confirm the naïve formula gives a DIFFERENT (wrong) answer,
    // proving the bug existed and is now fixed.
    let naive = (balance / SCALE_FACTOR) * rate;
    assert_ne!(
        naive, actual,
        "naïve formula should differ — confirms the bug was real"
    );
}

// ---------------------------------------------------------------------------
// Zero and identity cases
// ---------------------------------------------------------------------------

#[test]
fn test_zero_balance_yields_zero() {
    assert_eq!(calculate_payout(0, 33_333), 0);
}

#[test]
fn test_zero_rate_yields_zero() {
    assert_eq!(calculate_payout(1_000_000_000_001, 0), 0);
}

#[test]
fn test_full_rate_equals_balance() {
    // rate = SCALE_FACTOR means 100%
    let balance: i128 = 42_000_000;
    assert_eq!(calculate_payout(balance, SCALE_FACTOR), balance);
}

// ---------------------------------------------------------------------------
// Boundary — maximum safe i128 values
// ---------------------------------------------------------------------------

/// Largest balance that won't overflow when multiplied by SCALE_FACTOR.
/// i128::MAX / SCALE_FACTOR ≈ 1.70 × 10^32
#[test]
fn test_max_safe_balance_does_not_overflow() {
    let max_safe_balance = i128::MAX / SCALE_FACTOR;
    // rate = 1 (smallest non-zero rate: 0.000001)
    let result = calculate_payout(max_safe_balance, 1);
    assert!(result >= 0, "result must be non-negative");
}

/// Confirm that a balance just above the safe threshold panics (overflow guard).
#[test]
#[should_panic(expected = "overflow in balance * rate")]
fn test_overflow_panics_safely() {
    // i128::MAX * SCALE_FACTOR overflows i128
    calculate_payout(i128::MAX, SCALE_FACTOR);
}

// ---------------------------------------------------------------------------
// Contract entry-point round-trip
// ---------------------------------------------------------------------------

#[test]
fn test_calc_payout_entry_point_matches_free_function() {
    let env = Env::default();
    env.mock_all_auths();
    let client = deploy(&env);

    let balance: i128 = 1_000_000_000_001;
    let rate: i128 = 33_333;

    assert_eq!(
        client.calc_payout(&balance, &rate),
        calculate_payout(balance, rate)
    );
}
