#![cfg(test)]

use referral::ReferralContract;
use referral::ReferralContractClient;
use soroban_sdk::{testutils::Address as _, Address, Env};

fn setup() -> (Env, Address, ReferralContractClient<'static>) {
    let env = Env::default();
    env.mock_all_auths();
    let id = env.register(ReferralContract, ());
    let client = ReferralContractClient::new(&env, &id);
    let admin = Address::generate(&env);
    client.initialize(&admin);
    client.fund_pool(&10_000);
    (env, admin, client)
}

// ── initialize ────────────────────────────────────────────────────────────────

#[test]
fn initialize_sets_zero_pool_balance() {
    let env = Env::default();
    env.mock_all_auths();
    let id = env.register(ReferralContract, ());
    let client = ReferralContractClient::new(&env, &id);
    let admin = Address::generate(&env);
    client.initialize(&admin);
    assert_eq!(client.pool_balance(), 0);
}

#[test]
#[should_panic(expected = "already initialised")]
fn initialize_twice_panics() {
    let (_env, admin, client) = setup();
    client.initialize(&admin);
}

// ── fund_pool ─────────────────────────────────────────────────────────────────

#[test]
fn fund_pool_increases_balance() {
    let (_env, _admin, client) = setup();
    assert_eq!(client.pool_balance(), 10_000);
    client.fund_pool(&5_000);
    assert_eq!(client.pool_balance(), 15_000);
}

#[test]
#[should_panic(expected = "amount must be positive")]
fn fund_pool_zero_panics() {
    let (_env, _admin, client) = setup();
    client.fund_pool(&0);
}

// ── register_referral ─────────────────────────────────────────────────────────

#[test]
fn register_referral_happy_path() {
    let (env, _admin, client) = setup();
    let referrer = Address::generate(&env);
    let referred = Address::generate(&env);
    client.register_referral(&referrer, &referred);
    assert_eq!(client.get_referrer(&referred), Some(referrer.clone()));
    assert_eq!(client.total_referrals(&referrer), 1);
}

#[test]
fn register_multiple_referrals_increments_counter() {
    let (env, _admin, client) = setup();
    let referrer = Address::generate(&env);
    for _ in 0..5 {
        let referred = Address::generate(&env);
        client.register_referral(&referrer, &referred);
    }
    assert_eq!(client.total_referrals(&referrer), 5);
}

#[test]
#[should_panic(expected = "already referred")]
fn register_referral_duplicate_panics() {
    let (env, _admin, client) = setup();
    let referrer = Address::generate(&env);
    let referred = Address::generate(&env);
    client.register_referral(&referrer, &referred);
    client.register_referral(&referrer, &referred);
}

#[test]
#[should_panic(expected = "cannot refer yourself")]
fn register_self_referral_panics() {
    let (env, _admin, client) = setup();
    let user = Address::generate(&env);
    client.register_referral(&user, &user);
}

// ── get_referrer ──────────────────────────────────────────────────────────────

#[test]
fn get_referrer_returns_none_for_unknown() {
    let (env, _admin, client) = setup();
    let stranger = Address::generate(&env);
    assert_eq!(client.get_referrer(&stranger), None);
}

#[test]
fn get_referrer_returns_correct_referrer() {
    let (env, _admin, client) = setup();
    let referrer = Address::generate(&env);
    let referred = Address::generate(&env);
    client.register_referral(&referrer, &referred);
    assert_eq!(client.get_referrer(&referred), Some(referrer));
}

// ── credit_referrer ───────────────────────────────────────────────────────────

#[test]
fn credit_referrer_deducts_from_pool() {
    let (env, _admin, client) = setup();
    let referrer = Address::generate(&env);
    let referred = Address::generate(&env);
    client.register_referral(&referrer, &referred);
    client.credit_referrer(&referred, &500);
    assert_eq!(client.pool_balance(), 9_500);
}

#[test]
fn credit_referrer_full_pool_balance() {
    let (env, _admin, client) = setup();
    let referrer = Address::generate(&env);
    let referred = Address::generate(&env);
    client.register_referral(&referrer, &referred);
    client.credit_referrer(&referred, &10_000);
    assert_eq!(client.pool_balance(), 0);
}

#[test]
#[should_panic(expected = "insufficient pool balance")]
fn credit_referrer_exceeds_pool_panics() {
    let (env, _admin, client) = setup();
    let referrer = Address::generate(&env);
    let referred = Address::generate(&env);
    client.register_referral(&referrer, &referred);
    client.credit_referrer(&referred, &10_001);
}

#[test]
#[should_panic(expected = "no referrer found")]
fn credit_referrer_without_registration_panics() {
    let (env, _admin, client) = setup();
    let referred = Address::generate(&env);
    client.credit_referrer(&referred, &100);
}

#[test]
#[should_panic(expected = "reward_amount must be positive")]
fn credit_referrer_zero_amount_panics() {
    let (env, _admin, client) = setup();
    let referrer = Address::generate(&env);
    let referred = Address::generate(&env);
    client.register_referral(&referrer, &referred);
    client.credit_referrer(&referred, &0);
}

// ── total_referrals ───────────────────────────────────────────────────────────

#[test]
fn total_referrals_zero_for_unknown_referrer() {
    let (env, _admin, client) = setup();
    let stranger = Address::generate(&env);
    assert_eq!(client.total_referrals(&stranger), 0);
}

// ── boundary ──────────────────────────────────────────────────────────────────

#[test]
fn different_referrers_have_independent_counters() {
    let (env, _admin, client) = setup();
    let r1 = Address::generate(&env);
    let r2 = Address::generate(&env);
    client.register_referral(&r1, &Address::generate(&env));
    client.register_referral(&r1, &Address::generate(&env));
    client.register_referral(&r2, &Address::generate(&env));
    assert_eq!(client.total_referrals(&r1), 2);
    assert_eq!(client.total_referrals(&r2), 1);
}
