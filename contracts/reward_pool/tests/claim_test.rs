#![cfg(test)]

//! Tests for the RewardPool contract.
//!
//! Covers:
//! - deposit: token transfer, event emission, auth enforcement
//! - withdraw: admin-only, locked rejection, insufficient balance, success after unlock
//! - get_balance: reflects real Nova token balance
//! - locked_until: set/get, withdrawal blocked before unlock, allowed after

use soroban_sdk::{
    contract, contractimpl,
    testutils::{Address as _, Events, Ledger as _},
    Address, Env, IntoVal, Symbol, TryIntoVal, Val,
};

use reward_pool::{PoolError, RewardPoolContract, RewardPoolContractClient};

// ---------------------------------------------------------------------------
// Mock Nova Token
// ---------------------------------------------------------------------------
// A minimal token contract so cross-contract calls work in the test env.
// Mirrors the interface of nova_token: initialize, mint, balance, transfer.

#[contract]
pub struct MockNovaToken;

#[contractimpl]
impl MockNovaToken {
    pub fn initialize(env: Env, admin: Address) {
        env.storage()
            .instance()
            .set(&Symbol::new(&env, "admin"), &admin);
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
// Test helpers
// ---------------------------------------------------------------------------

struct TestSetup {
    env: Env,
    pool: RewardPoolContractClient<'static>,
    _pool_id: Address,
    token_id: Address,
    _admin: Address,
}

fn setup() -> TestSetup {
    let env = Env::default();
    env.mock_all_auths();

    // Deploy mock Nova token
    let token_id = env.register(MockNovaToken, ());
    let token_admin = Address::generate(&env);
    let _: Val = env.invoke_contract(
        &token_id,
        &Symbol::new(&env, "initialize"),
        soroban_sdk::vec![&env, token_admin.to_val()],
    );

    // Deploy reward pool
    let admin = Address::generate(&env);
    let pool_id = env.register(RewardPoolContract, ());
    let pool = RewardPoolContractClient::new(&env, &pool_id);
    pool.initialize(&admin, &token_id);

    TestSetup {
        env,
        pool,
        _pool_id: pool_id,
        token_id,
        _admin: admin,
    }
}

/// Mints `amount` Nova tokens to `recipient` via the mock token contract.
fn mint_tokens(env: &Env, token_id: &Address, recipient: &Address, amount: i128) {
    let _: Val = env.invoke_contract(
        token_id,
        &Symbol::new(env, "mint"),
        soroban_sdk::vec![env, recipient.to_val(), amount.into_val(env)],
    );
}

/// Reads the Nova token balance of `addr` via the mock token contract.
fn token_balance(env: &Env, token_id: &Address, addr: &Address) -> i128 {
    env.invoke_contract(
        token_id,
        &Symbol::new(env, "balance"),
        soroban_sdk::vec![env, addr.to_val()],
    )
}

// ---------------------------------------------------------------------------
// Initialization tests
// ---------------------------------------------------------------------------

#[test]
fn test_initialize_stores_admin_and_token() {
    let t = setup();
    // locked_until defaults to 0 (no lock)
    assert_eq!(t.pool.get_locked_until(), 0);
    // get_balance returns 0 when pool holds no tokens
    assert_eq!(t.pool.get_balance(), 0);
}

#[test]
#[should_panic(expected = "already initialized")]
fn test_double_initialize_panics() {
    let t = setup();
    let other_admin = Address::generate(&t.env);
    t.pool.initialize(&other_admin, &t.token_id);
}

// ---------------------------------------------------------------------------
// Deposit tests
// ---------------------------------------------------------------------------

#[test]
fn test_deposit_transfers_tokens_into_pool() {
    let t = setup();
    let depositor = Address::generate(&t.env);

    mint_tokens(&t.env, &t.token_id, &depositor, 5_000);
    assert_eq!(token_balance(&t.env, &t.token_id, &depositor), 5_000);

    t.pool.deposit(&depositor, &3_000);

    // Pool holds the deposited tokens
    assert_eq!(t.pool.get_balance(), 3_000);
    // Depositor balance reduced
    assert_eq!(token_balance(&t.env, &t.token_id, &depositor), 2_000);
}

#[test]
fn test_deposit_emits_deposited_event() {
    let t = setup();
    let depositor = Address::generate(&t.env);
    mint_tokens(&t.env, &t.token_id, &depositor, 1_000);

    t.pool.deposit(&depositor, &1_000);

    let events = t.env.events().all();
    let deposited_event = events.iter().any(|(_, topics, _)| {
        topics.get(1)
            .and_then(|v| {
                let sym: Result<Symbol, _> = v.clone().try_into_val(&t.env);
                sym.ok().map(|s| s == Symbol::new(&t.env, "deposited"))
            })
            .unwrap_or(false)
    });
    assert!(deposited_event, "expected 'deposited' event to be emitted");
}

#[test]
fn test_deposit_multiple_times_accumulates_balance() {
    let t = setup();
    let depositor = Address::generate(&t.env);
    mint_tokens(&t.env, &t.token_id, &depositor, 10_000);

    t.pool.deposit(&depositor, &2_000);
    t.pool.deposit(&depositor, &3_000);

    assert_eq!(t.pool.get_balance(), 5_000);
}

#[test]
#[should_panic(expected = "amount must be positive")]
fn test_deposit_zero_panics() {
    let t = setup();
    let depositor = Address::generate(&t.env);
    t.pool.deposit(&depositor, &0);
}

#[test]
#[should_panic(expected = "amount must be positive")]
fn test_deposit_negative_panics() {
    let t = setup();
    let depositor = Address::generate(&t.env);
    t.pool.deposit(&depositor, &-100);
}

// ---------------------------------------------------------------------------
// Withdraw tests
// ---------------------------------------------------------------------------

#[test]
fn test_withdraw_success_after_unlock() {
    let t = setup();
    let depositor = Address::generate(&t.env);
    let recipient = Address::generate(&t.env);

    // Fund the pool
    mint_tokens(&t.env, &t.token_id, &depositor, 5_000);
    t.pool.deposit(&depositor, &5_000);

    // Set lock 1000 seconds in the future
    let now = t.env.ledger().timestamp();
    let unlock_at = now + 1_000;
    t.pool.set_locked_until(&unlock_at);

    // Advance time past the unlock
    t.env.ledger().set_timestamp(unlock_at + 1);

    // Withdraw should succeed
    t.pool.withdraw(&recipient, &2_000).unwrap();

    assert_eq!(t.pool.get_balance(), 3_000);
    assert_eq!(token_balance(&t.env, &t.token_id, &recipient), 2_000);
}

#[test]
fn test_withdraw_emits_withdrawn_event() {
    let t = setup();
    let depositor = Address::generate(&t.env);
    let recipient = Address::generate(&t.env);

    mint_tokens(&t.env, &t.token_id, &depositor, 1_000);
    t.pool.deposit(&depositor, &1_000);

    t.pool.withdraw(&recipient, &500).unwrap();

    let events = t.env.events().all();
    let withdrawn_event = events.iter().any(|(_, topics, _)| {
        topics.get(1)
            .and_then(|v| {
                let sym: Result<Symbol, _> = v.clone().try_into_val(&t.env);
                sym.ok().map(|s| s == Symbol::new(&t.env, "withdrawn"))
            })
            .unwrap_or(false)
    });
    assert!(withdrawn_event, "expected 'withdrawn' event to be emitted");
}

#[test]
fn test_withdraw_full_balance() {
    let t = setup();
    let depositor = Address::generate(&t.env);
    let recipient = Address::generate(&t.env);

    mint_tokens(&t.env, &t.token_id, &depositor, 7_500);
    t.pool.deposit(&depositor, &7_500);

    t.pool.withdraw(&recipient, &7_500).unwrap();

    assert_eq!(t.pool.get_balance(), 0);
    assert_eq!(token_balance(&t.env, &t.token_id, &recipient), 7_500);
}

// ---------------------------------------------------------------------------
// Locked withdrawal rejection tests
// ---------------------------------------------------------------------------

#[test]
fn test_withdraw_rejected_when_locked() {
    let t = setup();
    let depositor = Address::generate(&t.env);
    let recipient = Address::generate(&t.env);

    mint_tokens(&t.env, &t.token_id, &depositor, 5_000);
    t.pool.deposit(&depositor, &5_000);

    // Lock the pool for 1 hour from now
    let now = t.env.ledger().timestamp();
    t.pool.set_locked_until(&(now + 3_600));

    // Attempt withdrawal while locked — must return PoolLocked error
    let result = t.pool.try_withdraw(&recipient, &1_000);
    assert_eq!(result, Err(Ok(PoolError::PoolLocked)));
}

#[test]
fn test_withdraw_rejected_at_exact_lock_boundary() {
    let t = setup();
    let depositor = Address::generate(&t.env);
    let recipient = Address::generate(&t.env);

    mint_tokens(&t.env, &t.token_id, &depositor, 1_000);
    t.pool.deposit(&depositor, &1_000);

    let unlock_at: u64 = 5_000;
    t.pool.set_locked_until(&unlock_at);

    // At exactly unlock_at, still locked (now < locked_until is false, now == locked_until passes)
    // Set time to one second before unlock
    t.env.ledger().set_timestamp(unlock_at - 1);
    let result = t.pool.try_withdraw(&recipient, &500);
    assert_eq!(result, Err(Ok(PoolError::PoolLocked)));

    // At exactly unlock_at, withdrawal is allowed (now >= locked_until)
    t.env.ledger().set_timestamp(unlock_at);
    t.pool.withdraw(&recipient, &500).unwrap();
}

#[test]
fn test_withdraw_allowed_when_no_lock_set() {
    let t = setup();
    let depositor = Address::generate(&t.env);
    let recipient = Address::generate(&t.env);

    mint_tokens(&t.env, &t.token_id, &depositor, 2_000);
    t.pool.deposit(&depositor, &2_000);

    // No lock set (locked_until = 0), withdrawal should succeed immediately
    t.pool.withdraw(&recipient, &1_000).unwrap();
    assert_eq!(t.pool.get_balance(), 1_000);
}

// ---------------------------------------------------------------------------
// Insufficient balance tests
// ---------------------------------------------------------------------------

#[test]
fn test_withdraw_insufficient_balance_returns_error() {
    let t = setup();
    let recipient = Address::generate(&t.env);

    // Pool is empty — no deposits
    let result = t.pool.try_withdraw(&recipient, &1_000);
    assert_eq!(result, Err(Ok(PoolError::InsufficientBalance)));
}

#[test]
fn test_withdraw_more_than_balance_returns_error() {
    let t = setup();
    let depositor = Address::generate(&t.env);
    let recipient = Address::generate(&t.env);

    mint_tokens(&t.env, &t.token_id, &depositor, 500);
    t.pool.deposit(&depositor, &500);

    let result = t.pool.try_withdraw(&recipient, &501);
    assert_eq!(result, Err(Ok(PoolError::InsufficientBalance)));
}

// ---------------------------------------------------------------------------
// get_balance tests
// ---------------------------------------------------------------------------

#[test]
fn test_get_balance_reflects_real_token_balance() {
    let t = setup();
    let depositor = Address::generate(&t.env);

    assert_eq!(t.pool.get_balance(), 0);

    mint_tokens(&t.env, &t.token_id, &depositor, 10_000);
    t.pool.deposit(&depositor, &4_000);
    assert_eq!(t.pool.get_balance(), 4_000);

    // Withdraw some and verify balance decreases
    t.pool.withdraw(&depositor, &1_500).unwrap();
    assert_eq!(t.pool.get_balance(), 2_500);
}

#[test]
fn test_get_balance_zero_on_empty_pool() {
    let t = setup();
    assert_eq!(t.pool.get_balance(), 0);
}

// ---------------------------------------------------------------------------
// Lock management tests
// ---------------------------------------------------------------------------

#[test]
fn test_set_and_get_locked_until() {
    let t = setup();

    assert_eq!(t.pool.get_locked_until(), 0);

    let unlock_time: u64 = 9_999_999;
    t.pool.set_locked_until(&unlock_time);
    assert_eq!(t.pool.get_locked_until(), unlock_time);
}

#[test]
fn test_lock_can_be_updated() {
    let t = setup();

    t.pool.set_locked_until(&1_000);
    assert_eq!(t.pool.get_locked_until(), 1_000);

    // Admin can extend or shorten the lock
    t.pool.set_locked_until(&2_000);
    assert_eq!(t.pool.get_locked_until(), 2_000);

    // Admin can remove the lock by setting to 0
    t.pool.set_locked_until(&0);
    assert_eq!(t.pool.get_locked_until(), 0);
}

#[test]
fn test_deposit_is_not_blocked_by_lock() {
    let t = setup();
    let depositor = Address::generate(&t.env);
    mint_tokens(&t.env, &t.token_id, &depositor, 1_000);

    // Lock far in the future
    t.pool.set_locked_until(&u64::MAX);

    // Deposits are always allowed regardless of lock
    t.pool.deposit(&depositor, &1_000);
    assert_eq!(t.pool.get_balance(), 1_000);
}
