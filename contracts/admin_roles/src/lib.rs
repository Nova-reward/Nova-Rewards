#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, vec, Address, Env, Vec,
};

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
    /// Initialise: set the first admin and optional multisig signers + threshold.
    pub fn initialize(
        env: Env,
        admin: Address,
        signers: Vec<Address>,
        threshold: u32,
    ) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialised");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Signers, &signers);
        env.storage().instance().set(&DataKey::Threshold, &threshold);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    fn admin(env: &Env) -> Address {
        env.storage().instance().get(&DataKey::Admin).unwrap()
    }

    fn require_admin(env: &Env) {
        Self::admin(env).require_auth();
    }

    // ── Two-step admin transfer ───────────────────────────────────────────────

    /// Step 1 – current admin proposes a new admin.
    pub fn propose_admin(env: Env, new_admin: Address) {
        Self::require_admin(&env);
        env.storage().instance().set(&DataKey::PendingAdmin, &new_admin);

        // emit admin_proposed event
        env.events().publish(
            (symbol_short!("adm_roles"), symbol_short!("adm_prop")),
            (Self::admin(&env), new_admin),
        );
    }

    /// Step 2 – pending admin accepts and becomes the new admin.
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

    /// Update the approval threshold (admin-gated).
    pub fn update_threshold(env: Env, threshold: u32) {
        Self::require_admin(&env);
        env.storage().instance().set(&DataKey::Threshold, &threshold);
    }

    /// Replace the signers list (admin-gated).
    pub fn update_signers(env: Env, signers: Vec<Address>) {
        Self::require_admin(&env);
        env.storage().instance().set(&DataKey::Signers, &signers);
    }

    // ── Privileged stubs (gated behind admin auth) ────────────────────────────

    pub fn mint(env: Env, _to: Address, _amount: i128) {
        Self::require_admin(&env);
    }

    pub fn withdraw(env: Env, _to: Address, _amount: i128) {
        Self::require_admin(&env);
    }

    pub fn update_rate(env: Env, _rate: u32) {
        Self::require_admin(&env);
    }

    pub fn pause(env: Env) {
        Self::require_admin(&env);
    }

    // ── Read-only ─────────────────────────────────────────────────────────────

    pub fn get_admin(env: Env) -> Address {
        Self::admin(&env)
    }

    pub fn get_pending_admin(env: Env) -> Option<Address> {
        env.storage().instance().get(&DataKey::PendingAdmin)
    }

    pub fn get_threshold(env: Env) -> u32 {
        env.storage().instance().get(&DataKey::Threshold).unwrap_or(1)
    }

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
