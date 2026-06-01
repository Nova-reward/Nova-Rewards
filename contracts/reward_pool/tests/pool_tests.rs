#![cfg(test)]

use reward_pool::RewardPool;
use reward_pool::RewardPoolClient;
use soroban_sdk::{testutils::Address as _, Address, Env};

fn setup() -> (Env, Address, RewardPoolClient<'static>) {
    let env = Env::default();
    env.mock_all_auths();
    let id = env.register(RewardPool, ());
    let client = RewardPoolClient::new(&env, &id);
    let admin = Address::generate(&env);
    client.initialize(&admin);
    (env, admin, client)
}

// ── initialize ────────────────────────────────────────────────────────────────

#[test]
fn initialize_sets_zero_balance() {
    let (_env, _admin, client) = setup();
    assert_eq!(client.balance(), 0);
}

#[test]
#[should_panic(expected = "already initialised")]
fn initialize_twice_panics() {
    let (_env, admin, client) = setup();
    client.initialize(&admin);
}

// ── deposit ───────────────────────────────────────────────────────────────────

#[test]
fn deposit_increases_balance() {
    let (env, _admin, client) = setup();
    let user = Address::generate(&env);
    client.deposit(&user, &1_000);
    assert_eq!(client.balance(), 1_000);
}

#[test]
fn multiple_deposits_accumulate() {
    let (env, _admin, client) = setup();
    let user = Address::generate(&env);
    client.deposit(&user, &400);
    client.deposit(&user, &600);
    assert_eq!(client.balance(), 1_000);
}

#[test]
fn deposits_from_different_users_accumulate() {
    let (env, _admin, client) = setup();
    let u1 = Address::generate(&env);
    let u2 = Address::generate(&env);
    client.deposit(&u1, &300);
    client.deposit(&u2, &700);
    assert_eq!(client.balance(), 1_000);
}

#[test]
#[should_panic(expected = "amount must be positive")]
fn deposit_zero_panics() {
    let (env, _admin, client) = setup();
    let user = Address::generate(&env);
    client.deposit(&user, &0);
}

#[test]
#[should_panic(expected = "amount must be positive")]
fn deposit_negative_panics() {
    let (env, _admin, client) = setup();
    let user = Address::generate(&env);
    client.deposit(&user, &-1);
}

// ── withdraw ──────────────────────────────────────────────────────────────────

#[test]
fn withdraw_decreases_balance() {
    let (env, admin, client) = setup();
    let user = Address::generate(&env);
    client.deposit(&user, &1_000);
    client.withdraw(&admin, &400);
    assert_eq!(client.balance(), 600);
}

#[test]
fn withdraw_entire_balance() {
    let (env, admin, client) = setup();
    let user = Address::generate(&env);
    client.deposit(&user, &500);
    client.withdraw(&admin, &500);
    assert_eq!(client.balance(), 0);
}

#[test]
#[should_panic(expected = "insufficient pool balance")]
fn withdraw_more_than_balance_panics() {
    let (env, admin, client) = setup();
    let user = Address::generate(&env);
    client.deposit(&user, &100);
    client.withdraw(&admin, &101);
}

#[test]
#[should_panic(expected = "insufficient pool balance")]
fn withdraw_from_empty_pool_panics() {
    let (_env, admin, client) = setup();
    client.withdraw(&admin, &1);
}

#[test]
#[should_panic(expected = "amount must be positive")]
fn withdraw_zero_panics() {
    let (_env, admin, client) = setup();
    client.withdraw(&admin, &0);
}

// ── boundary ──────────────────────────────────────────────────────────────────

#[test]
fn deposit_and_withdraw_large_amount() {
    let (env, admin, client) = setup();
    let user = Address::generate(&env);
    let large: i128 = i64::MAX as i128;
    client.deposit(&user, &large);
    assert_eq!(client.balance(), large);
    client.withdraw(&admin, &large);
    assert_eq!(client.balance(), 0);
}
