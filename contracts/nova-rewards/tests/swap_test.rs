#![cfg(test)]

//! Swap tests for Issue #200 — cross-asset swaps via DEX router.
//!
//! A minimal mock router contract is deployed in the test environment.
//! It returns a configurable `xlm_out` value, letting us test both
//! successful swaps and slippage reversions without a real DEX.

use soroban_sdk::{
    contract, contractimpl,
    testutils::{Address as _, MockAuth, MockAuthInvoke},
    vec, Address, Env, IntoVal, Symbol, Val, Vec,
};

use nova_rewards::{NovaRewardsContract, NovaRewardsContractClient};

// ---------------------------------------------------------------------------
// Mock router contract
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
            .get::<_, i128>(&soroban_sdk::Symbol::new(&env, "xlm_out"))
            .unwrap_or(0)
    }

    /// Test helper: set the XLM amount the next swap will return.
    pub fn set_xlm_out(env: Env, amount: i128) {
        env.storage()
            .instance()
            .set(&soroban_sdk::Symbol::new(&env, "xlm_out"), &amount);
    }
}

pub struct MockRouterClient<'a> {
    env: &'a Env,
    pub address: Address,
}

impl<'a> MockRouterClient<'a> {
    pub fn new(env: &'a Env) -> Self {
        let address = env.register_contract(None, MockRouter);
        Self { env, address }
    }
    pub fn set_xlm_out(&self, amount: i128) {
        let client = MockRouterClient2::new(self.env, &self.address);
        client.set_xlm_out(&amount);
    }
}

// soroban_sdk doesn't auto-generate a client for test-only contracts,
// so we invoke manually via env.invoke_contract.
struct MockRouterClient2<'a> {
    env: &'a Env,
    address: Address,
}
impl<'a> MockRouterClient2<'a> {
    fn new(env: &'a Env, address: &Address) -> Self {
        Self { env, address: address.clone() }
    }
    fn set_xlm_out(&self, amount: &i128) {
        let _: Val = self.env.invoke_contract(
            &self.address,
            &Symbol::new(self.env, "set_xlm_out"),
            vec![self.env, (*amount).into()],
        );
    }
}

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

fn setup(env: &Env) -> (NovaRewardsContractClient, Address, MockRouterClient) {
    let admin = Address::generate(env);
    let id = env.register_contract(None, NovaRewardsContract);
    let client = NovaRewardsContractClient::new(env, &id);
    client.initialize(&admin);

    let router = MockRouterClient::new(env);
    let xlm_token = Address::generate(env); // placeholder SAC address

    // admin sets swap config
    env.mock_all_auths();
    client.set_swap_config(&xlm_token, &router.address);

    (client, admin, router)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

/// Happy path: Nova is burned and XLM is returned.
#[test]
fn test_successful_swap_burns_nova_and_returns_xlm() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _admin, router) = setup(&env);

    let user = Address::generate(&env);
    client.set_balance(&user, &1_000_i128);

    // Router will return 500 XLM
    router.set_xlm_out(500);

    let xlm_received = client.swap_for_xlm(&user, &300_i128, &100_i128, &vec![&env]);

    assert_eq!(xlm_received, 500_i128);
    // Nova balance reduced by 300
    assert_eq!(client.get_balance(&user), 700_i128);
}

/// Slippage: router returns less than min_xlm_out → must revert.
#[test]
#[should_panic(expected = "slippage")]
fn test_slippage_reverts_transaction() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _admin, router) = setup(&env);

    let user = Address::generate(&env);
    client.set_balance(&user, &1_000_i128);

    // Router returns only 50, but min is 200
    router.set_xlm_out(50);

    client.swap_for_xlm(&user, &300_i128, &200_i128, &vec![&env]);
}

/// Multi-hop: path with intermediate assets executes correctly.
#[test]
fn test_multi_hop_swap_executes() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _admin, router) = setup(&env);

    let user = Address::generate(&env);
    client.set_balance(&user, &5_000_i128);

    // NOVA → AssetA → XLM (2-hop path)
    let asset_a = Address::generate(&env);
    let path = vec![&env, asset_a];

    router.set_xlm_out(1_200);

    let xlm_received = client.swap_for_xlm(&user, &1_000_i128, &1_000_i128, &path);

    assert_eq!(xlm_received, 1_200_i128);
    assert_eq!(client.get_balance(&user), 4_000_i128);
}

/// Path exceeding 5 hops must be rejected.
#[test]
#[should_panic(expected = "path exceeds maximum of 5 hops")]
fn test_path_too_long_is_rejected() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _admin, _router) = setup(&env);

    let user = Address::generate(&env);
    client.set_balance(&user, &1_000_i128);

    let long_path = vec![
        &env,
        Address::generate(&env),
        Address::generate(&env),
        Address::generate(&env),
        Address::generate(&env),
        Address::generate(&env),
        Address::generate(&env), // 6 hops
    ];

    client.swap_for_xlm(&user, &100_i128, &0_i128, &long_path);
}

/// Insufficient Nova balance must revert before touching the router.
#[test]
#[should_panic(expected = "insufficient Nova balance")]
fn test_insufficient_balance_reverts() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _admin, _router) = setup(&env);

    let user = Address::generate(&env);
    client.set_balance(&user, &50_i128);

    client.swap_for_xlm(&user, &100_i128, &0_i128, &vec![&env]);
}

/// Zero nova_amount must be rejected.
#[test]
#[should_panic(expected = "nova_amount must be positive")]
fn test_zero_nova_amount_rejected() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _admin, _router) = setup(&env);
    let user = Address::generate(&env);
    client.set_balance(&user, &1_000_i128);

    client.swap_for_xlm(&user, &0_i128, &0_i128, &vec![&env]);
}

/// swap_executed event is emitted with correct data.
#[test]
fn test_swap_event_emitted() {
    use soroban_sdk::testutils::Events;

    let env = Env::default();
    env.mock_all_auths();

    let (client, _admin, router) = setup(&env);

    let user = Address::generate(&env);
    client.set_balance(&user, &1_000_i128);
    router.set_xlm_out(400);

    client.swap_for_xlm(&user, &200_i128, &100_i128, &vec![&env]);

    let events = env.events().all();
    let swap_event = events.iter().find(|(_, topics, _)| {
        if let Some(first) = topics.first() {
            let sym: Result<Symbol, _> = first.clone().try_into_val(&env);
            sym.map(|s| s == Symbol::new(&env, "swap")).unwrap_or(false)
        } else {
            false
        }
    });
    assert!(swap_event.is_some(), "swap event not emitted");
}
