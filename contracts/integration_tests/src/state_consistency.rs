#![cfg(test)]

use soroban_sdk::{testutils::Address as _, Address, Env};
use nova_rewards::{NovaRewardsContract, NovaRewardsContractClient};

#[test]
fn test_state_consistency_invariants() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let rewards_id = env.register_contract(None, NovaRewardsContract);
    let client = NovaRewardsContractClient::new(&env, &rewards_id);
    client.initialize(&admin);

    let mut users = vec![];
    let mut total_minted_system = 0_i128;

    for _ in 0..10 {
        let u = Address::generate(&env);
        users.push(u.clone());
        let amount = 1_000_i128;
        client.set_balance(&u, &amount);
        client.set_annual_rate(&100_i128); // dummy rate
        total_minted_system += amount;
    }

    // Phase 1: Random Staking
    let mut total_staked = 0_i128;
    for u in &users {
        let stake_amt = 500_i128;
        client.stake(u, &stake_amt);
        total_staked += stake_amt;
    }

    let active_stakes = client.get_active_stakes();
    assert_eq!(active_stakes, users.len() as u32);
    
    // Check total amounts in system
    let mut system_tracked = 0_i128;
    for u in &users {
        let bal = client.get_balance(u);
        let st = client.get_stake(u).unwrap();
        system_tracked += bal + st.amount;
    }
    
    // Invariant: The sum of balances and stake amounts MUST equal what was minted.
    assert_eq!(system_tracked, total_minted_system, "State consistency invariant breached after staking!");

    // Phase 2: Unstaking
    for u in &users {
        client.unstake(u);
    }
    
    let mut end_tracked = 0_i128;
    for u in &users {
        end_tracked += client.get_balance(u);
        assert!(client.get_stake(u).is_none(), "Stake should be cleared");
    }

    // Invariant: The sum of balances MUST equal what was minted after all unstakes.
    assert_eq!(end_tracked, total_minted_system, "State consistency invariant breached after unstaking!");
    assert_eq!(client.get_active_stakes(), 0);
}
