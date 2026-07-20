#![cfg(test)]

//! Integration tests for the RewardPool contract.
//!
//! These tests exercise multi-step deposit → withdraw flows and verify
//! that the contract state remains consistent across operations.

use soroban_sdk::{
    contract, contractimpl,
    testutils::{Address as _, Ledger as _},
    Address, Env, IntoVal, Symbol, Val,
};

use reward_pool::{PoolError, RewardPoolContract, RewardPoolContractClient};

// ---------------------------------------------------------------------------
// Minimal Nova token mock (same as claim_test.rs)
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
    pool.initialize(&admin, &token_id);

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
// Integration tests
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
    s.pool.set_locked_until(&unlock_at);

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

    // One more should fail
    let result = s.pool.try_withdraw(&recipient, &1);
    assert_eq!(result, Err(Ok(PoolError::InsufficientBalance)));
}
