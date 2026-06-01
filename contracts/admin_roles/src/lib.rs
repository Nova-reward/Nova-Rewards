//! # Admin Roles Contract
//!
//! Role-based access control (RBAC) for the Nova Rewards protocol.
//!
//! ## Features
//! - Two-step admin transfer (propose → accept) to prevent accidental ownership loss
//! - Configurable multisig threshold and signer set
//! - Privileged stubs for mint, withdraw, rate update, and pause operations
//! - M-of-N multisig upgrade mechanism
//!
//! ## Event Schema (v1)
//! All events include `schema_version` as the first data element.
//!
//! | topics                          | data                                                    |
//! |---------------------------------|---------------------------------------------------------|
//! | `("adm_roles", "adm_prop")`     | `(v, current_admin, proposed)`                          |
//! | `("adm_roles", "adm_xfer")`     | `(v, old_admin, new_admin)`                             |
//! | `("adm_roles", "role_chg")`     | `(v, admin, operation, target)`                         |
//! | `("adm_roles", "upgraded")`     | `(v, new_wasm_hash)`                                    |
#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, vec, Address, BytesN, Env, Symbol, Vec,
};

// ── Errors ────────────────────────────────────────────────────────────────────

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    AlreadyInitialized = 1,
    NotInitialized     = 2,
    Unauthorized       = 3,
    NoPendingAdmin     = 4,
}

// ── Roles ─────────────────────────────────────────────────────────────────────

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum Role {
    Admin,
    Merchant,
    Operator,
}

// ── Storage keys ──────────────────────────────────────────────────────────────

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Owner,
    PendingOwner,
    Signers,
    Threshold,
    Initialized,
    /// Pending upgrade approvals: wasm_hash -> Vec<Address>
    UpgradeApprovals(BytesN<32>),
}

/// Schema version for all events emitted by this contract.
pub const EVENT_SCHEMA_VERSION: u32 = 1;

// ── Event helpers ─────────────────────────────────────────────────────────────

fn emit_admin_proposed(env: &Env, current_admin: &Address, proposed: &Address) {
    env.events().publish(
        (symbol_short!("adm_roles"), symbol_short!("adm_prop")),
        (EVENT_SCHEMA_VERSION, current_admin.clone(), proposed.clone()),
    );
}

fn emit_admin_transferred(env: &Env, old_admin: &Address, new_admin: &Address) {
    env.events().publish(
        (symbol_short!("adm_roles"), symbol_short!("adm_xfer")),
        (EVENT_SCHEMA_VERSION, old_admin.clone(), new_admin.clone()),
    );
}

fn emit_role_changed(env: &Env, admin: &Address, operation: Symbol, target: &Address) {
    env.events().publish(
        (symbol_short!("adm_roles"), symbol_short!("role_chg")),
        (EVENT_SCHEMA_VERSION, admin.clone(), operation, target.clone()),
    );
}

fn emit_contract_upgraded(env: &Env, new_wasm_hash: &BytesN<32>) {
    env.events().publish(
        (symbol_short!("adm_roles"), symbol_short!("upgraded")),
        (EVENT_SCHEMA_VERSION, new_wasm_hash.clone()),
    );
}

// ── Contract ──────────────────────────────────────────────────────────────────

#[contract]
pub struct AdminRolesContract;

