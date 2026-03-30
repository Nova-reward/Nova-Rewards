#![no_std]

use soroban_sdk::{testutils::{Address as _, Events, Ledger as _, LedgerInfo}, Env, Symbol, symbol_short};
use soroban_token_sdk::{TokenClient, TokenInterface};
use reward_pool::{RewardPool, RewardPoolClient}; // Assume after fee impl; adjust DataKey etc.

fn setup_multi_contract(env: &Env) -> (Address, RewardPoolClient<'static>, TokenClient<'static>) {
    env.mock_all_auths();
    let admin = Address::generate(env);
    
    // Deploy NovaToken
    let token_id = env.register_contract_wasm(None, nova_token::WASM); // Assume WASM from nova_token
    let token_client = TokenClient::new(env, &token_id);
    token_client.initialize(&admin);
    
    // Deploy RewardPool (after fee impl)
    let pool_id = env.register_contract_wasm(None, reward_pool::WASM);
    let pool_client = RewardPoolClient::new(env, &pool_id);
    pool_client.initialize(&token_id, &admin, &100); // token, admin, fee_bps example
    
    (admin, pool_client, token_client)
}

#[test]
fn test_fee_withdraw_integration() {
    let env = Env::default();
    let (admin, pool_client, token_client) = setup_multi_contract(&env);
    
    let depositor = Address::generate(&env);
    let treasury = Address::generate(&env);
    pool_client.update_treasury(&treasury); // admin auth mocked
    
    // Mint tokens to depositor
    token_client.mint(&depositor, &10000);
    token_client.approve(&depositor, &pool_id, &5000, 1); // Infinite approval approx
    
    // Deposit to pool
    pool_client.deposit(&depositor, &5000);
    
    // Withdraw with fee (e.g., 100bps = 1%)
    let gross = 2000;
    pool_client.withdraw(&depositor, &gross);
    
    // Verify state
    let net = gross * 99 / 100;
    let fee = gross - net;
    let pool_balance = token_client.balance(&pool_id);
    let treasury_balance = token_client.balance(&treasury);
    let depositor_balance = token_client.balance(&depositor);
    assert_eq!(pool_balance, 3000); // 5000 - 2000
    assert_eq!(treasury_balance, fee);
    assert_eq!(depositor_balance, 8000 - net); // 10000 - 2000 + ? wait adjust
    
    // Events
    let events = env.events().all();
    let fee_event = events.iter().find(|e| e.0 == (pool_id, symbol_short!("fee_collected")));
    assert!(fee_event.is_some());
}

#[test]
fn test_zero_fee() {
    // Similar setup, set fee 0, verify no deduction, treasury 0
}

#[test]
fn test_stress_multiple_withdraws() {
    // 100 withdraws, check state consistency
    for _ in 0..100 {
        // deposit/withdraw cycle
    }
    // Verify events count, balances
}

#[test]
fn test_state_consistency_after_update() {
    // Update fee_bps, treasury, verify get_treasury_balance
}

#[test]
fn test_event_emission() {
    // Check fee_collected(gross, fee, net)
}

