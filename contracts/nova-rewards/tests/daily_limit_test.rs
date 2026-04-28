#![cfg(test)]

//! Daily limit enforcer tests for Issue #204.
//!
//! Tests cover:
//! - First claim within limit
//! - Claim that hits the exact limit
//! - Rejection on overage
//! - Window reset after 24 hours

use soroban_sdk::{
    contract, contractimpl, symbol_short,
    testutils::{Address as _, Ledger},
    vec, Address, Env, Symbol,
};

use nova_rewards::{NovaRewardsContract, NovaRewardsContractClient, DailyUsage};

// ---------------------------------------------------------------------------
// Mock router contract (copied from swap_test.rs)
// ---------------------------------------------------------------------------

/// Stores the XLM amount the mock router will return on the next swap call.
#[contract]
pub struct MockRouter;

#[contractimpl]
impl MockRouter {
    /// Called by the nova-rewards contract: swap_exact_in(sender, nova_amount, min_out, path)
    /// Returns the pre-configured xlm_out value stored in instance storage.
    pub fn swap_exact_in(
        env: Env,
        _sender: Address,
        _nova_amount: i128,
        _min_out: i128,
        _path: Vec<Address>,
    ) -> i128 {
        env.storage()
            .instance()
            .get::<_, i128>(&Symbol::new(&env, "xlm_out"))
            .unwrap_or(0)
    }

    /// Test helper: set the XLM amount the next swap will return.
    pub fn set_xlm_out(env: Env, amount: i128) {
        env.storage()
            .instance()
            .set(&Symbol::new(&env, "xlm_out"), &amount);
    }
}

pub struct MockRouterClient<'a> {
    pub env: Env,
    pub contract_id: soroban_sdk::Address,
}

impl<'a> MockRouterClient<'a> {
    pub fn new(env: &Env, contract_id: &soroban_sdk::Address) -> MockRouterClient<'a> {
        MockRouterClient {
            env: env.clone(),
            contract_id: contract_id.clone(),
        }
    }

    pub fn set_xlm_out(&self, amount: i128) {
        self.env
            .as_contract(&self.contract_id, || {
                MockRouter::set_xlm_out(self.env.clone(), amount);
            });
    }
}

fn setup() -> (Env, Address, NovaRewardsContractClient<'static>, MockRouterClient<'static>) {
    let env = Env::default();
    env.mock_all_auths();

    // Deploy mock router
    let router_id = env.register_contract(None, nova_rewards::MockRouter);
    let router_client = MockRouterClient::new(&env, &router_id);

    // Deploy nova-rewards contract
    let contract_id = env.register_contract(None, NovaRewardsContract);
    let client = NovaRewardsContractClient::new(&env, &contract_id);

    // Initialize
    let admin = Address::generate(&env);
    client.initialize(&admin);

    // Set swap config
    let xlm_token = Address::generate(&env);
    client.set_swap_config(&xlm_token, &router_id);

    // Set daily limit to 1000
    client.set_daily_limit(&1000);

    // Set mock router to return 100 XLM per swap
    router_client.set_xlm_out(100);

    (env, admin, client, router_client)
}

#[test]
fn test_first_claim_within_limit() {
    let (env, _admin, client, _router) = setup();
    let user = Address::generate(&env);

    // Give user balance
    client.set_balance(&user, &2000);

    // First claim of 500 should succeed
    let result = client.swap_for_xlm(&user, &500, &90, &vec![&env]);
    assert_eq!(result, 100); // Mock returns 100

    // Check usage
    let usage = client.get_daily_usage(&user);
    assert_eq!(usage.amount_used, 500);
}

#[test]
fn test_claim_hits_exact_limit() {
    let (env, _admin, client, _router) = setup();
    let user = Address::generate(&env);

    // Give user balance
    client.set_balance(&user, &2000);

    // First claim of 500
    client.swap_for_xlm(&user, &500, &90, &vec![&env]);

    // Second claim of 500 should succeed (hits exact limit)
    let result = client.swap_for_xlm(&user, &500, &90, &vec![&env]);
    assert_eq!(result, 100);

    // Check usage
    let usage = client.get_daily_usage(&user);
    assert_eq!(usage.amount_used, 1000);
}

#[test]
#[should_panic(expected = "DailyLimitExceeded")]
fn test_rejection_on_overage() {
    let (env, _admin, client, _router) = setup();
    let user = Address::generate(&env);

    // Give user balance
    client.set_balance(&user, &2000);

    // First claim of 500
    client.swap_for_xlm(&user, &500, &90, &vec![&env]);

    // Second claim of 501 should fail
    client.swap_for_xlm(&user, &501, &90, &vec![&env]);
}

#[test]
fn test_window_reset_after_24_hours() {
    let (env, _admin, client, _router) = setup();
    let user = Address::generate(&env);

    // Give user balance
    client.set_balance(&user, &2000);

    // First claim of 500
    client.swap_for_xlm(&user, &500, &90, &vec![&env]);

    // Advance time by 24 hours + 1 second
    env.ledger().set_timestamp(86_401);

    // Second claim of 500 should succeed (window reset)
    let result = client.swap_for_xlm(&user, &500, &90, &vec![&env]);
    assert_eq!(result, 100);

    // Check usage reset
    let usage = client.get_daily_usage(&user);
    assert_eq!(usage.amount_used, 500);
    assert_eq!(usage.window_start, 86_401);
}

#[test]
fn test_no_limit_when_not_set() {
    let (env, admin, client, _router) = setup();
    let user = Address::generate(&env);

    // Give user balance
    client.set_balance(&user, &2000);

    // Set limit to 0 (no limit)
    client.set_daily_limit(&0);

    // Large claim should succeed
    let result = client.swap_for_xlm(&user, &10000, &90, &vec![&env]);
    assert_eq!(result, 100);

    // Check usage unchanged (no tracking)
    let usage = client.get_daily_usage(&user);
    assert_eq!(usage.amount_used, 0);
}

#[test]
fn test_daily_limit_updated_event() {
    let (env, _admin, client, _router) = setup();

    // Set new limit
    client.set_daily_limit(&2000);

    // Check event was emitted
    let events = env.events().all();
    assert_eq!(events.len(), 2); // initialize + set_daily_limit

    let last_event = &events[1];
    // last_event is (contract_id, topics, data)
    let topics = &last_event.1;
    assert_eq!(topics.len(), 2);
    assert_eq!(topics[0], symbol_short!("daily_lim").into_val(&env));
    assert_eq!(topics[1], symbol_short!("updated").into_val(&env));
    assert_eq!(last_event.2, 2000i128);
}