#[contractimpl]
impl AdminRolesContract {
    /// Initializes the contract with the first admin and optional multisig settings.
    ///
    /// # Parameters
    /// - `admin` – Initial admin address.
    /// - `signers` – Initial multisig signer set (used for both operations and upgrades).
    /// - `threshold` – Minimum approvals required for multisig operations and upgrades.
    ///
    /// # Panics
    /// - `"already initialised"` if called more than once.
    pub fn initialize(env: Env, admin: Address, signers: Vec<Address>, threshold: u32) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialised");
        }
        env.storage().instance().set(&DataKey::Owner, &owner);
        env.storage().instance().set(&DataKey::Signers, &signers);
        env.storage().instance().set(&DataKey::Threshold, &threshold);
        // Owner implicitly holds Admin role
        env.storage()
            .persistent()
            .set(&DataKey::Role(owner.clone(), Role::Admin), &true);
        Ok(())
    }

    // ── RBAC core ─────────────────────────────────────────────────────────────

    /// Grant `role` to `account`. Restricted to the contract owner.
    ///
    /// Emits `("RoleGranted", account)` with data `role`.
    pub fn grant_role(env: Env, account: Address, role: Role) -> Result<(), Error> {
        Self::require_owner(&env)?;
        env.storage()
            .persistent()
            .set(&DataKey::Role(account.clone(), role.clone()), &true);
        env.events()
            .publish((symbol_short!("RoleGrant"), account), role);
        Ok(())
    }

    /// Revoke `role` from `account`. Restricted to the contract owner.
    ///
    /// Emits `("RoleRevoked", account)` with data `role`.
    pub fn revoke_role(env: Env, account: Address, role: Role) -> Result<(), Error> {
        Self::require_owner(&env)?;
        env.storage()
            .persistent()
            .remove(&DataKey::Role(account.clone(), role.clone()));
        env.events()
            .publish((symbol_short!("RoleRevok"), account), role);
        Ok(())
    }

    /// Returns `true` if `account` holds `role`.
    pub fn has_role(env: Env, account: Address, role: Role) -> bool {
        env.storage()
            .persistent()
            .get(&DataKey::Role(account, role))
            .unwrap_or(false)
    fn admin(env: &Env) -> Address {
        env.storage().instance().get(&DataKey::Admin).unwrap()
    }

    fn require_admin(env: &Env) {
        Self::admin(env).require_auth();
    }

    // ── Two-step owner transfer ───────────────────────────────────────────────

    /// Propose a new owner (owner-only). The candidate must call `accept_admin`.
    pub fn propose_admin(env: Env, new_owner: Address) -> Result<(), Error> {
        Self::require_owner(&env)?;
        env.storage()
            .instance()
            .set(&DataKey::PendingOwner, &new_owner);
        env.events().publish(
            (symbol_short!("adm_prop"), Self::owner(&env)),
            new_owner,
        );
        Ok(())
    }

    /// Accept ownership transfer (pending owner only).
    pub fn accept_admin(env: Env) -> Result<(), Error> {
    /// Stores a pending admin that can later accept ownership.
    ///
    /// # Events
    /// Emits `("adm_roles", "adm_prop")` with `(schema_version, current_admin, proposed)`.
    pub fn propose_admin(env: Env, new_admin: Address) {
        Self::require_admin(&env);
        env.storage()
            .instance()
            .set(&DataKey::PendingAdmin, &new_admin);

        emit_admin_proposed(&env, &Self::admin(&env), &new_admin);
    }

    /// Completes the two-step admin transfer for the pending admin.
    ///
    /// # Events
    /// Emits `("adm_roles", "adm_xfer")` with `(schema_version, old_admin, new_admin)`.
    ///
    /// # Panics
    /// - `"no pending admin"` if no admin transfer is in progress.
    pub fn accept_admin(env: Env) {
        let pending: Address = env
            .storage()
            .instance()
            .get(&DataKey::PendingOwner)
            .ok_or(Error::NoPendingAdmin)?;
        pending.require_auth();

        let old = Self::owner(&env);
        env.storage().instance().set(&DataKey::Owner, &pending);
        env.storage().instance().remove(&DataKey::PendingOwner);
        // Grant Admin role to new owner
        env.storage()
            .persistent()
            .set(&DataKey::Role(pending.clone(), Role::Admin), &true);

        env.events()
            .publish((symbol_short!("adm_xfer"), old), pending);
        Ok(())
        emit_admin_transferred(&env, &old_admin, &pending);
    }

    // ── Multisig ──────────────────────────────────────────────────────────────

    /// Update multisig threshold. Requires `Admin` role.
    pub fn update_threshold(env: Env, threshold: u32) -> Result<(), Error> {
        Self::require_role(&env, &Self::caller_from_auth(&env), &Role::Admin)?;
        env.storage().instance().set(&DataKey::Threshold, &threshold);
        Ok(())
    }

    /// Replace the signer set. Requires `Admin` role.
    pub fn update_signers(env: Env, caller: Address, signers: Vec<Address>) -> Result<(), Error> {
        caller.require_auth();
        Self::require_role(&env, &caller, &Role::Admin)?;
        env.storage().instance().set(&DataKey::Signers, &signers);
        Ok(())
    /// Updates the multisig approval threshold.
    ///
    /// # Events
    /// Emits `("adm_roles", "role_chg")` with operation `"threshold"`.
    pub fn update_threshold(env: Env, threshold: u32) {
        Self::require_admin(&env);
        env.storage()
            .instance()
            .set(&DataKey::Threshold, &threshold);

        emit_role_changed(
            &env,
            &Self::admin(&env),
            symbol_short!("threshold"),
            &Self::admin(&env),
        );
    }

    /// Replaces the configured multisig signer set.
    ///
    /// # Events
    /// Emits `("adm_roles", "role_chg")` with operation `"signers"`.
    pub fn update_signers(env: Env, signers: Vec<Address>) {
        Self::require_admin(&env);
        env.storage().instance().set(&DataKey::Signers, &signers);

        emit_role_changed(
            &env,
            &Self::admin(&env),
            symbol_short!("signers"),
            &Self::admin(&env),
        );
    }

    // ── Privileged functions (role-gated) ─────────────────────────────────────

    /// Mint tokens. Requires `Admin` role.
    pub fn mint(env: Env, caller: Address, _to: Address, _amount: i128) -> Result<(), Error> {
        caller.require_auth();
        Self::require_role(&env, &caller, &Role::Admin)
    }

    /// Withdraw funds. Requires `Operator` role.
    pub fn withdraw(env: Env, caller: Address, _to: Address, _amount: i128) -> Result<(), Error> {
        caller.require_auth();
        Self::require_role(&env, &caller, &Role::Operator)
    }

    /// Update reward rate. Requires `Merchant` role.
    pub fn update_rate(env: Env, caller: Address, _rate: u32) -> Result<(), Error> {
        caller.require_auth();
        Self::require_role(&env, &caller, &Role::Merchant)
    }

    /// Pause the protocol. Requires `Operator` role.
    pub fn pause(env: Env, caller: Address) -> Result<(), Error> {
        caller.require_auth();
        Self::require_role(&env, &caller, &Role::Operator)
    /// Placeholder privileged mint hook guarded by admin auth.
    ///
    /// # Events
    /// Emits `("adm_roles", "role_chg")` with operation `"mint"` and target `to`.
    pub fn mint(env: Env, to: Address, _amount: i128) {
        Self::require_admin(&env);
        emit_role_changed(&env, &Self::admin(&env), symbol_short!("mint"), &to);
    }

    /// Placeholder privileged withdrawal hook guarded by admin auth.
    ///
    /// # Events
    /// Emits `("adm_roles", "role_chg")` with operation `"withdraw"` and target `to`.
    pub fn withdraw(env: Env, to: Address, _amount: i128) {
        Self::require_admin(&env);
        emit_role_changed(&env, &Self::admin(&env), symbol_short!("withdraw"), &to);
    }

    /// Placeholder privileged rate update hook guarded by admin auth.
    ///
    /// # Events
    /// Emits `("adm_roles", "role_chg")` with operation `"rate"` and target `admin`.
    pub fn update_rate(env: Env, _rate: u32) {
        Self::require_admin(&env);
        let admin = Self::admin(&env);
        emit_role_changed(&env, &admin, symbol_short!("rate"), &admin);
    }

    /// Placeholder pause hook guarded by admin auth.
    ///
    /// # Events
    /// Emits `("adm_roles", "role_chg")` with operation `"pause"` and target `admin`.
    pub fn pause(env: Env) {
        Self::require_admin(&env);
        let admin = Self::admin(&env);
        emit_role_changed(&env, &admin, symbol_short!("pause"), &admin);
    }

    // ── Read-only ─────────────────────────────────────────────────────────────

    pub fn get_admin(env: Env) -> Address {
        Self::owner(&env)
    }

    pub fn get_pending_admin(env: Env) -> Option<Address> {
        env.storage().instance().get(&DataKey::PendingOwner)
    }

    pub fn get_threshold(env: Env) -> u32 {
        env.storage().instance().get(&DataKey::Threshold).unwrap_or(1)
    }

    pub fn get_signers(env: Env) -> Vec<Address> {
        env.storage().instance().get(&DataKey::Signers).unwrap_or(vec![&env])
    }

    // ── Internal helpers ──────────────────────────────────────────────────────

    fn owner(env: &Env) -> Address {
        env.storage().instance().get(&DataKey::Owner).expect("not initialized")
    }

    fn require_owner(env: &Env) -> Result<(), Error> {
        let owner = env
            .storage()
            .instance()
            .get(&DataKey::Owner)
            .ok_or(Error::NotInitialized)?;
        Address::require_auth(&owner);
        Ok(())
    }

    fn require_role(env: &Env, account: &Address, role: &Role) -> Result<(), Error> {
        let has: bool = env
            .storage()
            .persistent()
            .get(&DataKey::Role(account.clone(), role.clone()))
            .unwrap_or(false);
        if !has {
            return Err(Error::Unauthorized);
        }
        Ok(())
    }

    /// Placeholder — in real cross-contract calls the caller is passed explicitly.
    /// Used only by `update_threshold` which is owner-gated anyway.
    fn caller_from_auth(env: &Env) -> Address {
        Self::owner(env)
    }

    // ── Upgrade (M-of-N multisig) ─────────────────────────────────────────────

    /// Approve a pending WASM upgrade. Executes when threshold is reached.
    ///
    /// Uses the same signer set and threshold configured at initialization.
    ///
    /// # Events
    /// Emits `("adm_roles", "upgraded")` with `(schema_version, new_wasm_hash)` when threshold is met.
    ///
    /// # Panics
    /// - `"not an authorized signer"` if `signer` is not in the signer set.
    /// - `"already approved"` if `signer` has already approved this hash.
    pub fn approve_upgrade(env: Env, signer: Address, new_wasm_hash: BytesN<32>) {
        signer.require_auth();

        let signers: Vec<Address> = env
            .storage()
            .instance()
            .get(&DataKey::Signers)
            .expect("not initialized");
        let is_authorized = signers.iter().any(|s| s == signer);
        assert!(is_authorized, "not an authorized signer");

        let approval_key = DataKey::UpgradeApprovals(new_wasm_hash.clone());
        let mut approvals: Vec<Address> = env
            .storage()
            .instance()
            .get(&approval_key)
            .unwrap_or(Vec::new(&env));

        let already_approved = approvals.iter().any(|a| a == signer);
        assert!(!already_approved, "already approved");

        approvals.push_back(signer);
        env.storage().instance().set(&approval_key, &approvals);

        let threshold: u32 = env
            .storage()
            .instance()
            .get(&DataKey::Threshold)
            .unwrap_or(1);

        if approvals.len() >= threshold {
            env.storage().instance().remove(&approval_key);
            emit_contract_upgraded(&env, &new_wasm_hash);
            env.deployer().update_current_contract_wasm(new_wasm_hash);
        }
    }

    pub fn get_upgrade_approvals(env: Env, new_wasm_hash: BytesN<32>) -> u32 {
        let approval_key = DataKey::UpgradeApprovals(new_wasm_hash);
        let approvals: Vec<Address> = env
            .storage()
            .instance()
            .get(&approval_key)
            .unwrap_or(Vec::new(&env));
        approvals.len()
    }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{testutils::Address as _, vec, Env};
    use soroban_sdk::{
        testutils::{Address as _, Events},
        vec, BytesN, Env,
    };

    fn setup() -> (Env, Address, AdminRolesContractClient<'static>) {
        let env = Env::default();
        env.mock_all_auths();
        let id = env.register(AdminRolesContract, ());
        let client = AdminRolesContractClient::new(&env, &id);
        let owner = Address::generate(&env);
        client.initialize(&owner, &vec![&env], &1).unwrap();
        (env, owner, client)
        let contract_id = env.register(AdminRolesContract, ());
        let client = AdminRolesContractClient::new(&env, &contract_id);
        let admin = Address::generate(&env);
        client.initialize(&admin, &vec![&env, admin.clone()], &1);
        (env, admin, client)
    }

    // ── initialize ────────────────────────────────────────────────────────────

    #[test]
    fn test_initialize_grants_admin_role() {
        let (env, owner, client) = setup();
        assert!(client.has_role(&owner, &Role::Admin));
    }

    #[test]
    fn test_double_initialize_rejected() {
        let (env, owner, client) = setup();
        let err = client.try_initialize(&owner, &vec![&env], &1).unwrap_err().unwrap();
        assert_eq!(err, Error::AlreadyInitialized);
    fn test_single_admin_auth() {
        let (_env, admin, client) = setup();
        client.mint(&admin, &100);
        client.pause();
        client.update_rate(&5);
    }

    #[test]
    #[should_panic]
    fn test_unauthorised_call_rejected() {
        let env = Env::default();
        let contract_id = env.register(AdminRolesContract, ());
        let client = AdminRolesContractClient::new(&env, &contract_id);
        let admin = Address::generate(&env);
        env.mock_all_auths();
        client.initialize(&admin, &vec![&env], &1);
        let env2 = Env::default();
        let client2 = AdminRolesContractClient::new(&env2, &contract_id);
        client2.pause();
    }

    // ── grant_role / revoke_role ──────────────────────────────────────────────

    #[test]
    fn test_grant_and_revoke_merchant() {
        let (env, _owner, client) = setup();
        let merchant = Address::generate(&env);

        client.grant_role(&merchant, &Role::Merchant).unwrap();
        assert!(client.has_role(&merchant, &Role::Merchant));

        client.revoke_role(&merchant, &Role::Merchant).unwrap();
        assert!(!client.has_role(&merchant, &Role::Merchant));
    }

    #[test]
    fn test_grant_and_revoke_operator() {
        let (env, _owner, client) = setup();
        let op = Address::generate(&env);

        client.grant_role(&op, &Role::Operator).unwrap();
        assert!(client.has_role(&op, &Role::Operator));

        client.revoke_role(&op, &Role::Operator).unwrap();
        assert!(!client.has_role(&op, &Role::Operator));
        client.propose_admin(&new_admin);
        assert!(env.events().all().len() >= 1);

        client.accept_admin();
        assert!(env.events().all().len() >= 1);
    }

    #[test]
    fn test_grant_emits_event() {
        let (env, _owner, client) = setup();
        let account = Address::generate(&env);
        client.grant_role(&account, &Role::Merchant).unwrap();
        assert!(!env.events().all().is_empty());
    }

    #[test]
    fn test_revoke_emits_event() {
        let (env, _owner, client) = setup();
        let account = Address::generate(&env);
        client.grant_role(&account, &Role::Operator).unwrap();
        client.revoke_role(&account, &Role::Operator).unwrap();
        assert!(env.events().all().len() >= 2);
    }

    // ── Privileged functions: unauthorized access ─────────────────────────────

    #[test]
    fn test_mint_requires_admin_role() {
        let (env, _owner, client) = setup();
        let non_admin = Address::generate(&env);
        let target = Address::generate(&env);
        // non_admin has no Admin role
        let err = client.try_mint(&non_admin, &target, &100).unwrap_err().unwrap();
        assert_eq!(err, Error::Unauthorized);
    }

    #[test]
    fn test_withdraw_requires_operator_role() {
        let (env, _owner, client) = setup();
        let non_op = Address::generate(&env);
        let target = Address::generate(&env);
        let err = client.try_withdraw(&non_op, &target, &100).unwrap_err().unwrap();
        assert_eq!(err, Error::Unauthorized);
    }

    #[test]
    fn test_update_rate_requires_merchant_role() {
        let (env, _owner, client) = setup();
        let non_merchant = Address::generate(&env);
        let err = client.try_update_rate(&non_merchant, &10).unwrap_err().unwrap();
        assert_eq!(err, Error::Unauthorized);
    }

    #[test]
    fn test_pause_requires_operator_role() {
        let (env, _owner, client) = setup();
        let non_op = Address::generate(&env);
        let err = client.try_pause(&non_op).unwrap_err().unwrap();
        assert_eq!(err, Error::Unauthorized);
    }

    #[test]
    fn test_update_signers_requires_admin_role() {
        let (env, _owner, client) = setup();
        let non_admin = Address::generate(&env);
        let err = client.try_update_signers(&non_admin, &vec![&env]).unwrap_err().unwrap();
        assert_eq!(err, Error::Unauthorized);
    }

    // ── Privileged functions: authorized access ───────────────────────────────

    #[test]
    fn test_mint_succeeds_with_admin_role() {
        let (env, owner, client) = setup();
        let target = Address::generate(&env);
        client.mint(&owner, &target, &100).unwrap();
    }

    #[test]
    fn test_withdraw_succeeds_with_operator_role() {
        let (env, _owner, client) = setup();
        let op = Address::generate(&env);
        let target = Address::generate(&env);
        client.grant_role(&op, &Role::Operator).unwrap();
        client.withdraw(&op, &target, &50).unwrap();
    }

    #[test]
    fn test_update_rate_succeeds_with_merchant_role() {
        let (env, _owner, client) = setup();
        let merchant = Address::generate(&env);
        client.grant_role(&merchant, &Role::Merchant).unwrap();
        client.update_rate(&merchant, &5).unwrap();
    }

    #[test]
    fn test_pause_succeeds_with_operator_role() {
        let (env, _owner, client) = setup();
        let op = Address::generate(&env);
        client.grant_role(&op, &Role::Operator).unwrap();
        client.pause(&op).unwrap();
    }

    // ── Two-step owner transfer ───────────────────────────────────────────────

    #[test]
    fn test_two_step_transfer() {
        let (env, _owner, client) = setup();
        let new_owner = Address::generate(&env);
        client.propose_admin(&new_owner).unwrap();
        assert_eq!(client.get_pending_admin(), Some(new_owner.clone()));
        client.accept_admin().unwrap();
        assert_eq!(client.get_admin(), new_owner);
        assert_eq!(client.get_pending_admin(), None);
        // new owner gets Admin role
        assert!(client.has_role(&new_owner, &Role::Admin));
    }

    #[test]
    fn test_accept_without_proposal_rejected() {
        let (_env, _owner, client) = setup();
        let err = client.try_accept_admin().unwrap_err().unwrap();
        assert_eq!(err, Error::NoPendingAdmin);
    #[should_panic(expected = "already initialised")]
    fn test_reinitialize_is_blocked() {
        let (env, admin, client) = setup();
        client.initialize(&admin, &vec![&env], &1);
    }

    // ── Upgrade tests ─────────────────────────────────────────────────────────

    #[test]
    fn test_upgrade_approval_accumulates() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(AdminRolesContract, ());
        let client = AdminRolesContractClient::new(&env, &contract_id);
        let s1 = Address::generate(&env);
        let s2 = Address::generate(&env);
        client.initialize(&s1, &vec![&env, s1.clone(), s2.clone()], &2);

        let fake_hash = BytesN::from_array(&env, &[0u8; 32]);
        client.approve_upgrade(&s1, &fake_hash);
        assert_eq!(client.get_upgrade_approvals(&fake_hash), 1);
    }

    #[test]
    #[should_panic(expected = "not an authorized signer")]
    fn test_unauthorized_upgrade_rejected() {
        let (env, _admin, client) = setup();
        let outsider = Address::generate(&env);
        let fake_hash = BytesN::from_array(&env, &[1u8; 32]);
        client.approve_upgrade(&outsider, &fake_hash);
    }

    #[test]
    #[should_panic(expected = "already approved")]
    fn test_duplicate_approval_rejected() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(AdminRolesContract, ());
        let client = AdminRolesContractClient::new(&env, &contract_id);
        let s1 = Address::generate(&env);
        let s2 = Address::generate(&env);
        client.initialize(&s1, &vec![&env, s1.clone(), s2.clone()], &2);

        let fake_hash = BytesN::from_array(&env, &[2u8; 32]);
        client.approve_upgrade(&s1, &fake_hash);
        client.approve_upgrade(&s1, &fake_hash);
    }

    #[test]
    fn test_role_change_events_emitted() {
        let (env, admin, client) = setup();
        let target = Address::generate(&env);
        client.mint(&target, &500);
        client.withdraw(&target, &100);
        // Each privileged call emits a role_chg event
        assert!(env.events().all().len() >= 2);
    }
}
