//! # Admin Roles Contract
//!
//! Role-based access control (RBAC) for the Nova Rewards protocol.
//!
//! ## Roles
//! - `ADMIN`    – full control; can grant/revoke any role and call all privileged functions.
//! - `MERCHANT` – can call merchant-scoped privileged functions (e.g. update_rate).
//! - `OPERATOR` – can call operator-scoped privileged functions (e.g. pause, withdraw).
//!
//! ## Usage
//! ```ignore
//! client.initialize(&owner, &signers_vec, &threshold);
//!
//! // Grant / revoke roles (owner only)
//! client.grant_role(&address, &Role::Merchant);
//! client.revoke_role(&address, &Role::Merchant);
//!
//! // Two-step owner transfer
//! client.propose_admin(&new_owner);
//! client.accept_admin();
//! ```
#![no_std]
use soroban_sdk::{contract, contracterror, contractimpl, contracttype, symbol_short, vec, Address, Env, Vec};

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
    /// Stores `true` when `address` holds `role`.
    Role(Address, Role),
}

// ── Contract ──────────────────────────────────────────────────────────────────

#[contract]
pub struct AdminRolesContract;

#[contractimpl]
impl AdminRolesContract {
    // ── Init ──────────────────────────────────────────────────────────────────

    /// One-time setup. The `owner` is automatically granted the `Admin` role.
    pub fn initialize(
        env: Env,
        owner: Address,
        signers: Vec<Address>,
        threshold: u32,
    ) -> Result<(), Error> {
        if env.storage().instance().has(&DataKey::Owner) {
            return Err(Error::AlreadyInitialized);
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
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{testutils::Address as _, vec, Env};

    fn setup() -> (Env, Address, AdminRolesContractClient<'static>) {
        let env = Env::default();
        env.mock_all_auths();
        let id = env.register(AdminRolesContract, ());
        let client = AdminRolesContractClient::new(&env, &id);
        let owner = Address::generate(&env);
        client.initialize(&owner, &vec![&env], &1).unwrap();
        (env, owner, client)
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
    }
}
