//! # Nova Rewards Contract
//!
//! Core rewards contract for the Nova Rewards platform. Manages user balances,
//! staking with yield accrual, cross-asset swaps, emergency recovery, and
//! contract upgrades.
//!
//! ## Features
//! - User balance management with daily withdrawal limits
//! - Staking with configurable annual yield (basis points)
//! - Cross-asset swap: burn Nova points for XLM via a DEX router
//! - Emergency pause / unpause with optional auto-expiry
//! - Account snapshot and restore for emergency recovery
//! - Two-step WASM upgrade with migration versioning
//!
//! ## Usage
//! ```ignore
//! client.initialize(&admin);
//! client.set_annual_rate(&500); // 5% APY
//! client.set_balance(&user, &10_000);
//! client.stake(&user, &5_000);
//! // time passes …
//! let total = client.unstake(&user); // principal + yield
//! ```
#![no_std]

pub mod utils;

use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short,
    Address, BytesN, Env, Symbol, Vec,
};

// ---------------------------------------------------------------------------
// Staking data structures
// ---------------------------------------------------------------------------

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct StakeRecord {
    pub amount: i128,
    pub staked_at: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AccountSnapshot {
    pub balance: i128,
    pub stake: Option<StakeRecord>,
    pub captured_at: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RecoveryOperation {
    pub kind: RecoveryKind,
    pub account: Address,
    pub counterparty: Option<Address>,
    pub amount: i128,
    pub executed_at: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum RecoveryKind {
    StateSnapshot,
    StateRestore,
    Transaction,
    Fund,
}

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
    RecoveryAdmin,
    Balance(Address),
    /// Target migration version — incremented by upgrade().
    MigrationVersion,
    /// Last completed migration — incremented by migrate().
    MigratedVersion,
    Paused,
    EmergencyProcedure,
    /// Address of the XLM SAC token contract
    XlmToken,
    /// Address of the DEX router contract used for multi-hop swaps
    Router,
    /// Pending WASM hash stored by upgrade() for use by migrate()
    PendingWasmHash,
    /// Staking annual rate in basis points (10000 = 100%)
    AnnualRate,
    /// Individual stake records
    Stake(Address),
    Snapshot(Address),
    RecoveryOperation(BytesN<32>),
}

// ---------------------------------------------------------------------------
// Fixed-point arithmetic (Issue #205)
// ---------------------------------------------------------------------------

/// Scale factor for 6 decimal places of precision.
pub const SCALE_FACTOR: i128 = 1_000_000;

/// Seconds per year for staking yield calculations.
pub const SECONDS_PER_YEAR: u64 = 31_536_000; // 365 * 24 * 60 * 60

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

impl NovaRewardsContract {
    fn admin(env: &Env) -> Address {
        env.storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("not initialized")
    }

    fn recovery_admin(env: &Env) -> Address {
        env.storage()
            .instance()
            .get(&DataKey::RecoveryAdmin)
            .unwrap_or_else(|| Self::admin(env))
    }

    fn require_admin(env: &Env) {
        Self::admin(env).require_auth();
    }

    fn require_recovery_admin(env: &Env) {
        Self::recovery_admin(env).require_auth();
    }

    fn require_paused(env: &Env) {
        if !Self::is_paused(env.clone()) {
            panic!("contract must be paused");
        }
    }

    fn assert_active(env: &Env) {
        if Self::is_paused(env.clone()) {
            panic!("contract is paused");
        }
    }

    fn read_balance(env: &Env, user: &Address) -> i128 {
        env.storage()
            .instance()
            .get(&DataKey::Balance(user.clone()))
            .unwrap_or(0)
    }

    fn write_balance(env: &Env, user: &Address, amount: i128) {
        env.storage()
            .instance()
            .set(&DataKey::Balance(user.clone()), &amount);
    }

    fn read_stake(env: &Env, staker: &Address) -> Option<StakeRecord> {
        env.storage()
            .instance()
            .get(&DataKey::Stake(staker.clone()))
    }

    fn write_stake(env: &Env, staker: &Address, stake: &StakeRecord) {
        env.storage()
            .instance()
            .set(&DataKey::Stake(staker.clone()), stake);
    }

    fn clear_stake(env: &Env, staker: &Address) {
        env.storage()
            .instance()
            .remove(&DataKey::Stake(staker.clone()));
    }

    fn record_recovery_operation(
        env: &Env,
        operation_id: &BytesN<32>,
        kind: RecoveryKind,
        account: Address,
        counterparty: Option<Address>,
        amount: i128,
    ) -> RecoveryOperation {
        if let Some(existing) = env
            .storage()
            .instance()
            .get::<_, RecoveryOperation>(&DataKey::RecoveryOperation(operation_id.clone()))
        {
            return existing;
        }

        let operation = RecoveryOperation {
            kind,
            account,
            counterparty,
            amount,
            executed_at: env.ledger().timestamp(),
        };

        env.storage()
            .instance()
            .set(&DataKey::RecoveryOperation(operation_id.clone()), &operation);

        operation
    }

    fn get_recorded_recovery_operation(
        env: &Env,
        operation_id: &BytesN<32>,
    ) -> Option<RecoveryOperation> {
        env.storage()
            .instance()
            .get(&DataKey::RecoveryOperation(operation_id.clone()))
    }
}

#[contractimpl]
impl NovaRewardsContract {
    // -----------------------------------------------------------------------
    // Initialisation
    // -----------------------------------------------------------------------

    /// Initializes the contract and records the admin plus migration version state.
    ///
    /// # Parameters
    /// - `admin` – Address authorized for all admin-gated operations.
    ///
    /// # Panics
    /// - `"already initialized"` if called more than once.
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::RecoveryAdmin, &admin);
        env.storage().instance().set(&DataKey::MigratedVersion, &0u32);
        env.storage().instance().set(&DataKey::Paused, &false);
    }

    // -----------------------------------------------------------------------
    // Pause mechanism
    // -----------------------------------------------------------------------

    fn require_not_paused(env: &Env) {
        let paused: bool = env
            .storage()
            .instance()
            .get(&DataKey::Paused)
            .unwrap_or(false);
        if paused {
            // Check if an emergency pause has expired
            let expiry: u64 = env
                .storage()
                .instance()
                .get(&DataKey::EmergencyPauseExpiry)
                .unwrap_or(0);
            if expiry == 0 || env.ledger().timestamp() < expiry {
                panic!("contract is paused");
            }
            // Expiry passed — auto-clear the pause
            env.storage().instance().set(&DataKey::Paused, &false);
            env.storage().instance().set(&DataKey::EmergencyPauseExpiry, &0u64);
        }
    }

    /// Pause all state-changing operations. Admin only.
    pub fn pause(env: Env) {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("not initialized");
        admin.require_auth();
        env.storage().instance().set(&DataKey::Paused, &true);
        env.storage().instance().set(&DataKey::EmergencyPauseExpiry, &0u64);
        env.events().publish((symbol_short!("paused"),), ());
    }

    /// Unpause the contract. Admin only.
    pub fn unpause(env: Env) {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("not initialized");
        admin.require_auth();
        env.storage().instance().set(&DataKey::Paused, &false);
        env.storage().instance().set(&DataKey::EmergencyPauseExpiry, &0u64);
        env.events().publish((symbol_short!("unpaused"),), ());
    }

    /// Emergency pause with a maximum duration in seconds. Admin only.
    /// The contract auto-unpauses once `duration_secs` have elapsed.
    pub fn emergency_pause(env: Env, duration_secs: u64) {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("not initialized");
        admin.require_auth();
        if duration_secs == 0 {
            panic!("duration must be > 0");
        }
        let expiry = env.ledger().timestamp() + duration_secs;
        env.storage().instance().set(&DataKey::Paused, &true);
        env.storage().instance().set(&DataKey::EmergencyPauseExpiry, &expiry);
        env.events().publish((symbol_short!("emrg_paus"),), expiry);
    }

    /// Returns true if the contract is currently paused.
    pub fn is_paused(env: Env) -> bool {
        let paused: bool = env
            .storage()
            .instance()
            .get(&DataKey::Paused)
            .unwrap_or(false);
        if !paused {
            return false;
        }
        let expiry: u64 = env
            .storage()
            .instance()
            .get(&DataKey::EmergencyPauseExpiry)
            .unwrap_or(0);
        expiry == 0 || env.ledger().timestamp() < expiry
    }

    /// Sets the XLM SAC token address and DEX router address.
    ///
    /// Must be called before [`swap_for_xlm`](NovaRewardsContract::swap_for_xlm) is usable.
    ///
    /// # Parameters
    /// - `xlm_token` – Address of the XLM Stellar Asset Contract (SAC).
    /// - `router` – Address of the DEX router contract for multi-hop swaps.
    ///
    /// # Authorization
    /// Admin only.
    pub fn set_swap_config(env: Env, xlm_token: Address, router: Address) {
        Self::require_admin(&env);
        env.storage().instance().set(&DataKey::XlmToken, &xlm_token);
        env.storage().instance().set(&DataKey::Router, &router);
    }

    /// Assigns a dedicated recovery operator for emergency procedures.
    ///
    /// # Parameters
    /// - `recovery_admin` – Address authorized to call snapshot/restore/recover functions.
    ///
    /// # Authorization
    /// Admin only.
    ///
    /// # Events
    /// Emits `("recovery", "operator")` with data `recovery_admin: Address`.
    pub fn set_recovery_admin(env: Env, recovery_admin: Address) {
        Self::require_admin(&env);
        env.storage()
            .instance()
            .set(&DataKey::RecoveryAdmin, &recovery_admin);

        env.events().publish(
            (symbol_short!("recovery"), symbol_short!("operator")),
            recovery_admin,
        );
    }

    /// Pauses state-changing user operations and records the active procedure.
    pub fn pause(env: Env, procedure: Symbol) {
        Self::require_admin(&env);

        env.storage().instance().set(&DataKey::Paused, &true);
        env.storage()
            .instance()
            .set(&DataKey::EmergencyProcedure, &procedure);

        env.events().publish(
            (symbol_short!("recovery"), symbol_short!("paused")),
            (procedure, env.ledger().timestamp()),
        );
    }

    /// Resumes normal contract operations after a recovery workflow.
    pub fn resume(env: Env) {
        Self::require_admin(&env);

        env.storage().instance().set(&DataKey::Paused, &false);
        env.storage().instance().remove(&DataKey::EmergencyProcedure);

        env.events().publish(
            (symbol_short!("recovery"), symbol_short!("resumed")),
            env.ledger().timestamp(),
        );
    }

    pub fn is_paused(env: Env) -> bool {
        env.storage().instance().get(&DataKey::Paused).unwrap_or(false)
    }

    pub fn get_recovery_admin(env: Env) -> Address {
        Self::recovery_admin(&env)
    }

    pub fn get_emergency_procedure(env: Env) -> Option<Symbol> {
        env.storage().instance().get(&DataKey::EmergencyProcedure)
    }

    // -----------------------------------------------------------------------
    // Cross-asset swap (Issue #200)
    // -----------------------------------------------------------------------

    /// Burns `nova_amount` Nova points for the caller and exchanges them for
    /// XLM via the configured DEX router.
    ///
    /// # Parameters
    /// - `user` – Address burning Nova points (must authorize).
    /// - `nova_amount` – Number of Nova points to burn (must be > 0).
    /// - `min_xlm_out` – Minimum XLM to receive; reverts if slippage exceeds this.
    /// - `path` – Swap path as a list of token addresses (max 5 hops).
    ///
    /// # Returns
    /// The amount of XLM received from the swap.
    ///
    /// # Authorization
    /// Requires `user` authorization.
    ///
    /// # Events
    /// Emits `("swap", user)` with data `(nova_amount: i128, xlm_received: i128, path: Vec<Address>)`.
    ///
    /// # Panics
    /// - `"nova_amount must be positive"` if `nova_amount <= 0`.
    /// - `"min_xlm_out must be non-negative"` if `min_xlm_out < 0`.
    /// - `"path exceeds maximum of 5 hops"` if `path.len() > 5`.
    /// - `"insufficient Nova balance"` if the user holds fewer points than `nova_amount`.
    /// - `"router not configured"` if [`set_swap_config`](NovaRewardsContract::set_swap_config) has not been called.
    /// - `"slippage: received X < min Y"` if the DEX returns fewer XLM than `min_xlm_out`.
    pub fn swap_for_xlm(
        env: Env,
        user: Address,
        nova_amount: i128,
        min_xlm_out: i128,
        path: Vec<Address>,
    ) -> i128 {
        Self::assert_active(&env);
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

        // --- Burn Nova points ---
        let balance = Self::read_balance(&env, &user);
        if balance < nova_amount {
            panic!("insufficient Nova balance");
        }
        Self::write_balance(&env, &user, balance - nova_amount);

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
                user.clone().to_val(),
                nova_amount.into_val(&env),
                min_xlm_out.into_val(&env),
                path.clone().to_val(),
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
    /// - Stores `new_wasm_hash` so [`migrate`](NovaRewardsContract::migrate) can include it in the event.
    /// - Calls `env.deployer().update_current_contract_wasm(new_wasm_hash)`.
    ///
    /// After this call the caller must invoke [`migrate`](NovaRewardsContract::migrate) to apply any
    /// data transformations for the new version.
    ///
    /// # Parameters
    /// - `new_wasm_hash` – 32-byte hash of the new contract WASM.
    ///
    /// # Authorization
    /// Admin only.
    pub fn upgrade(env: Env, new_wasm_hash: BytesN<32>) {
        Self::require_admin(&env);

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
    ///
    /// # Authorization
    /// Admin only.
    ///
    /// # Events
    /// Emits `("upgraded",)` with data `(wasm_hash: BytesN<32>, migration_version: u32)`.
    ///
    /// # Panics
    /// - `"migration already applied"` if `migrated_version >= migration_version`.
    /// - `"no pending wasm hash"` if [`upgrade`](NovaRewardsContract::upgrade) was not called first.
    pub fn migrate(env: Env) {
        Self::require_admin(&env);

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

    /// Test helper that writes a balance directly into contract storage.
    ///
    /// # Parameters
    /// - `user` – Address to update.
    /// - `amount` – New balance value.
    pub fn set_balance(env: Env, user: Address, amount: i128) {
        Self::write_balance(&env, &user, amount);
    }

    /// Returns the raw Nova balance recorded for a user.
    ///
    /// # Parameters
    /// - `user` – Address to query.
    ///
    /// # Returns
    /// Balance in base units. Returns `0` if no balance is recorded.
    pub fn get_balance(env: Env, user: Address) -> i128 {
        Self::read_balance(&env, &user)
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

    // -----------------------------------------------------------------------
    // Staking functionality
    // -----------------------------------------------------------------------

    /// Updates the annual staking rate in basis points.
    ///
    /// # Parameters
    /// - `rate` – Annual rate in basis points (0–10 000, where 10 000 = 100%).
    ///
    /// # Authorization
    /// Admin only.
    ///
    /// # Panics
    /// - `"rate must be between 0 and 10000 basis points"` if `rate < 0 || rate > 10000`.
    pub fn set_annual_rate(env: Env, rate: i128) {
        Self::require_admin(&env);
        
        if rate < 0 || rate > 10000 {
            panic!("rate must be between 0 and 10000 basis points");
        }
        
        env.storage().instance().set(&DataKey::AnnualRate, &rate);
    }

    /// Returns the configured annual staking rate in basis points.
    pub fn get_annual_rate(env: Env) -> i128 {
        env.storage()
            .instance()
            .get(&DataKey::AnnualRate)
            .unwrap_or(0)
    }

    /// Stake Nova tokens to earn yield over time.
    /// 
    /// # Parameters
    /// - `staker` - The address staking tokens
    /// - `amount` - Amount of tokens to stake (must be > 0)
    /// 
    /// # Events
    /// Emits `(Symbol("staked"), staker)` with data `(amount, timestamp)`.
    pub fn stake(env: Env, staker: Address, amount: i128) {
        Self::assert_active(&env);
        staker.require_auth();
        
        if amount <= 0 {
            panic!("amount must be positive");
        }
        
        // Check if user already has an active stake
        if env.storage().instance().has(&DataKey::Stake(staker.clone())) {
            panic!("user already has an active stake");
        }
        
        // Check user balance
        let balance = Self::read_balance(&env, &staker);
        if balance < amount {
            panic!("insufficient balance for staking");
        }
        
        // Deduct from balance
        Self::write_balance(&env, &staker, balance - amount);
        
        // Create stake record
        let stake_record = StakeRecord {
            amount,
            staked_at: env.ledger().timestamp(),
        };
        
        // Store stake record
        Self::write_stake(&env, &staker, &stake_record);
        
        // Emit event
        env.events().publish(
            (symbol_short!("staked"), staker),
            (amount, stake_record.staked_at),
        );
    }

    /// Unstake Nova tokens and receive accrued yield.
    /// 
    /// # Parameters
    /// - `staker` - The address unstaking tokens
    /// 
    /// # Returns
    /// Total amount returned (principal + yield)
    /// 
    /// # Events
    /// Emits `(Symbol("unstaked"), staker)` with data `(principal, yield, timestamp)`.
    pub fn unstake(env: Env, staker: Address) -> i128 {
        Self::assert_active(&env);
        staker.require_auth();
        
        // Get stake record
        let stake_record: StakeRecord = Self::read_stake(&env, &staker)
            .expect("no active stake found");
        
        // Get current annual rate
        let annual_rate: i128 = env
            .storage()
            .instance()
            .get(&DataKey::AnnualRate)
            .unwrap_or(0);
        
        // Calculate time elapsed
        let current_time = env.ledger().timestamp();
        let time_elapsed = if current_time > stake_record.staked_at {
            current_time - stake_record.staked_at
        } else {
            0
        };
        
        // Calculate yield: amount × rate × (now - staked_at) / SECONDS_PER_YEAR
        let yield_amount = if annual_rate > 0 && time_elapsed > 0 {
            // Convert annual rate from basis points to decimal (rate / 10000)
            // Then apply time factor: (time_elapsed / SECONDS_PER_YEAR)
            // Formula: amount × (annual_rate / 10000) × (time_elapsed / SECONDS_PER_YEAR)
            // Simplified: amount × annual_rate × time_elapsed / (10000 × SECONDS_PER_YEAR)
            stake_record
                .amount
                .checked_mul(annual_rate)
                .expect("overflow in amount * annual_rate")
                .checked_mul(time_elapsed as i128)
                .expect("overflow in * time_elapsed")
                .checked_div(10000 * SECONDS_PER_YEAR as i128)
                .expect("overflow in division")
        } else {
            0
        };
        
        let total_return = stake_record.amount + yield_amount;
        
        // Add total return back to user balance
        let current_balance = Self::read_balance(&env, &staker);
        Self::write_balance(&env, &staker, current_balance + total_return);
        
        // Remove stake record
        Self::clear_stake(&env, &staker);
        
        // Emit event
        env.events().publish(
            (symbol_short!("unstaked"), staker),
            (stake_record.amount, yield_amount, current_time),
        );
        
        total_return
    }

    /// Returns the active stake record for a staker, if one exists.
    pub fn get_stake(env: Env, staker: Address) -> Option<StakeRecord> {
        Self::read_stake(&env, &staker)
    }

    /// Computes accrued staking yield without removing the stake.
    pub fn calculate_yield(env: Env, staker: Address) -> i128 {
        let Some(stake_record) = Self::read_stake(&env, &staker) else {
            return 0;
        };
        
        let annual_rate: i128 = env
            .storage()
            .instance()
            .get(&DataKey::AnnualRate)
            .unwrap_or(0);
        
        let current_time = env.ledger().timestamp();
        let time_elapsed = if current_time > stake_record.staked_at {
            current_time - stake_record.staked_at
        } else {
            0
        };
        
        if annual_rate > 0 && time_elapsed > 0 {
            stake_record
                .amount
                .checked_mul(annual_rate)
                .expect("overflow in amount * annual_rate")
                .checked_mul(time_elapsed as i128)
                .expect("overflow in * time_elapsed")
                .checked_div(10000 * SECONDS_PER_YEAR as i128)
                .expect("overflow in division")
        } else {
            0
        }
    }

    /// Captures a restorable snapshot of a user's contract state.
    pub fn snapshot_account(env: Env, user: Address, operation_id: BytesN<32>) -> AccountSnapshot {
        Self::require_recovery_admin(&env);

        if Self::get_recorded_recovery_operation(&env, &operation_id).is_some() {
            return env
                .storage()
                .instance()
                .get(&DataKey::Snapshot(user))
                .expect("snapshot not found");
        }

        let snapshot = AccountSnapshot {
            balance: Self::read_balance(&env, &user),
            stake: Self::read_stake(&env, &user),
            captured_at: env.ledger().timestamp(),
        };

        env.storage()
            .instance()
            .set(&DataKey::Snapshot(user.clone()), &snapshot);

        Self::record_recovery_operation(
            &env,
            &operation_id,
            RecoveryKind::StateSnapshot,
            user.clone(),
            None,
            snapshot.balance,
        );

        env.events().publish(
            (symbol_short!("recovery"), symbol_short!("snapshot")),
            (user, snapshot.balance, snapshot.captured_at),
        );

        snapshot
    }

    pub fn get_account_snapshot(env: Env, user: Address) -> Option<AccountSnapshot> {
        env.storage().instance().get(&DataKey::Snapshot(user))
    }

    /// Restores a previously captured account snapshot while the contract is paused.
    pub fn restore_account(env: Env, user: Address, operation_id: BytesN<32>) -> AccountSnapshot {
        Self::require_recovery_admin(&env);
        Self::require_paused(&env);

        if Self::get_recorded_recovery_operation(&env, &operation_id).is_some() {
            return env
                .storage()
                .instance()
                .get(&DataKey::Snapshot(user))
                .expect("snapshot not found");
        }

        let snapshot: AccountSnapshot = env
            .storage()
            .instance()
            .get(&DataKey::Snapshot(user.clone()))
            .expect("snapshot not found");

        Self::write_balance(&env, &user, snapshot.balance);
        if let Some(stake) = snapshot.stake.clone() {
            Self::write_stake(&env, &user, &stake);
        } else {
            Self::clear_stake(&env, &user);
        }

        Self::record_recovery_operation(
            &env,
            &operation_id,
            RecoveryKind::StateRestore,
            user.clone(),
            None,
            snapshot.balance,
        );

        env.events().publish(
            (symbol_short!("recovery"), symbol_short!("restore")),
            (user, snapshot.balance, env.ledger().timestamp()),
        );

        snapshot
    }

    /// Applies a compensating balance delta while the contract is paused.
    /// Positive amounts replay a missing credit; negative amounts reverse an invalid credit.
    pub fn recover_transaction(
        env: Env,
        user: Address,
        amount_delta: i128,
        operation_id: BytesN<32>,
    ) -> i128 {
        Self::require_recovery_admin(&env);
        Self::require_paused(&env);

        if Self::get_recorded_recovery_operation(&env, &operation_id).is_some() {
            return Self::read_balance(&env, &user);
        }

        let balance = Self::read_balance(&env, &user);
        let new_balance = balance + amount_delta;
        if new_balance < 0 {
            panic!("recovery would overdraw balance");
        }

        Self::write_balance(&env, &user, new_balance);
        Self::record_recovery_operation(
            &env,
            &operation_id,
            RecoveryKind::Transaction,
            user.clone(),
            None,
            amount_delta,
        );

        env.events().publish(
            (symbol_short!("recovery"), symbol_short!("tx")),
            (user, amount_delta, new_balance),
        );

        new_balance
    }

    /// Moves internal funds from one user balance to another while paused.
    pub fn recover_funds(
        env: Env,
        from: Address,
        to: Address,
        amount: i128,
        operation_id: BytesN<32>,
    ) {
        Self::require_recovery_admin(&env);
        Self::require_paused(&env);

        if Self::get_recorded_recovery_operation(&env, &operation_id).is_some() {
            return;
        }

        if amount <= 0 {
            panic!("amount must be positive");
        }

        let from_balance = Self::read_balance(&env, &from);
        if from_balance < amount {
            panic!("insufficient balance for fund recovery");
        }

        let to_balance = Self::read_balance(&env, &to);
        Self::write_balance(&env, &from, from_balance - amount);
        Self::write_balance(&env, &to, to_balance + amount);

        Self::record_recovery_operation(
            &env,
            &operation_id,
            RecoveryKind::Fund,
            from.clone(),
            Some(to.clone()),
            amount,
        );

        env.events().publish(
            (symbol_short!("recovery"), symbol_short!("funds")),
            (from, to, amount),
        );
    }

    pub fn get_recovery_operation(env: Env, operation_id: BytesN<32>) -> Option<RecoveryOperation> {
        env.storage()
            .instance()
            .get(&DataKey::RecoveryOperation(operation_id))
    }
}
