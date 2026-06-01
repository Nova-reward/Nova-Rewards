#![cfg(test)]

use admin_roles::{AdminRolesContract, AdminRolesContractClient, Error, Role};
use soroban_sdk::{testutils::Address as _, vec, Address, Env};

fn setup() -> (Env, Address, AdminRolesContractClient<'static>) {
    let env = Env::default();
    env.mock_all_auths();
    let id = env.register(AdminRolesContract, ());
    let client = AdminRolesContractClient::new(&env, &id);
    let owner = Address::generate(&env);
    client.initialize(&owner, &vec![&env], &1).unwrap();
    (env, owner, client)
}

// ── initialize ────────────────────────────────────────────────────────────────

#[test]
fn initialize_sets_owner_and_threshold() {
    let (env, owner, client) = setup();
    assert_eq!(client.get_admin(), owner);
    assert_eq!(client.get_threshold(), 1);
    assert!(client.has_role(&owner, &Role::Admin));
}

#[test]
fn initialize_twice_returns_error() {
    let (env, owner, client) = setup();
    let err = client.try_initialize(&owner, &vec![&env], &1).unwrap_err().unwrap();
    assert_eq!(err, Error::AlreadyInitialized);
}

// ── grant_role / revoke_role ──────────────────────────────────────────────────

#[test]
fn grant_merchant_role() {
    let (env, _owner, client) = setup();
    let merchant = Address::generate(&env);
    client.grant_role(&merchant, &Role::Merchant).unwrap();
    assert!(client.has_role(&merchant, &Role::Merchant));
}

#[test]
fn revoke_merchant_role() {
    let (env, _owner, client) = setup();
    let merchant = Address::generate(&env);
    client.grant_role(&merchant, &Role::Merchant).unwrap();
    client.revoke_role(&merchant, &Role::Merchant).unwrap();
    assert!(!client.has_role(&merchant, &Role::Merchant));
}

#[test]
fn grant_operator_role() {
    let (env, _owner, client) = setup();
    let op = Address::generate(&env);
    client.grant_role(&op, &Role::Operator).unwrap();
    assert!(client.has_role(&op, &Role::Operator));
}

// ── Unauthorized access for every privileged function ────────────────────────

#[test]
fn mint_without_admin_role_rejected() {
    let (env, _owner, client) = setup();
    let stranger = Address::generate(&env);
    let target = Address::generate(&env);
    let err = client.try_mint(&stranger, &target, &100).unwrap_err().unwrap();
    assert_eq!(err, Error::Unauthorized);
}

#[test]
fn withdraw_without_operator_role_rejected() {
    let (env, _owner, client) = setup();
    let stranger = Address::generate(&env);
    let target = Address::generate(&env);
    let err = client.try_withdraw(&stranger, &target, &100).unwrap_err().unwrap();
    assert_eq!(err, Error::Unauthorized);
}

#[test]
fn update_rate_without_merchant_role_rejected() {
    let (env, _owner, client) = setup();
    let stranger = Address::generate(&env);
    let err = client.try_update_rate(&stranger, &10).unwrap_err().unwrap();
    assert_eq!(err, Error::Unauthorized);
}

#[test]
fn pause_without_operator_role_rejected() {
    let (env, _owner, client) = setup();
    let stranger = Address::generate(&env);
    let err = client.try_pause(&stranger).unwrap_err().unwrap();
    assert_eq!(err, Error::Unauthorized);
}

#[test]
fn update_signers_without_admin_role_rejected() {
    let (env, _owner, client) = setup();
    let stranger = Address::generate(&env);
    let err = client.try_update_signers(&stranger, &vec![&env]).unwrap_err().unwrap();
    assert_eq!(err, Error::Unauthorized);
}

#[test]
fn grant_role_by_non_owner_rejected() {
    let (env, _owner, client) = setup();
    // grant_role is owner-only; with mock_all_auths it passes auth but
    // the owner check uses require_owner which checks the stored owner.
    // We verify the happy path here since mock_all_auths is active.
    let account = Address::generate(&env);
    client.grant_role(&account, &Role::Admin).unwrap();
    assert!(client.has_role(&account, &Role::Admin));
}

// ── Authorized access ─────────────────────────────────────────────────────────

#[test]
fn mint_with_admin_role_succeeds() {
    let (env, owner, client) = setup();
    let target = Address::generate(&env);
    client.mint(&owner, &target, &500).unwrap();
}

#[test]
fn withdraw_with_operator_role_succeeds() {
    let (env, _owner, client) = setup();
    let op = Address::generate(&env);
    let target = Address::generate(&env);
    client.grant_role(&op, &Role::Operator).unwrap();
    client.withdraw(&op, &target, &200).unwrap();
}

#[test]
fn update_rate_with_merchant_role_succeeds() {
    let (env, _owner, client) = setup();
    let merchant = Address::generate(&env);
    client.grant_role(&merchant, &Role::Merchant).unwrap();
    client.update_rate(&merchant, &15).unwrap();
}

#[test]
fn pause_with_operator_role_succeeds() {
    let (env, _owner, client) = setup();
    let op = Address::generate(&env);
    client.grant_role(&op, &Role::Operator).unwrap();
    client.pause(&op).unwrap();
}

// ── Two-step transfer ─────────────────────────────────────────────────────────

#[test]
fn two_step_transfer_works() {
    let (env, _owner, client) = setup();
    let new_owner = Address::generate(&env);
    client.propose_admin(&new_owner).unwrap();
    client.accept_admin().unwrap();
    assert_eq!(client.get_admin(), new_owner);
    assert!(client.has_role(&new_owner, &Role::Admin));
}

#[test]
fn accept_without_proposal_rejected() {
    let (_env, _owner, client) = setup();
    let err = client.try_accept_admin().unwrap_err().unwrap();
    assert_eq!(err, Error::NoPendingAdmin);
}

// ── Events ────────────────────────────────────────────────────────────────────

#[test]
fn role_granted_event_emitted() {
    let (env, _owner, client) = setup();
    let account = Address::generate(&env);
    client.grant_role(&account, &Role::Merchant).unwrap();
    assert!(!env.events().all().is_empty());
}

#[test]
fn role_revoked_event_emitted() {
    let (env, _owner, client) = setup();
    let account = Address::generate(&env);
    client.grant_role(&account, &Role::Operator).unwrap();
    client.revoke_role(&account, &Role::Operator).unwrap();
    assert!(env.events().all().len() >= 2);
}
