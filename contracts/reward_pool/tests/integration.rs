#![cfg(test)]

//! Integration tests for the RewardPool contract.
//!
//! These tests exercise multi-step deposit → withdraw flows and verify
//! that the contract state (token balances, treasury, lock) remains
//! consistent across operations, including fee accumulation scenarios.

use soroban_sdk::{
    contract, contractimpl,
    testutils::{Address as _, Ledger as _},
    Address, Env, IntoVal, Symbol, Val,
};

use reward_pool::{PoolError, RewardPoolContract, RewardPoolContractClient};

// ---------------------------------------------------------------------------
// Minimal Nova token mock
// ---------------------------------------------------------------------------

#[contract]
pub struct MockToken;

#[contractimpl]
impl MockToken {
    pub fn initialize(env: Env, _admin: Address) {
        env.storage()
            .instance()
            .set(&Symbol::new(&env, "init"), &true);
    }

    pub fn mint(env: Env, to: Address, amount: i128) {
        let bal = Self::balance(env.clone(), to.clone());
        env.storage()
            .instance()
            .set(&to.clone().to_xdr(&env), &(bal + amount));
    }

    pub fn balance(env: Env, addr: Address) -> i128 {
        env.storage()
            .instance()
            .get::<_, i128>(&addr.clone().to_xdr(&env))
            .unwrap_or(0)
    }

