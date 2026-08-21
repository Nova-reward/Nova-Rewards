// Harness for integration tests.
//
// Fee accumulation (TODO.md steps 1-6) has landed in `src/lib.rs`; the
// deposit/withdraw + multi-contract-token flows sketched below are wired up
// against the current contract API. The authoritative, cargo-run test
// suites live under `tests/` (claim_test.rs, pool_tests.rs, integration.rs);
// this file is kept as a standalone documentation/harness reference and is
// not registered as a `[[test]]` target in Cargo.toml.

#![cfg(test)]

use soroban_sdk::{
    contract, contractimpl,
    testutils::Address as _,
    Address, Env,
};

use reward_pool::{RewardPoolContract, RewardPoolContractClient};

// A minimal token mock mirroring the Nova token interface (initialize,
// mint, balance, transfer) so cross-contract calls work in the test env.
#[contract]
pub struct HarnessToken;

#[contractimpl]
impl HarnessToken {
    pub fn initialize(env: Env, admin: Address) {
        env.storage().instance().set(&admin, &true);
    }

    pub fn mint(env: Env, to: Address, amount: i128) {
        let bal = Self::balance(env.clone(), to.clone());
        env.storage().instance().set(&to, &(bal + amount));
    }

    pub fn balance(env: Env, addr: Address) -> i128 {
        env.storage().instance().get::<_, i128>(&addr).unwrap_or(0)
    }

    pub fn transfer(env: Env, from: Address, to: Address, amount: i128) {
        let from_bal = Self::balance(env.clone(), from.clone());
        assert!(from_bal >= amount, "insufficient balance");
        env.storage().instance().set(&from, &(from_bal - amount));
        let to_bal = Self::balance(env.clone(), to.clone());
        env.storage().instance().set(&to, &(to_bal + amount));
    }
}

#[test]
fn test_deposit_withdraw_integration_current() {
    let env = Env::default();
    env.mock_all_auths();

    let token_id = env.register(HarnessToken, ());
    let token_client = HarnessTokenClient::new(&env, &token_id);
    let token_admin = Address::generate(&env);
    token_client.initialize(&token_admin);

    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    token_client.mint(&user, &1_000);

    let pool_id = env.register(RewardPoolContract, ());
    let pool = RewardPoolContractClient::new(&env, &pool_id);
    pool.initialize(&admin, &token_id);

    pool.deposit(&user, &1_000);
    pool.withdraw(&user, &400);

    // State check: pool retains the remainder after the withdrawal.
    let balance = pool.get_balance();
    assert_eq!(balance, 600);
    assert_eq!(token_client.balance(&user), 400);
}

#[test]
fn test_multi_contract_token_with_fee() {
    let env = Env::default();
    env.mock_all_auths();

    // Register the token contract.
    let token_id = env.register(HarnessToken, ());
    let token_client = HarnessTokenClient::new(&env, &token_id);
    let token_admin = Address::generate(&env);
    token_client.initialize(&token_admin);

    // Mint.
    let user = Address::generate(&env);
    token_client.mint(&user, &10_000);

    // Register RewardPool, wire it to the token, and configure a fee.
    let admin = Address::generate(&env);
    let treasury = Address::generate(&env);
    let pool_id = env.register(RewardPoolContract, ());
    let pool = RewardPoolContractClient::new(&env, &pool_id);
    pool.initialize(&admin, &token_id);
    pool.update_fee(&100u32); // 1 %
    pool.update_treasury(&treasury);

    // Deposit/withdraw using token transfer — fee is routed to treasury.
    let recipient = Address::generate(&env);
    pool.deposit(&user, &10_000);
    pool.withdraw(&recipient, &1_000);

    // fee = 1_000 * 100 / 10_000 = 10, net = 990
    assert_eq!(token_client.balance(&recipient), 990);
    assert_eq!(pool.get_treasury_balance(), 10);
}
