#![no_std]

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
pub enum DataKey {
    Admin,
    RecoveryAdmin,
    Balance(Address),
    MigratedVersion,
    Paused,
    EmergencyProcedure,
    /// Address of the XLM SAC token contract
    XlmToken,
    /// Address of the DEX router contract used for multi-hop swaps
    Router,
    /// Staking annual rate in basis points (10000 = 100%)
    AnnualRate,
    /// Individual stake records
    Stake(Address),
    Snapshot(Address),
    RecoveryOperation(BytesN<32>),
}

// Current code version — bump this with every upgrade that needs a migration.
const CONTRACT_VERSION: u32 = 1;

// ---------------------------------------------------------------------------
// Fixed-point arithmetic (Issue #205)
// ---------------------------------------------------------------------------

/// Scale factor for 6 decimal places of precision.
/// All rate arguments are expressed as integers scaled by this factor.
/// e.g. a 3.3333% rate is passed as 33_333 (= 0.033333 × 1_000_000).
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

    /// Must be called once after first deployment to set the admin.
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::RecoveryAdmin, &admin);
        env.storage().instance().set(&DataKey::MigratedVersion, &0u32);
        env.storage().instance().set(&DataKey::Paused, &false);
    }

    /// Sets the XLM SAC token address and DEX router address.
    /// Admin only. Must be called before swap_for_xlm is usable.
    pub fn set_swap_config(env: Env, xlm_token: Address, router: Address) {
        Self::require_admin(&env);
        env.storage().instance().set(&DataKey::XlmToken, &xlm_token);
        env.storage().instance().set(&DataKey::Router, &router);
    }

    /// Assigns a dedicated recovery operator for emergency procedures.
    /// Admin only.
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
        Self::assert_active(&env);
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

        // --- Burn Nova points ---
        let balance = Self::read_balance(&env, &user);
        if balance < nova_amount {
            panic!("insufficient Nova balance");
        }
        Self::write_balance(&env, &user, balance - nova_amount);

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
        Self::require_admin(&env);

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
        Self::require_admin(&env);

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
        Self::write_balance(&env, &user, amount);
    }

    pub fn get_balance(env: Env, user: Address) -> i128 {
        Self::read_balance(&env, &user)
    }

    pub fn get_migrated_version(env: Env) -> u32 {
        env.storage()
            .instance()
            .get(&DataKey::MigratedVersion)
            .unwrap_or(0)
    }

    /// Thin contract entry-point that delegates to the free `calculate_payout`
    /// function. Exposed so off-chain callers can verify payout amounts.
    pub fn calc_payout(_env: Env, balance: i128, rate: i128) -> i128 {
        calculate_payout(balance, rate)
    }

    // -----------------------------------------------------------------------
    // Staking functionality
    // -----------------------------------------------------------------------

    /// Set the annual staking rate in basis points (10000 = 100%).
    /// Admin only.
    pub fn set_annual_rate(env: Env, rate: i128) {
        Self::require_admin(&env);
        
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

    /// Get stake information for a user.
    pub fn get_stake(env: Env, staker: Address) -> Option<StakeRecord> {
        Self::read_stake(&env, &staker)
    }

    /// Calculate expected yield for a stake without unstaking.
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
