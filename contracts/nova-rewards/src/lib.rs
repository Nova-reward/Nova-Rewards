#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short,
    token, Address, BytesN, Env, Vec,
};

// ---------------------------------------------------------------------------
// Storage keys
// ---------------------------------------------------------------------------

#[contracttype]
#[derive(Clone)]
pub struct DailyUsage {
    pub amount_used: i128,
    pub window_start: u64,
}

#[contracttype]
pub enum DataKey {
    Admin,
    Balance(Address),
    MigratedVersion,
    /// Address of the XLM SAC token contract
    XlmToken,
    /// Address of the DEX router contract used for multi-hop swaps
    Router,
    /// Daily usage tracking for each wallet (Issue #204)
    DailyUsage(Address),
    /// Daily claim limit configurable by admin
    DailyLimit,
}

// Current code version — bump this with every upgrade that needs a migration.
const CONTRACT_VERSION: u32 = 2;

// ---------------------------------------------------------------------------
// Fixed-point arithmetic (Issue #205)
// ---------------------------------------------------------------------------

/// Scale factor for 6 decimal places of precision.
/// All rate arguments are expressed as integers scaled by this factor.
/// e.g. a 3.3333% rate is passed as 33_333 (= 0.033333 × 1_000_000).
pub const SCALE_FACTOR: i128 = 1_000_000;

/// Computes the reward payout for a given balance and rate using fixed-point
/// arithmetic to eliminate rounding errors and dust accumulation.
///
/// # Fixed-point approach
///
/// Rates are represented as integers scaled by `SCALE_FACTOR` (10^6).
/// A rate of 3.3333% is expressed as `33_333` (i.e. 0.033333 × 1_000_000).
///
/// ## Why multiply first?
///
/// The naïve formula `(balance / SCALE_FACTOR) * rate` loses precision because
/// integer division truncates *before* the multiplication, discarding the
/// fractional part of the balance entirely.
///
/// The correct formula is:
/// ```text
/// payout = (balance * rate) / SCALE_FACTOR
/// ```
/// Multiplying first keeps all significant bits intact; the single division at
/// the end is the only truncation point.
///
/// ## Why i128?
///
/// With `SCALE_FACTOR = 1_000_000` and a maximum balance near `i64::MAX`
/// (~9.2 × 10^18), the intermediate product `balance * rate` can reach
/// ~9.2 × 10^24, which overflows `i64` and even `u64`. `i128` provides
/// ~1.7 × 10^38, giving ample headroom for any realistic balance × rate
/// combination.
///
/// ## Overflow safety
///
/// `checked_mul` and `checked_div` are used so the contract panics
/// deterministically on overflow rather than silently producing wrong results.
///
/// # Arguments
/// * `balance` – token balance in base units (i128)
/// * `rate`    – reward rate scaled by `SCALE_FACTOR`
///              (e.g. 33_333 for 3.3333%)
///
/// # Returns
/// Payout in base units, truncated toward zero.
pub fn calculate_payout(balance: i128, rate: i128) -> i128 {
    balance
        .checked_mul(rate)
        .expect("overflow in balance * rate")
        .checked_div(SCALE_FACTOR)
        .expect("overflow in payout / SCALE_FACTOR")
}

// ---------------------------------------------------------------------------
// Daily limit enforcer (Issue #204)
// ---------------------------------------------------------------------------

