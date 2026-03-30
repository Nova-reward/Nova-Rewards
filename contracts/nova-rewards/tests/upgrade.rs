#![cfg(test)]

use soroban_sdk::{
    testutils::{Address as _, Events},
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

fn dummy_hash(env: &Env, seed: u8) -> BytesN<32> {
    BytesN::from_array(env, &[seed; 32])
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

/// Full V1 → V2 upgrade cycle:
///   1. Deploy V1 and seed state.
///   2. Call upgrade() with a new WASM hash.
///   3. Call migrate() — verifies it runs exactly once.
///   4. Assert existing storage is intact.
///   5. Assert `upgraded` event was emitted with correct hash and version.
#[test]
fn test_upgrade_v1_to_v2_migrate_and_verify() {
    let env = Env::default();
    env.mock_all_auths();

    // --- V1: deploy and seed state ---
    let (client, _admin) = deploy(&env);
    let user = Address::generate(&env);
    client.set_balance(&user, &1_000_i128);

    assert_eq!(client.get_balance(&user), 1_000_i128);
    assert_eq!(client.get_migration_version(), 0);
    assert_eq!(client.get_migrated_version(), 0);

    // --- Upgrade: swap WASM hash (simulates deploying V2 bytecode) ---
    // In the test environment update_current_contract_wasm is a no-op for the
    // WASM swap itself, but all storage and version bookkeeping still runs.
    let v2_hash = dummy_hash(&env, 0xAB);
    client.upgrade(&v2_hash);

    // migration_version bumped; migrated_version still at 0 (migrate not yet called)
    assert_eq!(client.get_migration_version(), 1);
    assert_eq!(client.get_migrated_version(), 0);

    // Existing storage must survive the upgrade
    assert_eq!(client.get_balance(&user), 1_000_i128);

    // --- Migrate: run data transformations for V2 ---
    client.migrate();

    // Both versions now equal — migration complete
    assert_eq!(client.get_migrated_version(), 1);
    assert_eq!(client.get_migration_version(), 1);

    // Storage still intact after migration
    assert_eq!(client.get_balance(&user), 1_000_i128);

    // --- Verify `upgraded` event ---
    let events = env.events().all();
    let upgraded_event = events.iter().find(|(_, topics, _)| {
        if let Some(first) = topics.first() {
            let sym: Result<Symbol, _> = first.clone().try_into_val(&env);
            sym.map(|s| s == Symbol::new(&env, "upgraded"))
                .unwrap_or(false)
        } else {
            false
        }
    });
    assert!(upgraded_event.is_some(), "upgraded event not emitted");

    // Verify event data contains the correct hash and migration version
    let (_, _, data) = upgraded_event.unwrap();
    let (emitted_hash, emitted_version): (BytesN<32>, u32) =
        data.into_val(&env);
    assert_eq!(emitted_hash, v2_hash);
    assert_eq!(emitted_version, 1u32);
}

/// migrate() must panic when called a second time for the same version.
#[test]
#[should_panic(expected = "migration already applied")]
fn test_migrate_cannot_be_called_twice() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _) = deploy(&env);
    client.upgrade(&dummy_hash(&env, 0x01));
    client.migrate();
    client.migrate(); // must panic
}

/// upgrade() must require admin auth.
#[test]
#[should_panic]
fn test_upgrade_requires_admin_auth() {
    let env = Env::default();
    // No mock_all_auths — unauthenticated call must fail.
    let (client, _) = deploy(&env);
    client.upgrade(&dummy_hash(&env, 0x02));
}

/// migrate() must require admin auth.
#[test]
#[should_panic]
fn test_migrate_requires_admin_auth() {
    let env = Env::default();
    // No mock_all_auths — unauthenticated call must fail.
    let (client, _) = deploy(&env);
    client.migrate();
}

/// Multiple sequential upgrades each require their own migrate() call.
#[test]
fn test_sequential_upgrades_each_need_migrate() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _) = deploy(&env);

    // First upgrade + migrate
    client.upgrade(&dummy_hash(&env, 0x01));
    client.migrate();
    assert_eq!(client.get_migrated_version(), 1);

    // Second upgrade + migrate
    client.upgrade(&dummy_hash(&env, 0x02));
    assert_eq!(client.get_migration_version(), 2);
    assert_eq!(client.get_migrated_version(), 1); // not yet migrated

    client.migrate();
    assert_eq!(client.get_migrated_version(), 2);
}
