#![cfg(test)]

use nova_rewards::{NovaRewardsContract, NovaRewardsContractClient};
use soroban_sdk::{Address, BytesN, Env, Symbol, Val, Vec};

pub fn deploy(env: &Env) -> (NovaRewardsContractClient, Address) {
    let admin = Address::generate(env);
    let id = env.register_contract(None, NovaRewardsContract);
    let client = NovaRewardsContractClient::new(env, &id);
    client.initialize(&admin);
    (client, admin)
}

pub fn dummy_hash(env: &Env, seed: u8) -> BytesN<32> {
    BytesN::from_array(env, &[seed; 32])
}

pub fn event_emitted(env: &Env, event_name: &str) -> bool {
    env.events()
        .all()
        .iter()
        .any(|(_, topics, _)| {
            topics
                .first()
                .and_then(|first| first.clone().try_into_val(env).ok())
                .map(|symbol: Symbol| symbol == Symbol::new(env, event_name))
                .unwrap_or(false)
        })
}

pub fn assert_event_emitted(env: &Env, event_name: &str) {
    assert!(
        event_emitted(env, event_name),
        "expected event '{}' to be emitted",
        event_name
    );
}
