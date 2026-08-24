#![cfg(test)]

use contract_state::{StateContract, StateContractClient};
use soroban_sdk::{
    testutils::{
        storage::{Instance as _, Persistent as _},
        Address as _, Ledger as _,
    },
    vec, Address, Bytes, Env,
};

fn setup() -> (Env, Address, Address, StateContractClient<'static>) {
    let env = Env::default();
    env.mock_all_auths();
    let id = env.register(StateContract, ());
    let client = StateContractClient::new(&env, &id);
    let admin = Address::generate(&env);
    client.initialize(&admin, &vec![&env, admin.clone()], &1);
    (env, id, admin, client)
}

#[test]
fn get_refreshes_persistent_state_ttl() {
    let (env, contract_id, _admin, client) = setup();
    let key = Bytes::from_slice(&env, b"ttl-state");
    let value = Bytes::from_slice(&env, b"alive");
    client.set(&key, &value);

    env.ledger()
        .with_mut(|ledger| ledger.sequence_number += 100);
    let ttl_before = env.as_contract(&contract_id, || {
        env.storage()
            .persistent()
            .get_ttl(&contract_state::DataKey::State(key.clone()))
    });

    assert_eq!(client.get(&key), value);

    let ttl_after = env.as_contract(&contract_id, || {
        env.storage()
            .persistent()
            .get_ttl(&contract_state::DataKey::State(key.clone()))
    });
    assert!(
        ttl_after > ttl_before,
        "expected get() to refresh persistent entry TTL"
    );
}

#[test]
fn get_version_refreshes_contract_instance_ttl() {
    let (env, contract_id, _admin, client) = setup();

    env.ledger()
        .with_mut(|ledger| ledger.sequence_number += 100);
    let ttl_before = env.as_contract(&contract_id, || env.storage().instance().get_ttl());

    assert_eq!(client.get_version(), 0);

    let ttl_after = env.as_contract(&contract_id, || env.storage().instance().get_ttl());
    assert!(
        ttl_after > ttl_before,
        "expected get_version() to refresh contract instance TTL"
    );
}
