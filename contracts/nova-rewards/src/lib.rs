#![no_std]

pub mod utils;

use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short,
    Address, BytesN, Env, IntoVal, Vec,
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
    /// Target migration version — incremented by upgrade().
    MigrationVersion,
    /// Last completed migration — incremented by migrate().
    MigratedVersion,
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
    /// Whether the contract is paused
    Paused,
    /// Expiry timestamp for an emergency pause (0 = no expiry / manual unpause)
    EmergencyPauseExpiry,
    /// Pending WASM hash for upgrade
    PendingWasmHash,
}

// ---------------------------------------------------------------------------
// Fixed-point arithmetic (Issue #205)
// ---------------------------------------------------------------------------

/// Scale factor for 6 decimal places of precision.
pub const SCALE_FACTOR: i128 = 1_000_000;

/// Seconds per year for yield calculations
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
    /// XLM via the configured DEX router.
    pub fn swap_for_xlm(
        env: Env,
        user: Address,
        nova_amount: i128,
        min_xlm_out: i128,
        path: Vec<Address>,
    ) -> i128 {
        Self::require_not_paused(&env);
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

    // -----------------------------------------------------------------------
    // Staking functionality
    // -----------------------------------------------------------------------

    /// Set the annual staking rate in basis points (10000 = 100%).
    /// Admin only.
    pub fn set_annual_rate(env: Env, rate: i128) {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("not initialized");
        admin.require_auth();
        
        if rate < 0 || rate > 10000 {
            panic!("rate must be between 0 and 10000 basis points");
        }
        
        env.storage().instance().set(&DataKey::AnnualRate, &rate);
    }

    /// Get the current annual staking rate.
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
        Self::require_not_paused(&env);
        staker.require_auth();
        
        if amount <= 0 {
            panic!("amount must be positive");
        }
        
        // Check if user already has an active stake
        if env.storage().instance().has(&DataKey::Stake(staker.clone())) {
            panic!("user already has an active stake");
        }
        
        // Check user balance
        let balance: i128 = env
            .storage()
            .instance()
            .get(&DataKey::Balance(staker.clone()))
            .unwrap_or(0);
        if balance < amount {
            panic!("insufficient balance for staking");
        }
        
        // Deduct from balance
        env.storage()
            .instance()
            .set(&DataKey::Balance(staker.clone()), &(balance - amount));
        
        // Create stake record
        let stake_record = StakeRecord {
            amount,
            staked_at: env.ledger().timestamp(),
        };
        
        // Store stake record
        env.storage()
            .instance()
            .set(&DataKey::Stake(staker.clone()), &stake_record);
        
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
        Self::require_not_paused(&env);
        staker.require_auth();
        
        // Get stake record
        let stake_record: StakeRecord = env
            .storage()
            .instance()
            .get(&DataKey::Stake(staker.clone()))
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
        let current_balance: i128 = env
            .storage()
            .instance()
            .get(&DataKey::Balance(staker.clone()))
            .unwrap_or(0);
        env.storage()
            .instance()
            .set(&DataKey::Balance(staker.clone()), &(current_balance + total_return));
        
        // Remove stake record
        env.storage()
            .instance()
            .remove(&DataKey::Stake(staker.clone()));
        
        // Emit event
        env.events().publish(
            (symbol_short!("unstaked"), staker),
            (stake_record.amount, yield_amount, current_time),
        );
        
        total_return
    }

    /// Get stake information for a user.
    pub fn get_stake(env: Env, staker: Address) -> Option<StakeRecord> {
        env.storage()
            .instance()
            .get(&DataKey::Stake(staker))
    }

    /// Calculate expected yield for a stake without unstaking.
    pub fn calculate_yield(env: Env, staker: Address) -> i128 {
        let stake_record: StakeRecord = match env
            .storage()
            .instance()
            .get(&DataKey::Stake(staker.clone()))
        {
            Some(r) => r,
            None => return 0,
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
}