/// Checks and updates daily usage for the given user and amount.
/// Resets the window if 24 hours have passed.
/// Panics with "DailyLimitExceeded" if the limit would be exceeded.
fn check_daily_limit(env: &Env, user: &Address, requested_amount: i128) {
    let now = env.ledger().timestamp();
    let daily_limit: i128 = env
        .storage()
        .instance()
        .get(&DataKey::DailyLimit)
        .unwrap_or(0);

    if daily_limit <= 0 {
        // No limit set, allow
        return;
    }

    let usage_key = DataKey::DailyUsage(user.clone());
    let mut usage: DailyUsage = env
        .storage()
        .persistent()
        .get(&usage_key)
        .unwrap_or(DailyUsage {
            amount_used: 0,
            window_start: now,
        });

    // Extend TTL for persistent storage
    env.storage()
        .persistent()
        .extend_ttl(&usage_key, 31_536_000, 31_536_000);

    // Check if window has expired (24 hours = 86,400 seconds)
    if now - usage.window_start >= 86_400 {
        usage.amount_used = 0;
        usage.window_start = now;
        env.storage().persistent().set(&usage_key, &usage);
        // Set TTL for persistent storage (365 days)
        env.storage().persistent().extend_ttl(&usage_key, 31_536_000, 31_536_000);
    }

    // Check limit
    if usage.amount_used + requested_amount > daily_limit {
        panic!("DailyLimitExceeded");
    }

    // Update usage
    usage.amount_used += requested_amount;
    env.storage().persistent().set(&usage_key, &usage);
    // Set TTL for persistent storage (365 days)
    env.storage().persistent().extend_ttl(&usage_key, 31_536_000, 31_536_000);
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

    /// Sets the daily claim limit. Admin only.
    /// Emits a daily_limit_updated event.
    pub fn set_daily_limit(env: Env, limit: i128) {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("not initialized");
        admin.require_auth();
        if limit < 0 {
            panic!("daily limit must be non-negative");
        }
        env.storage().instance().set(&DataKey::DailyLimit, &limit);
        env.events().publish(
            (symbol_short!("daily_lim"), symbol_short!("updated")),
            limit,
        );
    }

    // -----------------------------------------------------------------------
    // Cross-asset swap (Issue #200)
    // -----------------------------------------------------------------------

    /// Burns `nova_amount` Nova points for the caller and exchanges them for
    /// XLM (or another output asset) via the configured DEX router.
    ///
    /// # Parameters
    /// - `user`         – the account authorising and receiving the swap
    /// - `nova_amount`  – Nova points to burn (must be > 0)
    /// - `min_xlm_out`  – minimum acceptable output; reverts if not met (slippage guard)
    /// - `path`         – intermediate asset addresses for multi-hop routing
    ///                    (max 5 hops per Stellar protocol limits; may be empty
    ///                    for a direct NOVA→XLM swap)
    ///
    /// # Events
    /// Emits `(Symbol("swap"), user)` with data `(nova_amount, xlm_received, path)`.
    pub fn swap_for_xlm(
        env: Env,
        user: Address,
        nova_amount: i128,
        min_xlm_out: i128,
        path: Vec<Address>,
    ) -> i128 {
        user.require_auth();

        // Validate inputs
        if nova_amount <= 0 {
            panic!("nova_amount must be positive");
        }
        if min_xlm_out < 0 {
            panic!("min_xlm_out must be non-negative");
        }
        // Stellar protocol: path_payment allows at most 5 intermediate hops
        if path.len() > 5 {
            panic!("path exceeds maximum of 5 hops");
        }

        // Check daily limit (Issue #204)
        check_daily_limit(&env, &user, nova_amount);

        // --- Burn Nova points ---
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

        // --- Execute swap via router ---
        // The router contract must implement swap_exact_in(sender, nova_amount,
        // min_out, path) -> i128 (returns actual XLM received).
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

        // Slippage guard — revert if router returned less than minimum
        if xlm_received < min_xlm_out {
            panic!("slippage: received {} < min {}", xlm_received, min_xlm_out);
        }

        // --- Emit event ---
        env.events().publish(
            (symbol_short!("swap"), user),
            (nova_amount, xlm_received, path),
        );

        xlm_received
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

    /// Returns the current daily limit.
    pub fn get_daily_limit(env: Env) -> i128 {
        env.storage()
            .instance()
            .get(&DataKey::DailyLimit)
            .unwrap_or(0)
    }

    /// Returns the daily usage for a user.
    pub fn get_daily_usage(env: Env, user: Address) -> DailyUsage {
        env.storage()
            .persistent()
            .get(&DataKey::DailyUsage(user))
            .unwrap_or(DailyUsage {
                amount_used: 0,
                window_start: 0,
            })
    }

    /// Thin contract entry-point that delegates to the free `calculate_payout`
    /// function. Exposed so off-chain callers can verify payout amounts.
    pub fn calc_payout(_env: Env, balance: i128, rate: i128) -> i128 {
        calculate_payout(balance, rate)
    }
}
