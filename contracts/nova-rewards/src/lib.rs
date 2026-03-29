#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short,
    Address, BytesN, Env, Vec,
};

// ---------------------------------------------------------------------------
// Storage keys
// ---------------------------------------------------------------------------

#[contracttype]
pub enum DataKey {
    Admin,
    Balance(Address),
    /// Target migration version — incremented by upgrade().
    MigrationVersion,
    /// Last completed migration — incremented by migrate().
    MigratedVersion,
    /// Address of the XLM SAC token contract
    XlmToken,
    /// Address of the DEX router contract used for multi-hop swaps
    Router,
    /// New WASM hash stored during upgrade so migrate() can emit it.
    PendingWasmHash,
}

// ---------------------------------------------------------------------------
// Fixed-point arithmetic (Issue #205)
// ---------------------------------------------------------------------------

/// Scale factor for 6 decimal places of precision.
pub const SCALE_FACTOR: i128 = 1_000_000;

/// Computes `(balance * rate) / SCALE_FACTOR` using i128 to avoid overflow.
pub fn calculate_payout(balance: i128, rate: i128) -> i128 {
    balance
        .checked_mul(rate)
        .expect("overflow in balance * rate")
        .checked_div(SCALE_FACTOR)
        .expect("overflow in payout / SCALE_FACTOR")
}

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
        env.storage().instance().set(&DataKey::MigrationVersion, &0u32);
        env.storage().instance().set(&DataKey::MigratedVersion, &0u32);
    }

    /// Sets the XLM SAC token address and DEX router address.
    /// Admin only. Must be called before swap_for_xlm is usable.
    pub fn set_swap_config(env: Env, xlm_token: Address, router: Address) {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("not initialized");
        admin.require_auth();
        env.storage().instance().set(&DataKey::XlmToken, &xlm_token);
        env.storage().instance().set(&DataKey::Router, &router);
    }

    // -----------------------------------------------------------------------
    // Cross-asset swap (Issue #200)
    // -----------------------------------------------------------------------

    /// Burns `nova_amount` Nova points for the caller and exchanges them for
    /// XLM via the configured DEX router.
    pub fn swap_for_xlm(
        env: Env,
        user: Address,
        nova_amount: i128,
        min_xlm_out: i128,
        path: Vec<Address>,
    ) -> i128 {
        user.require_auth();

        if nova_amount <= 0 {
            panic!("nova_amount must be positive");
        }
        if min_xlm_out < 0 {
            panic!("min_xlm_out must be non-negative");
        }
        if path.len() > 5 {
            panic!("path exceeds maximum of 5 hops");
        }

        let balance: i128 = env
            .storage()
            .instance()
            .get(&DataKey::Balance(user.clone()))
            .unwrap_or(0);
        if balance < nova_amount {
            panic!("insufficient Nova balance");
        }
        env.storage()
            .instance()
            .set(&DataKey::Balance(user.clone()), &(balance - nova_amount));

        let router: Address = env
            .storage()
            .instance()
            .get(&DataKey::Router)
            .expect("router not configured");

        let xlm_received: i128 = env.invoke_contract(
            &router,
            &soroban_sdk::Symbol::new(&env, "swap_exact_in"),
            soroban_sdk::vec![
                &env,
                user.clone().into(),
                nova_amount.into(),
                min_xlm_out.into(),
                path.clone().into(),
            ],
        );

        if xlm_received < min_xlm_out {
            panic!("slippage: received {} < min {}", xlm_received, min_xlm_out);
        }

        env.events().publish(
            (symbol_short!("swap"), user),
            (nova_amount, xlm_received, path),
        );

        xlm_received
    }

    // -----------------------------------------------------------------------
    // Upgrade (Issue #206)
    // -----------------------------------------------------------------------

    /// Replaces the contract WASM with `new_wasm_hash`. Admin only.
    ///
    /// - Increments `migration_version` in instance storage.
    /// - Stores `new_wasm_hash` so `migrate()` can include it in the event.
    /// - Calls `env.deployer().update_current_contract_wasm(new_wasm_hash)`.
    ///
    /// After this call the caller must invoke `migrate()` to apply any
    /// data transformations for the new version.
    pub fn upgrade(env: Env, new_wasm_hash: BytesN<32>) {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("not initialized");
        admin.require_auth();

        // Bump the target migration version.
        let migration_version: u32 = env
            .storage()
            .instance()
            .get(&DataKey::MigrationVersion)
            .unwrap_or(0)
            + 1;
        env.storage()
            .instance()
            .set(&DataKey::MigrationVersion, &migration_version);

        // Persist the hash so migrate() can emit it.
        env.storage()
            .instance()
            .set(&DataKey::PendingWasmHash, &new_wasm_hash.clone());

        // Swap the WASM — execution continues in the new code after this line.
        env.deployer()
            .update_current_contract_wasm(new_wasm_hash);
    }

    /// Runs data migrations for the pending version. Admin only.
    ///
    /// Gated: panics if `migrated_version >= migration_version` (already done).
    /// Emits `upgraded` event with the new WASM hash and migration version.
    pub fn migrate(env: Env) {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("not initialized");
        admin.require_auth();

        let migration_version: u32 = env
            .storage()
            .instance()
            .get(&DataKey::MigrationVersion)
            .unwrap_or(0);
        let migrated_version: u32 = env
            .storage()
            .instance()
            .get(&DataKey::MigratedVersion)
            .unwrap_or(0);

        if migrated_version >= migration_version {
            panic!("migration already applied");
        }

        // ---------------------------------------------------------------
        // Version-specific migration logic goes here.
        // Add `if migration_version == N { ... }` blocks as needed.
        // ---------------------------------------------------------------

        // Mark this version as migrated.
        env.storage()
            .instance()
            .set(&DataKey::MigratedVersion, &migration_version);

        // Retrieve the WASM hash stored by upgrade().
        let wasm_hash: BytesN<32> = env
            .storage()
            .instance()
            .get(&DataKey::PendingWasmHash)
            .expect("no pending wasm hash");

        // Emit the upgraded event.
        env.events().publish(
            (symbol_short!("upgraded"),),
            (wasm_hash, migration_version),
        );
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

    pub fn get_migration_version(env: Env) -> u32 {
        env.storage()
            .instance()
            .get(&DataKey::MigrationVersion)
            .unwrap_or(0)
    }

    pub fn get_migrated_version(env: Env) -> u32 {
        env.storage()
            .instance()
            .get(&DataKey::MigratedVersion)
            .unwrap_or(0)
    }

    /// Exposed so off-chain callers can verify payout amounts.
    pub fn calc_payout(_env: Env, balance: i128, rate: i128) -> i128 {
        calculate_payout(balance, rate)
    }
}
