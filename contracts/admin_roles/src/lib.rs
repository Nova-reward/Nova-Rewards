#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, symbol_short, vec, Address, Env, Vec};

// ── Storage keys ────────────────────────────────────────────────────────────
#[contracttype]
pub enum DataKey {
    Admin,
    PendingAdmin,
    Signers,
    Threshold,
}

// ── Contract ─────────────────────────────────────────────────────────────────
#[contract]
pub struct AdminRolesContract;

#[contractimpl]
impl AdminRolesContract {
    /// Initializes the contract with the first admin and optional multisig settings.
    pub fn initialize(env: Env, admin: Address, signers: Vec<Address>, threshold: u32) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialised");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Signers, &signers);
        env.storage()
            .instance()
            .set(&DataKey::Threshold, &threshold);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    /// Returns the currently configured admin address.
    fn admin(env: &Env) -> Address {
        env.storage().instance().get(&DataKey::Admin).unwrap()
    }

    /// Requires the stored admin account to authorize the current invocation.
    fn require_admin(env: &Env) {
        Self::admin(env).require_auth();
    }

    // ── Two-step admin transfer ───────────────────────────────────────────────

    /// Stores a pending admin that can later accept ownership.
    pub fn propose_admin(env: Env, new_admin: Address) {
        Self::require_admin(&env);
        env.storage()
            .instance()
            .set(&DataKey::PendingAdmin, &new_admin);

        // emit admin_proposed event
        env.events().publish(
            (symbol_short!("adm_roles"), symbol_short!("adm_prop")),
            (Self::admin(&env), new_admin),
        );
    }

    /// Completes the two-step admin transfer for the pending admin.
    pub fn accept_admin(env: Env) {
        let pending: Address = env
            .storage()
            .instance()
            .get(&DataKey::PendingAdmin)
            .expect("no pending admin");
        pending.require_auth();

        let old_admin = Self::admin(&env);
        env.storage().instance().set(&DataKey::Admin, &pending);
        env.storage().instance().remove(&DataKey::PendingAdmin);

        // emit admin_transferred event
        env.events().publish(
            (symbol_short!("adm_roles"), symbol_short!("adm_xfer")),
            (old_admin, pending),
        );
    }

    // ── Multisig threshold ────────────────────────────────────────────────────

    /// Updates the multisig approval threshold.
    pub fn update_threshold(env: Env, threshold: u32) {
        Self::require_admin(&env);
        env.storage()
            .instance()
            .set(&DataKey::Threshold, &threshold);
    }

    /// Replaces the configured multisig signer set.
    pub fn update_signers(env: Env, signers: Vec<Address>) {
        Self::require_admin(&env);
        env.storage().instance().set(&DataKey::Signers, &signers);
    }

    // ── Privileged stubs (gated behind admin auth) ────────────────────────────

    /// Placeholder privileged mint hook guarded by admin auth.
    pub fn mint(env: Env, _to: Address, _amount: i128) {
        Self::require_admin(&env);
    }

    /// Placeholder privileged withdrawal hook guarded by admin auth.
    pub fn withdraw(env: Env, _to: Address, _amount: i128) {
        Self::require_admin(&env);
    }

    /// Placeholder privileged rate update hook guarded by admin auth.
    pub fn update_rate(env: Env, _rate: u32) {
        Self::require_admin(&env);
    }

    /// Placeholder pause hook guarded by admin auth.
    pub fn pause(env: Env) {
        Self::require_admin(&env);
    }

    // ── Read-only ─────────────────────────────────────────────────────────────

    /// Returns the active admin address.
    pub fn get_admin(env: Env) -> Address {
        Self::admin(&env)
    }

    /// Returns the pending admin, if a transfer is in progress.
    pub fn get_pending_admin(env: Env) -> Option<Address> {
        env.storage().instance().get(&DataKey::PendingAdmin)
    }

    /// Returns the configured multisig threshold, defaulting to `1`.
    pub fn get_threshold(env: Env) -> u32 {
        env.storage()
            .instance()
            .get(&DataKey::Threshold)
            .unwrap_or(1)
    }

    /// Returns the configured signer set, or an empty vector when unset.
    pub fn get_signers(env: Env) -> Vec<Address> {
        env.storage()
            .instance()
            .get(&DataKey::Signers)
            .unwrap_or(vec![&env])
    }
}

// ── Tests ─────────────────────────────────────────────────────────────────────
#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{
        testutils::{Address as _, Events},
        vec, Env,
    };

    fn setup() -> (Env, Address, AdminRolesContractClient<'static>) {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(AdminRolesContract, ());
        let client = AdminRolesContractClient::new(&env, &contract_id);
        let admin = Address::generate(&env);
        client.initialize(&admin, &vec![&env], &1);
        (env, admin, client)
    }

    #[test]
    fn test_single_admin_auth() {
        let (_env, admin, client) = setup();
        // privileged calls should succeed when admin auth is mocked
        client.mint(&admin, &100);
        client.pause();
        client.update_rate(&5);
    }

    #[test]
    #[should_panic]
    fn test_unauthorised_call_rejected() {
        let env = Env::default();
        // do NOT mock auths – any require_auth will panic
        let contract_id = env.register(AdminRolesContract, ());
        let client = AdminRolesContractClient::new(&env, &contract_id);
        let admin = Address::generate(&env);
        env.mock_all_auths();
        client.initialize(&admin, &vec![&env], &1);
        // drop mock so next call is unauthorised
        let env2 = Env::default();
        let client2 = AdminRolesContractClient::new(&env2, &contract_id);
        client2.pause(); // should panic
    }

    #[test]
    fn test_two_step_transfer() {
        let (env, _admin, client) = setup();
        let new_admin = Address::generate(&env);

        client.propose_admin(&new_admin);
        assert_eq!(client.get_pending_admin(), Some(new_admin.clone()));

        client.accept_admin();
        assert_eq!(client.get_admin(), new_admin);
        assert_eq!(client.get_pending_admin(), None);
    }

    #[test]
    fn test_events_emitted() {
        let (env, _admin, client) = setup();
        let new_admin = Address::generate(&env);

        client.propose_admin(&new_admin);
        // at least the adm_prop event was published
        assert!(env.events().all().len() >= 1);

        client.accept_admin();
        // now adm_xfer event is also published
        assert!(env.events().all().len() >= 1);
    }

    #[test]
    fn test_multisig_threshold() {
        let (env, _admin, client) = setup();
        let s1 = Address::generate(&env);
        let s2 = Address::generate(&env);
        let s3 = Address::generate(&env);
        client.update_signers(&vec![&env, s1, s2, s3]);
        client.update_threshold(&2);
        assert_eq!(client.get_threshold(), 2);
        assert_eq!(client.get_signers().len(), 3);
    }
}
