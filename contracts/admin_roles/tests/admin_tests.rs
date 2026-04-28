#![cfg(test)]

use admin_roles::AdminRolesContract;
use admin_roles::AdminRolesContractClient;
use soroban_sdk::{testutils::Address as _, vec, Address, Env};

fn setup() -> (Env, Address, AdminRolesContractClient<'static>) {
    let env = Env::default();
    env.mock_all_auths();
    let id = env.register(AdminRolesContract, ());
    let client = AdminRolesContractClient::new(&env, &id);
    let admin = Address::generate(&env);
    client.initialize(&admin, &vec![&env], &1);
    (env, admin, client)
}

// ── initialize ────────────────────────────────────────────────────────────────

#[test]
fn initialize_sets_admin_and_threshold() {
    let (env, admin, client) = setup();
    assert_eq!(client.get_admin(), admin);
    assert_eq!(client.get_threshold(), 1);
}

#[test]
fn initialize_with_multiple_signers() {
    let env = Env::default();
    env.mock_all_auths();
    let id = env.register(AdminRolesContract, ());
    let client = AdminRolesContractClient::new(&env, &id);
    let admin = Address::generate(&env);
    let s1 = Address::generate(&env);
    let s2 = Address::generate(&env);
    client.initialize(&admin, &vec![&env, s1, s2], &2);
    assert_eq!(client.get_threshold(), 2);
    assert_eq!(client.get_signers().len(), 2);
}

#[test]
#[should_panic(expected = "already initialised")]
fn initialize_twice_panics() {
    let (_env, admin, client) = setup();
    client.initialize(&admin, &vec![&_env], &1);
}

// ── propose_admin / accept_admin ──────────────────────────────────────────────

#[test]
fn propose_admin_sets_pending() {
    let (env, _admin, client) = setup();
    let new_admin = Address::generate(&env);
    client.propose_admin(&new_admin);
    assert_eq!(client.get_pending_admin(), Some(new_admin));
}

#[test]
fn accept_admin_transfers_role() {
    let (env, _admin, client) = setup();
    let new_admin = Address::generate(&env);
    client.propose_admin(&new_admin);
    client.accept_admin();
    assert_eq!(client.get_admin(), new_admin);
    assert_eq!(client.get_pending_admin(), None);
}

#[test]
fn propose_then_accept_clears_pending() {
    let (env, _admin, client) = setup();
    let new_admin = Address::generate(&env);
    client.propose_admin(&new_admin);
    client.accept_admin();
    assert_eq!(client.get_pending_admin(), None);
}

#[test]
#[should_panic(expected = "no pending admin")]
fn accept_admin_without_proposal_panics() {
    let (_env, _admin, client) = setup();
    client.accept_admin();
}

#[test]
fn propose_overwrites_previous_proposal() {
    let (env, _admin, client) = setup();
    let candidate1 = Address::generate(&env);
    let candidate2 = Address::generate(&env);
    client.propose_admin(&candidate1);
    client.propose_admin(&candidate2);
    assert_eq!(client.get_pending_admin(), Some(candidate2));
}

// ── update_threshold ──────────────────────────────────────────────────────────

#[test]
fn update_threshold_changes_value() {
    let (_env, _admin, client) = setup();
    client.update_threshold(&3);
    assert_eq!(client.get_threshold(), 3);
}

#[test]
fn update_threshold_to_zero() {
    let (_env, _admin, client) = setup();
    client.update_threshold(&0);
    assert_eq!(client.get_threshold(), 0);
}

// ── update_signers ────────────────────────────────────────────────────────────

#[test]
fn update_signers_replaces_list() {
    let (env, _admin, client) = setup();
    let s1 = Address::generate(&env);
    let s2 = Address::generate(&env);
    let s3 = Address::generate(&env);
    client.update_signers(&vec![&env, s1, s2, s3]);
    assert_eq!(client.get_signers().len(), 3);
}

#[test]
fn update_signers_to_empty_list() {
    let (env, _admin, client) = setup();
    client.update_signers(&vec![&env]);
    assert_eq!(client.get_signers().len(), 0);
}

// ── privileged stubs ──────────────────────────────────────────────────────────

#[test]
fn privileged_stubs_succeed_with_admin_auth() {
    let (env, admin, client) = setup();
    let target = Address::generate(&env);
    client.mint(&target, &1_000);
    client.withdraw(&target, &500);
    client.update_rate(&10);
    client.pause();
}

// ── read-only getters ─────────────────────────────────────────────────────────

#[test]
fn get_pending_admin_returns_none_initially() {
    let (_env, _admin, client) = setup();
    assert_eq!(client.get_pending_admin(), None);
}

#[test]
fn get_signers_returns_initial_list() {
    let (env, _admin, client) = setup();
    // setup passes vec![&env] which is an empty vec
    assert_eq!(client.get_signers().len(), 0);
}

// ── boundary ──────────────────────────────────────────────────────────────────

#[test]
fn chained_admin_transfers() {
    let (env, _admin, client) = setup();
    let admin2 = Address::generate(&env);
    let admin3 = Address::generate(&env);

    client.propose_admin(&admin2);
    client.accept_admin();
    assert_eq!(client.get_admin(), admin2);

    client.propose_admin(&admin3);
    client.accept_admin();
    assert_eq!(client.get_admin(), admin3);
}
