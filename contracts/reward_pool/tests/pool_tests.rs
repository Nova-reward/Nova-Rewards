#![cfg(test)]

//! Unit tests for the RewardPool contract.
//!
//! Covers:
//! - Initialization (once, twice panics)
//! - Deposit (token transfer, events, auth, edge cases)
//! - Withdraw (admin-only, lock rejection, insufficient balance, success)
//! - Fee accumulation (zero-fee, various bps, treasury accumulation)
//! - Treasury balance query
//! - Lock management

use soroban_sdk::{
    contract, contractimpl,
    testutils::{Address as _, Events, Ledger as _},
    Address, Env, IntoVal, Symbol, TryIntoVal, Val,
};

use reward_pool::{PoolError, RewardPoolContract, RewardPoolContractClient};

// ---------------------------------------------------------------------------
// Mock Nova Token
// ---------------------------------------------------------------------------

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
    pool_id: Address,
    token_id: Address,
    admin: Address,
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
    pool.initialize(&admin, &token_id).unwrap();

    TestSetup {
        env,
        pool,
        pool_id,
        token_id,
        admin,
    }
}

fn mint_tokens(env: &Env, token_id: &Address, recipient: &Address, amount: i128) {
    let _: Val = env.invoke_contract(
        token_id,
        &Symbol::new(env, "mint"),
        soroban_sdk::vec![env, recipient.to_val(), amount.into_val(env)],
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
// Initialization tests
// ---------------------------------------------------------------------------

#[test]
fn test_initialize_stores_admin_and_token() {
    let t = setup();
    assert_eq!(t.pool.get_locked_until(), 0);
    assert_eq!(t.pool.get_balance(), 0);
    assert_eq!(t.pool.get_fee_bps(), 0);
}

#[test]
fn test_double_initialize_returns_already_initialized() {
    let t = setup();
    let result = t.pool.initialize(&t.admin, &t.token_id);
    assert_eq!(result, Err(Ok(PoolError::AlreadyInitialized)));
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

    assert_eq!(t.pool.get_balance(), 3_000);
    assert_eq!(token_balance(&t.env, &t.token_id, &depositor), 2_000);
    assert_eq!(token_balance(&t.env, &t.token_id, &t.pool_id), 3_000);
}

#[test]
fn test_deposit_emits_deposited_event() {
    let t = setup();
    let depositor = Address::generate(&t.env);
    mint_tokens(&t.env, &t.token_id, &depositor, 1_000);

    t.pool.deposit(&depositor, &1_000);

    let events = t.env.events().all();
    let found = events.iter().any(|(_, topics, _)| {
        topics
            .get(1)
            .and_then(|v| {
                let sym: Result<Symbol, _> = v.clone().try_into_val(&t.env);
                sym.ok().map(|s| s == Symbol::new(&t.env, "deposited"))
            })
            .unwrap_or(false)
    });
    assert!(found, "expected 'deposited' event");
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
// Withdraw tests (no fee)
// ---------------------------------------------------------------------------

#[test]
fn test_withdraw_success_no_fee() {
    let t = setup();
    let depositor = Address::generate(&t.env);
    let recipient = Address::generate(&t.env);

    mint_tokens(&t.env, &t.token_id, &depositor, 5_000);
    t.pool.deposit(&depositor, &5_000);

    t.pool.withdraw(&recipient, &2_000).unwrap();

    assert_eq!(t.pool.get_balance(), 3_000);
    assert_eq!(token_balance(&t.env, &t.token_id, &recipient), 2_000);
}

#[test]
fn test_withdraw_full_balance_no_fee() {
    let t = setup();
    let depositor = Address::generate(&t.env);
    let recipient = Address::generate(&t.env);

    mint_tokens(&t.env, &t.token_id, &depositor, 7_500);
    t.pool.deposit(&depositor, &7_500);

    t.pool.withdraw(&recipient, &7_500).unwrap();

    assert_eq!(t.pool.get_balance(), 0);
    assert_eq!(token_balance(&t.env, &t.token_id, &recipient), 7_500);
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
    let found = events.iter().any(|(_, topics, _)| {
        topics
            .get(1)
            .and_then(|v| {
                let sym: Result<Symbol, _> = v.clone().try_into_val(&t.env);
                sym.ok().map(|s| s == Symbol::new(&t.env, "withdrawn"))
            })
            .unwrap_or(false)
    });
    assert!(found, "expected 'withdrawn' event");
}

#[test]
fn test_withdraw_rejected_when_locked() {
    let t = setup();
    let depositor = Address::generate(&t.env);
    let recipient = Address::generate(&t.env);

    mint_tokens(&t.env, &t.token_id, &depositor, 5_000);
    t.pool.deposit(&depositor, &5_000);

    let now = t.env.ledger().timestamp();
    t.pool.set_locked_until(&(now + 3_600)).unwrap();

    let result = t.pool.try_withdraw(&recipient, &1_000);
    assert_eq!(result, Err(Ok(PoolError::PoolLocked)));
}

#[test]
fn test_withdraw_allowed_after_unlock() {
    let t = setup();
    let depositor = Address::generate(&t.env);
    let recipient = Address::generate(&t.env);

    mint_tokens(&t.env, &t.token_id, &depositor, 5_000);
    t.pool.deposit(&depositor, &5_000);

    let now = t.env.ledger().timestamp();
    let unlock_at = now + 1_000;
    t.pool.set_locked_until(&unlock_at).unwrap();

    t.env.ledger().set_timestamp(unlock_at + 1);

    t.pool.withdraw(&recipient, &2_000).unwrap();
    assert_eq!(t.pool.get_balance(), 3_000);
}

#[test]
fn test_withdraw_insufficient_balance_returns_error() {
    let t = setup();
    let recipient = Address::generate(&t.env);

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
// Fee accumulation tests
// ---------------------------------------------------------------------------

/// Zero fee (default): recipient gets the full gross amount, treasury stays empty.
#[test]
fn test_zero_fee_recipient_gets_full_amount() {
    let t = setup();
    let treasury = Address::generate(&t.env);
    let depositor = Address::generate(&t.env);
    let recipient = Address::generate(&t.env);

    // Fee is 0 by default, but set treasury anyway
    t.pool.update_treasury(&treasury).unwrap();

    mint_tokens(&t.env, &t.token_id, &depositor, 10_000);
    t.pool.deposit(&depositor, &10_000);

    t.pool.withdraw(&recipient, &1_000).unwrap();

    // Recipient gets gross
    assert_eq!(token_balance(&t.env, &t.token_id, &recipient), 1_000);
    // Treasury stays 0
    assert_eq!(t.pool.get_treasury_balance(), 0);
}

/// 100 bps (1 %) fee: withdraw 1 000 → recipient 990, treasury 10.
#[test]
fn test_100_bps_fee_deducted_correctly() {
    let t = setup();
    let treasury = Address::generate(&t.env);
    let depositor = Address::generate(&t.env);
    let recipient = Address::generate(&t.env);

    t.pool.update_fee(&100u32).unwrap();
    t.pool.update_treasury(&treasury).unwrap();

    mint_tokens(&t.env, &t.token_id, &depositor, 10_000);
    t.pool.deposit(&depositor, &10_000);

    t.pool.withdraw(&recipient, &1_000).unwrap();

    // fee = 1_000 * 100 / 10_000 = 10
    assert_eq!(token_balance(&t.env, &t.token_id, &recipient), 990);
    assert_eq!(token_balance(&t.env, &t.token_id, &treasury), 10);
    assert_eq!(t.pool.get_treasury_balance(), 10);
}

/// 250 bps (2.5 %): withdraw 10 000 → recipient 9 750, treasury 250.
#[test]
fn test_250_bps_fee() {
    let t = setup();
    let treasury = Address::generate(&t.env);
    let depositor = Address::generate(&t.env);
    let recipient = Address::generate(&t.env);

    t.pool.update_fee(&250u32).unwrap();
    t.pool.update_treasury(&treasury).unwrap();

    mint_tokens(&t.env, &t.token_id, &depositor, 20_000);
    t.pool.deposit(&depositor, &20_000);

    t.pool.withdraw(&recipient, &10_000).unwrap();

    // fee = 10_000 * 250 / 10_000 = 250
    assert_eq!(token_balance(&t.env, &t.token_id, &recipient), 9_750);
    assert_eq!(t.pool.get_treasury_balance(), 250);
}

/// 500 bps (5 %): withdraw 200 → recipient 190, treasury 10.
#[test]
fn test_500_bps_fee() {
    let t = setup();
    let treasury = Address::generate(&t.env);
    let depositor = Address::generate(&t.env);
    let recipient = Address::generate(&t.env);

    t.pool.update_fee(&500u32).unwrap();
    t.pool.update_treasury(&treasury).unwrap();

    mint_tokens(&t.env, &t.token_id, &depositor, 10_000);
    t.pool.deposit(&depositor, &10_000);

    t.pool.withdraw(&recipient, &200).unwrap();

    // fee = 200 * 500 / 10_000 = 10
    assert_eq!(token_balance(&t.env, &t.token_id, &recipient), 190);
    assert_eq!(t.pool.get_treasury_balance(), 10);
}

/// 10 000 bps (100 %): all tokens go to treasury, recipient gets 0.
#[test]
fn test_10000_bps_full_fee() {
    let t = setup();
    let treasury = Address::generate(&t.env);
    let depositor = Address::generate(&t.env);
    let recipient = Address::generate(&t.env);

    t.pool.update_fee(&10_000u32).unwrap();
    t.pool.update_treasury(&treasury).unwrap();

    mint_tokens(&t.env, &t.token_id, &depositor, 5_000);
    t.pool.deposit(&depositor, &5_000);

    t.pool.withdraw(&recipient, &1_000).unwrap();

    // fee = 1_000, net = 0
    assert_eq!(token_balance(&t.env, &t.token_id, &recipient), 0);
    assert_eq!(t.pool.get_treasury_balance(), 1_000);
}

/// Multiple withdrawals accumulate in the treasury.
#[test]
fn test_treasury_accumulates_across_multiple_withdrawals() {
    let t = setup();
    let treasury = Address::generate(&t.env);
    let depositor = Address::generate(&t.env);
    let recipient = Address::generate(&t.env);

    t.pool.update_fee(&200u32).unwrap(); // 2 %
    t.pool.update_treasury(&treasury).unwrap();

    mint_tokens(&t.env, &t.token_id, &depositor, 100_000);
    t.pool.deposit(&depositor, &100_000);

    // 3 separate withdrawals
    t.pool.withdraw(&recipient, &10_000).unwrap(); // fee = 200
    t.pool.withdraw(&recipient, &5_000).unwrap();  // fee = 100
    t.pool.withdraw(&recipient, &1_000).unwrap();  // fee = 20

    assert_eq!(t.pool.get_treasury_balance(), 320);
    assert_eq!(
        token_balance(&t.env, &t.token_id, &recipient),
        (10_000 - 200) + (5_000 - 100) + (1_000 - 20)
    );
}

/// Fee accumulation with small amounts: integer truncation is correct.
#[test]
fn test_fee_truncation_small_amount() {
    let t = setup();
    let treasury = Address::generate(&t.env);
    let depositor = Address::generate(&t.env);
    let recipient = Address::generate(&t.env);

    // 100 bps = 1 %
    t.pool.update_fee(&100u32).unwrap();
    t.pool.update_treasury(&treasury).unwrap();

    mint_tokens(&t.env, &t.token_id, &depositor, 10_000);
    t.pool.deposit(&depositor, &10_000);

    // amount=1: fee = 1 * 100 / 10_000 = 0 (truncated)
    t.pool.withdraw(&recipient, &1).unwrap();
    assert_eq!(token_balance(&t.env, &t.token_id, &recipient), 1);
    // Treasury gets nothing from sub-unit withdrawals
    assert_eq!(t.pool.get_treasury_balance(), 0);
}

/// Withdraw with fee_bps > 0 but no treasury set → TreasuryNotSet error.
#[test]
fn test_withdraw_with_fee_no_treasury_returns_error() {
    let t = setup();
    let depositor = Address::generate(&t.env);
    let recipient = Address::generate(&t.env);

    t.pool.update_fee(&100u32).unwrap(); // No treasury configured

    mint_tokens(&t.env, &t.token_id, &depositor, 5_000);
    t.pool.deposit(&depositor, &5_000);

    let result = t.pool.try_withdraw(&recipient, &1_000);
    assert_eq!(result, Err(Ok(PoolError::TreasuryNotSet)));
}

/// Invalid fee bps > 10 000 returns error.
#[test]
fn test_update_fee_above_max_returns_error() {
    let t = setup();
    let result = t.pool.update_fee(&10_001u32);
    assert_eq!(result, Err(Ok(PoolError::InvalidFeeBps)));
}

/// update_fee at exact max (10 000) succeeds.
#[test]
fn test_update_fee_at_max_succeeds() {
    let t = setup();
    let result = t.pool.update_fee(&10_000u32);
    assert!(result.is_ok());
    assert_eq!(t.pool.get_fee_bps(), 10_000);
}

/// Fee emits fee_coll event with correct (gross, fee, net) data.
#[test]
fn test_fee_collected_event_emitted() {
    let t = setup();
    let treasury = Address::generate(&t.env);
    let depositor = Address::generate(&t.env);
    let recipient = Address::generate(&t.env);

    t.pool.update_fee(&100u32).unwrap();
    t.pool.update_treasury(&treasury).unwrap();

    mint_tokens(&t.env, &t.token_id, &depositor, 5_000);
    t.pool.deposit(&depositor, &5_000);

    t.pool.withdraw(&recipient, &2_000).unwrap();

    // fee = 2_000 * 100 / 10_000 = 20, net = 1_980
    let events = t.env.events().all();
    let found_fee_event = events.iter().any(|(_, topics, _)| {
        topics
            .get(1)
            .and_then(|v| {
                let sym: Result<Symbol, _> = v.clone().try_into_val(&t.env);
                sym.ok().map(|s| s == Symbol::new(&t.env, "fee_coll"))
            })
            .unwrap_or(false)
    });
    assert!(found_fee_event, "expected 'fee_coll' event to be emitted");
}

/// Fee is NOT emitted when fee_bps == 0.
#[test]
fn test_no_fee_event_when_bps_zero() {
    let t = setup();
    let depositor = Address::generate(&t.env);
    let recipient = Address::generate(&t.env);

    mint_tokens(&t.env, &t.token_id, &depositor, 5_000);
    t.pool.deposit(&depositor, &5_000);

    t.pool.withdraw(&recipient, &1_000).unwrap();

    let events = t.env.events().all();
    let found_fee_event = events.iter().any(|(_, topics, _)| {
        topics
            .get(1)
            .and_then(|v| {
                let sym: Result<Symbol, _> = v.clone().try_into_val(&t.env);
                sym.ok().map(|s| s == Symbol::new(&t.env, "fee_coll"))
            })
            .unwrap_or(false)
    });
    assert!(!found_fee_event, "fee_coll event should NOT be emitted when bps == 0");
}

// ---------------------------------------------------------------------------
// get_balance and get_treasury_balance tests
// ---------------------------------------------------------------------------

#[test]
fn test_get_balance_zero_on_empty_pool() {
    let t = setup();
    assert_eq!(t.pool.get_balance(), 0);
}

#[test]
fn test_get_balance_reflects_real_token_balance() {
    let t = setup();
    let depositor = Address::generate(&t.env);

    mint_tokens(&t.env, &t.token_id, &depositor, 10_000);
    t.pool.deposit(&depositor, &4_000);
    assert_eq!(t.pool.get_balance(), 4_000);
}

#[test]
fn test_get_treasury_balance_zero_when_no_treasury() {
    let t = setup();
    assert_eq!(t.pool.get_treasury_balance(), 0);
}

// ---------------------------------------------------------------------------
// Lock management tests
// ---------------------------------------------------------------------------

#[test]
fn test_set_and_get_locked_until() {
    let t = setup();
    assert_eq!(t.pool.get_locked_until(), 0);
    t.pool.set_locked_until(&9_999_999u64).unwrap();
    assert_eq!(t.pool.get_locked_until(), 9_999_999);
}

#[test]
fn test_withdraw_at_exact_unlock_boundary() {
    let t = setup();
    let depositor = Address::generate(&t.env);
    let recipient = Address::generate(&t.env);

    mint_tokens(&t.env, &t.token_id, &depositor, 1_000);
    t.pool.deposit(&depositor, &1_000);

    let unlock_at: u64 = 5_000;
    t.pool.set_locked_until(&unlock_at).unwrap();

    // One second before: locked
    t.env.ledger().set_timestamp(unlock_at - 1);
    let result = t.pool.try_withdraw(&recipient, &500);
    assert_eq!(result, Err(Ok(PoolError::PoolLocked)));

    // Exactly at unlock_at: allowed
    t.env.ledger().set_timestamp(unlock_at);
    t.pool.withdraw(&recipient, &500).unwrap();
}

#[test]
fn test_deposit_is_not_blocked_by_lock() {
    let t = setup();
    let depositor = Address::generate(&t.env);
    mint_tokens(&t.env, &t.token_id, &depositor, 1_000);

    t.pool.set_locked_until(&u64::MAX).unwrap();

    t.pool.deposit(&depositor, &1_000);
    assert_eq!(t.pool.get_balance(), 1_000);
}
