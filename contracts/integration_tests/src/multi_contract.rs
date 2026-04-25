#![cfg(test)]

use soroban_sdk::{testutils::Address as _, Address, Env};

// Import generated clients
use nova_rewards::{NovaRewardsContract, NovaRewardsContractClient};
use nova_token::{NovaToken, NovaTokenClient};

struct TestHarness<'a> {
    env: Env,
    admin: Address,
    token: NovaTokenClient<'a>,
    rewards: NovaRewardsContractClient<'a>,
}

impl<'a> TestHarness<'a> {
    fn setup() -> Self {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);

        // Deploy Token
        let token_id = env.register_contract(None, NovaToken);
        let token = NovaTokenClient::new(&env, &token_id);
        token.initialize(&admin);

        // Deploy Rewards
        let rewards_id = env.register_contract(None, NovaRewardsContract);
        let rewards = NovaRewardsContractClient::new(&env, &rewards_id);
        rewards.initialize(&admin);

        Self {
            env,
            admin,
            token,
            rewards,
        }
    }
}

#[test]
fn test_multi_contract_staking_and_rewards() {
    let harness = TestHarness::setup();
    let env = &harness.env;
    let user = Address::generate(env);

    // 1. Mint tokens to user
    harness.token.mint(&user, &10_000);
    assert_eq!(harness.token.balance(&user), 10_000);

    // 2. Set balance in Rewards contract (simulate receiving rewards from token deposits)
    harness.rewards.set_balance(&user, &1_000);
    harness.rewards.set_annual_rate(&500);

    // 3. User stakes within rewards
    harness.rewards.stake(&user, &500);
    
    // Check internal states
    let stake = harness.rewards.get_stake(&user).unwrap();
    assert_eq!(stake.amount, 500);
    assert_eq!(harness.rewards.get_balance(&user), 500);

    // Verify cross-events for Token and Rewards
    let events = env.events().all();
    let mint_event = events.iter().find(|(_, topics, _)| {
        if let Some(first) = topics.first() {
            let sym: Result<soroban_sdk::Symbol, _> = first.clone().try_into_val(env);
            sym.map(|s| s == soroban_sdk::Symbol::new(env, "mint")).unwrap_or(false)
        } else {
            false
        }
    });

    assert!(mint_event.is_some(), "mint event missed in multi-contract test");

    // Attempt to withdraw back into tokens
    harness.rewards.unstake(&user);
    assert_eq!(harness.rewards.get_balance(&user), 1_000);
    
    // Check if the user can use the token balance outside
    harness.token.transfer(&user, &harness.admin, &5_000);
    assert_eq!(harness.token.balance(&user), 5_000);
    assert_eq!(harness.token.balance(&harness.admin), 5_000);
}
