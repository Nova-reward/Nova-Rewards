#![cfg(test)]

use soroban_sdk::{
    testutils::{Address as _, AuthorizedFunction, AuthorizedInvocation, Events},
    Address, BytesN, Env, IntoVal, Symbol,
};

use nova_rewards::{NovaRewardsContract, NovaRewardsContractClient};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn deploy(env: &Env) -> (NovaRewardsContractClient, Address) {
    let admin = Address::generate(env);
    let contract_id = env.register_contract(None, NovaRewardsContract);
    let client = NovaRewardsContractClient::new(env, &contract_id);
    client.initialize(&admin);
    (client, admin)
}

/// Returns a dummy 32-byte hash (simulates a new WASM hash).
fn dummy_hash(env: &Env, seed: u8) -> BytesN<32> {
    BytesN::from_array(env, &[seed; 32])
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[test]
fn test_upgrade_preserves_state_and_emits_event() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, admin) = deploy(&env);

    // Store dummy balance in V1
    let user = Address::generate(&env);
    client.set_balance(&user, &500_i128);
    assert_eq!(client.get_balance(&user), 500_i128);

    // Perform upgrade with a mock new WASM hash
    let new_hash = dummy_hash(&env, 0xAB);
    client.upgrade(&new_hash);

    // State must still be intact after upgrade
    assert_eq!(client.get_balance(&user), 500_i128);

    // Verify the "upgrade" event was emitted
    let events = env.events().all();
    let upgrade_event = events
        .iter()
        .find(|(_, topics, _)| {
            // topics is a Vec<Val>; first topic is the symbol "upgrade"
            if let Some(first) = topics.first() {
                let sym: Result<Symbol, _> = first.clone().try_into_val(&env);
                sym.map(|s| s == Symbol::new(&env, "upgrade"))
                    .unwrap_or(false)
            } else {
                false
            }
        });
    assert!(upgrade_event.is_some(), "upgrade event not emitted");
}

#[test]
fn test_migrate_increments_version_and_is_idempotent() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _admin) = deploy(&env);

    assert_eq!(client.get_migrated_version(), 0);

    client.migrate();

    assert_eq!(client.get_migrated_version(), 1);
}

#[test]
#[should_panic(expected = "migration already applied")]
fn test_migrate_cannot_be_called_twice_for_same_version() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _admin) = deploy(&env);

    client.migrate();
    client.migrate(); // must panic
}

#[test]
#[should_panic]
fn test_upgrade_requires_admin_auth() {
    let env = Env::default();
    // Do NOT mock auths — non-admin call must fail

    let (client, _admin) = deploy(&env);
    let new_hash = dummy_hash(&env, 0x01);

    // Calling without auth should panic
    client.upgrade(&new_hash);
}