    pub fn transfer(env: Env, from: Address, to: Address, amount: i128) {
        let from_bal = Self::balance(env.clone(), from.clone());
        assert!(from_bal >= amount, "insufficient balance");
        env.storage()
            .instance()
            .set(&from.clone().to_xdr(&env), &(from_bal - amount));
        let to_bal = Self::balance(env.clone(), to.clone());
        env.storage()
            .instance()
            .set(&to.clone().to_xdr(&env), &(to_bal + amount));
    }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

struct Setup {
    env: Env,
    pool: RewardPoolContractClient<'static>,
    token_id: Address,
}

fn setup() -> Setup {
    let env = Env::default();
    env.mock_all_auths();

    let token_id = env.register(MockToken, ());
    let token_admin = Address::generate(&env);
    let _: Val = env.invoke_contract(
        &token_id,
        &Symbol::new(&env, "initialize"),
        soroban_sdk::vec![&env, token_admin.to_val()],
    );

    let admin = Address::generate(&env);
    let pool_id = env.register(RewardPoolContract, ());
    let pool = RewardPoolContractClient::new(&env, &pool_id);
    pool.initialize(&admin, &token_id).unwrap();

    Setup { env, pool, token_id }
}

fn mint(env: &Env, token_id: &Address, to: &Address, amount: i128) {
    let _: Val = env.invoke_contract(
        token_id,
        &Symbol::new(env, "mint"),
        soroban_sdk::vec![env, to.to_val(), amount.into_val(env)],
    );
}

fn token_balance(env: &Env, token_id: &Address, addr: &Address) -> i128 {
    env.invoke_contract(
        token_id,
        &Symbol::new(env, "balance"),
        soroban_sdk::vec![env, addr.to_val()],
    )
}

// ---------------------------------------------------------------------------
// Basic deposit → withdraw flow
// ---------------------------------------------------------------------------

#[test]
fn test_deposit_then_withdraw_full_cycle() {
    let s = setup();
    let depositor = Address::generate(&s.env);
    let recipient = Address::generate(&s.env);

    mint(&s.env, &s.token_id, &depositor, 10_000);

    s.pool.deposit(&depositor, &10_000);
    assert_eq!(s.pool.get_balance(), 10_000);
    assert_eq!(token_balance(&s.env, &s.token_id, &depositor), 0);

    s.pool.withdraw(&recipient, &10_000).unwrap();
    assert_eq!(s.pool.get_balance(), 0);
    assert_eq!(token_balance(&s.env, &s.token_id, &recipient), 10_000);
}

#[test]
fn test_multiple_depositors_single_withdrawal() {
    let s = setup();
    let alice = Address::generate(&s.env);
    let bob = Address::generate(&s.env);
    let recipient = Address::generate(&s.env);

    mint(&s.env, &s.token_id, &alice, 3_000);
    mint(&s.env, &s.token_id, &bob, 7_000);

    s.pool.deposit(&alice, &3_000);
    s.pool.deposit(&bob, &7_000);
    assert_eq!(s.pool.get_balance(), 10_000);

    s.pool.withdraw(&recipient, &5_000).unwrap();
    assert_eq!(s.pool.get_balance(), 5_000);
    assert_eq!(token_balance(&s.env, &s.token_id, &recipient), 5_000);
}

#[test]
fn test_lock_then_unlock_then_withdraw() {
    let s = setup();
    let depositor = Address::generate(&s.env);
    let recipient = Address::generate(&s.env);

    mint(&s.env, &s.token_id, &depositor, 4_000);
    s.pool.deposit(&depositor, &4_000);

    // Lock for 2 hours
    let now = s.env.ledger().timestamp();
    let unlock_at = now + 7_200;
    s.pool.set_locked_until(&unlock_at).unwrap();

    // Withdrawal blocked
    let result = s.pool.try_withdraw(&recipient, &1_000);
    assert_eq!(result, Err(Ok(PoolError::PoolLocked)));

    // Advance past unlock
    s.env.ledger().set_timestamp(unlock_at + 1);

    // Withdrawal succeeds
    s.pool.withdraw(&recipient, &4_000).unwrap();
    assert_eq!(s.pool.get_balance(), 0);
}

#[test]
fn test_partial_withdrawals_drain_pool() {
    let s = setup();
    let depositor = Address::generate(&s.env);
    let recipient = Address::generate(&s.env);

    mint(&s.env, &s.token_id, &depositor, 9_000);
    s.pool.deposit(&depositor, &9_000);

    s.pool.withdraw(&recipient, &3_000).unwrap();
    assert_eq!(s.pool.get_balance(), 6_000);

    s.pool.withdraw(&recipient, &3_000).unwrap();
    assert_eq!(s.pool.get_balance(), 3_000);

    s.pool.withdraw(&recipient, &3_000).unwrap();
    assert_eq!(s.pool.get_balance(), 0);

    // Empty pool → InsufficientBalance
    let result = s.pool.try_withdraw(&recipient, &1);
    assert_eq!(result, Err(Ok(PoolError::InsufficientBalance)));
}

// ---------------------------------------------------------------------------
// Fee accumulation integration tests
// ---------------------------------------------------------------------------

/// Zero fee (default): full withdraw cycle without any fee.
#[test]
fn test_zero_fee_full_cycle() {
    let s = setup();
    let treasury = Address::generate(&s.env);
    let depositor = Address::generate(&s.env);
    let recipient = Address::generate(&s.env);

    s.pool.update_treasury(&treasury).unwrap();
    // fee_bps == 0 by default

    mint(&s.env, &s.token_id, &depositor, 10_000);
    s.pool.deposit(&depositor, &10_000);

    s.pool.withdraw(&recipient, &3_000).unwrap();

    assert_eq!(token_balance(&s.env, &s.token_id, &recipient), 3_000);
    assert_eq!(s.pool.get_treasury_balance(), 0);
    assert_eq!(s.pool.get_balance(), 7_000);
}

/// 1 % fee: verify recipient and treasury balances after multiple withdrawals.
#[test]
fn test_1pct_fee_accumulates_in_treasury() {
    let s = setup();
    let treasury = Address::generate(&s.env);
    let depositor = Address::generate(&s.env);
    let recipient = Address::generate(&s.env);

    s.pool.update_fee(&100u32).unwrap(); // 1 %
    s.pool.update_treasury(&treasury).unwrap();

    mint(&s.env, &s.token_id, &depositor, 100_000);
    s.pool.deposit(&depositor, &100_000);

    // Withdrawal 1: gross 10_000 → fee 100, net 9_900
    s.pool.withdraw(&recipient, &10_000).unwrap();
    // Withdrawal 2: gross 20_000 → fee 200, net 19_800
    s.pool.withdraw(&recipient, &20_000).unwrap();

    let expected_treasury = 100 + 200;          // 300
    let expected_recipient = 9_900 + 19_800;    // 29_700
    let expected_pool = 100_000 - 10_000 - 20_000; // 70_000

    assert_eq!(s.pool.get_treasury_balance(), expected_treasury);
    assert_eq!(token_balance(&s.env, &s.token_id, &recipient), expected_recipient);
    assert_eq!(s.pool.get_balance(), expected_pool);
}

/// 10 % fee: verify recipient and treasury balances.
#[test]
fn test_10pct_fee_integration() {
    let s = setup();
    let treasury = Address::generate(&s.env);
    let depositor = Address::generate(&s.env);
    let recipient = Address::generate(&s.env);

    s.pool.update_fee(&1_000u32).unwrap(); // 10 %
    s.pool.update_treasury(&treasury).unwrap();

    mint(&s.env, &s.token_id, &depositor, 50_000);
    s.pool.deposit(&depositor, &50_000);

    s.pool.withdraw(&recipient, &10_000).unwrap();

    // fee = 10_000 * 1_000 / 10_000 = 1_000
    assert_eq!(token_balance(&s.env, &s.token_id, &recipient), 9_000);
    assert_eq!(s.pool.get_treasury_balance(), 1_000);
    assert_eq!(s.pool.get_balance(), 40_000);
}

/// Treasury address can be changed mid-operation; fees go to new treasury.
#[test]
fn test_treasury_update_redirects_fees() {
    let s = setup();
    let treasury1 = Address::generate(&s.env);
    let treasury2 = Address::generate(&s.env);
    let depositor = Address::generate(&s.env);
    let recipient = Address::generate(&s.env);

    s.pool.update_fee(&500u32).unwrap(); // 5 %
    s.pool.update_treasury(&treasury1).unwrap();

    mint(&s.env, &s.token_id, &depositor, 100_000);
    s.pool.deposit(&depositor, &100_000);

    // First withdrawal: fee → treasury1
    s.pool.withdraw(&recipient, &2_000).unwrap();
    // fee = 100

    // Change treasury
    s.pool.update_treasury(&treasury2).unwrap();

    // Second withdrawal: fee → treasury2
    s.pool.withdraw(&recipient, &2_000).unwrap();
    // fee = 100

    assert_eq!(token_balance(&s.env, &s.token_id, &treasury1), 100);
    assert_eq!(token_balance(&s.env, &s.token_id, &treasury2), 100);
}

/// Fee is 0 when fee_bps is explicitly set to 0 after being non-zero.
#[test]
fn test_fee_disabled_after_update() {
    let s = setup();
    let treasury = Address::generate(&s.env);
    let depositor = Address::generate(&s.env);
    let recipient = Address::generate(&s.env);

    s.pool.update_fee(&300u32).unwrap(); // 3 %
    s.pool.update_treasury(&treasury).unwrap();

    mint(&s.env, &s.token_id, &depositor, 50_000);
    s.pool.deposit(&depositor, &50_000);

    // First withdrawal at 3 %
    s.pool.withdraw(&recipient, &1_000).unwrap();
    // fee = 30

    // Disable fee
    s.pool.update_fee(&0u32).unwrap();

    // Second withdrawal at 0 %
    s.pool.withdraw(&recipient, &1_000).unwrap();
    // fee = 0

    // Treasury only received fee from first withdrawal
    assert_eq!(s.pool.get_treasury_balance(), 30);
    // Recipient got: 970 + 1_000 = 1_970
    assert_eq!(token_balance(&s.env, &s.token_id, &recipient), 1_970);
}

/// Insufficient balance with fee enabled returns InsufficientBalance.
#[test]
fn test_insufficient_balance_with_fee() {
    let s = setup();
    let treasury = Address::generate(&s.env);
    let depositor = Address::generate(&s.env);
    let recipient = Address::generate(&s.env);

    s.pool.update_fee(&500u32).unwrap();
    s.pool.update_treasury(&treasury).unwrap();

    mint(&s.env, &s.token_id, &depositor, 100);
    s.pool.deposit(&depositor, &100);

    // Try to withdraw more than available
    let result = s.pool.try_withdraw(&recipient, &101);
    assert_eq!(result, Err(Ok(PoolError::InsufficientBalance)));
}
