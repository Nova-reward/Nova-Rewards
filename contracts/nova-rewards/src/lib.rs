#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short,
    Address, BytesN, Env,
};

// ---------------------------------------------------------------------------
// Storage keys
// ---------------------------------------------------------------------------

#[contracttype]
pub enum DataKey {
    Admin,
    Balance(Address),
    MigratedVersion,
}

// Current code version — bump this with every upgrade that needs a migration.
const CONTRACT_VERSION: u32 = 1;

// ---------------------------------------------------------------------------
// Contract
// ---------------------------------------------------------------------------

#[contract]
pub struct NovaRewardsContract;

#[contractimpl]
impl NovaRewardsContract {
    // -----------------------------------------------------------------------
    // Initialisation
    // -----------------------------------------------------------------------

    /// Must be called once after first deployment to set the admin.
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::MigratedVersion, &0u32);
    }

    // -----------------------------------------------------------------------
    // Upgrade (Issue #206)
    // -----------------------------------------------------------------------

    /// Replaces the contract WASM with `new_wasm_hash`.
    /// Only the admin may call this.
    /// Emits: topics=(upgrade, old_hash, new_hash), data=migration_version
    pub fn upgrade(env: Env, new_wasm_hash: BytesN<32>) {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("not initialized");
        admin.require_auth();

        let old_wasm_hash = env.current_contract_address();
        let migration_version: u32 = env
            .storage()
            .instance()
            .get(&DataKey::MigratedVersion)
            .unwrap_or(0);

        env.deployer()
            .update_current_contract_wasm(new_wasm_hash.clone());

        env.events().publish(
            (symbol_short!("upgrade"), old_wasm_hash, new_wasm_hash),
            migration_version,
        );
    }

    /// Runs data migrations for the current code version.
    /// Safe to call multiple times — only executes once per version bump.
    pub fn migrate(env: Env) {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("not initialized");
        admin.require_auth();

        let stored_version: u32 = env
            .storage()
            .instance()
            .get(&DataKey::MigratedVersion)
            .unwrap_or(0);

        if CONTRACT_VERSION <= stored_version {
            panic!("migration already applied");
        }

        // --- place version-specific migration logic here ---
        // e.g. backfill new fields, rename keys, etc.

        env.storage()
            .instance()
            .set(&DataKey::MigratedVersion, &CONTRACT_VERSION);
    }

    // -----------------------------------------------------------------------
    // State helpers (used by tests to verify state survives upgrade)
    // -----------------------------------------------------------------------

    pub fn set_balance(env: Env, user: Address, amount: i128) {
        env.storage()
            .instance()
            .set(&DataKey::Balance(user), &amount);
    }

    pub fn get_balance(env: Env, user: Address) -> i128 {
        env.storage()
            .instance()
            .get(&DataKey::Balance(user))
            .unwrap_or(0)
    }

    pub fn get_migrated_version(env: Env) -> u32 {
        env.storage()
            .instance()
            .get(&DataKey::MigratedVersion)
            .unwrap_or(0)
    }
}
