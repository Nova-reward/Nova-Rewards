#![no_main]
use libfuzzer_sys::fuzz_target;
use soroban_sdk::testutils::{Address as _, Ledger};
use soroban_sdk::{Address, Env};
use nova_rewards::{NovaRewardsContract, NovaRewardsContractClient};

fuzz_target!(|data: &[u8]| {
    if data.len() < 40 {
        return;
    }
    let amount = i128::from_le_bytes(data[..16].try_into().unwrap());
    let rate = i128::from_le_bytes(data[16..32].try_into().unwrap());
    let time_elapsed = u64::from_le_bytes(data[32..40].try_into().unwrap());

    // Constrain to valid ranges
    if amount <= 0 || amount > 1_000_000_000_000_i128 {
        return;
    }
    if rate < 0 || rate > 10_000 {
        return;
    }

    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register_contract(None, NovaRewardsContract);
    let client = NovaRewardsContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let staker = Address::generate(&env);

    client.initialize(&admin);
    client.set_balance(&staker, &amount);
    client.set_annual_rate(&rate);

    client.stake(&staker, &amount);

    env.ledger().with_mut(|l| {
        l.timestamp = l.timestamp.saturating_add(time_elapsed);
    });

    let total = client.unstake(&staker);

    // Invariants
    assert!(total >= amount, "total return must be >= principal");
    assert_eq!(client.get_balance(&staker), total);
});
