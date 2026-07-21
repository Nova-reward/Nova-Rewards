//! # Reward Pool Contract
//!
//! A shared liquidity pool that merchants deposit into and users withdraw from.
//! Supports configurable per-wallet daily withdrawal caps, pool locking, and
//! fee accumulation: a basis-point fee is deducted on every withdrawal and
//! transferred to a treasury address.
//!
//! ## Fee arithmetic
//! `fee = amount * fee_bps / 10_000` (integer, rounds down)
//! `net  = amount - fee`
//!
//! ## Usage
//! ```ignore
//! // Admin initializes with token contract address
//! client.initialize(&admin, &token_address);
//!
//! // Configure fee (e.g. 100 bps = 1 %)
//! client.update_fee(&100u32);
//!
//! // Configure treasury destination
//! client.update_treasury(&treasury_address);
//!
//! // Merchant deposits
//! client.deposit(&merchant, &50_000);
//!
//! // User withdraws — fee automatically sent to treasury
//! client.withdraw(&recipient, &1_000);  // 10 → treasury, 990 → recipient
//! ```
#![no_std]
use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, symbol_short, Address, Env, IntoVal,
    Symbol,
};

// ---------------------------------------------------------------------------
// Error types
// ---------------------------------------------------------------------------

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum PoolError {
    /// Withdrawal attempted before the unlock timestamp.
    PoolLocked = 1,
    /// Pool holds fewer tokens than the requested amount.
    InsufficientBalance = 2,
    /// Caller is not the contract admin.
    Unauthorized = 3,
    /// Contract has already been initialized.
    AlreadyInitialized = 4,
    /// fee_bps value exceeds 10 000 (100 %).
    InvalidFeeBps = 5,
    /// Treasury address not set when fee_bps > 0.
    TreasuryNotSet = 6,
}

// ---------------------------------------------------------------------------
// Storage keys
// ---------------------------------------------------------------------------

#[contracttype]
pub enum DataKey {
    /// Address of the contract admin.
    Admin,
    /// Address of the Nova token contract (SEP-41 / Soroban token interface).
    Token,
    /// Fee rate in basis points (0 – 10 000). Default: 0.
    FeeBps,
    /// Address that receives the fee portion of every withdrawal.
    Treasury,
    /// Timestamp (Unix seconds) before which withdrawals are blocked.  Default: 0.
    LockedUntil,
}

// ---------------------------------------------------------------------------
// Contract
// ---------------------------------------------------------------------------

#[contract]
pub struct RewardPoolContract;

#[contractimpl]
impl RewardPoolContract {
    // -----------------------------------------------------------------------
    // Initialization
    // -----------------------------------------------------------------------

    /// Initializes the reward pool.
    ///
    /// Stores `admin` and `token` contract address. Sets `locked_until` to 0
    /// and `fee_bps` to 0 (no fee). Can only be called once.
    ///
    /// # Parameters
    /// - `admin` – Address authorized to call admin-only functions.
    /// - `token` – Address of the Nova token contract.
    ///
    /// # Errors
    /// Returns `PoolError::AlreadyInitialized` if called more than once.
    pub fn initialize(env: Env, admin: Address, token: Address) -> Result<(), PoolError> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(PoolError::AlreadyInitialized);
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Token, &token);
        env.storage().instance().set(&DataKey::LockedUntil, &0u64);
        env.storage().instance().set(&DataKey::FeeBps, &0u32);
        Ok(())
    }

    // -----------------------------------------------------------------------
    // Admin configuration
    // -----------------------------------------------------------------------

    /// Updates the withdrawal fee rate.
    ///
    /// # Parameters
    /// - `new_bps` – New fee in basis points. Must be ≤ 10 000. 0 = no fee.
    ///
    /// # Authorization
    /// Requires admin authorization.
    ///
    /// # Errors
    /// Returns `PoolError::InvalidFeeBps` if `new_bps > 10_000`.
    pub fn update_fee(env: Env, new_bps: u32) -> Result<(), PoolError> {
        Self::require_admin(&env)?;
        if new_bps > 10_000 {
            return Err(PoolError::InvalidFeeBps);
        }
        env.storage().instance().set(&DataKey::FeeBps, &new_bps);
        Ok(())
    }

    /// Updates the treasury address that receives fee tokens.
    ///
    /// # Parameters
    /// - `new_treasury` – New treasury address.
    ///
    /// # Authorization
    /// Requires admin authorization.
    pub fn update_treasury(env: Env, new_treasury: Address) -> Result<(), PoolError> {
        Self::require_admin(&env)?;
        env.storage()
            .instance()
            .set(&DataKey::Treasury, &new_treasury);
        Ok(())
    }

    /// Locks the pool until a given timestamp.
    ///
    /// # Parameters
    /// - `unlock_at` – Unix timestamp (seconds) after which withdrawals are allowed.
    ///
    /// # Authorization
    /// Requires admin authorization.
    pub fn set_locked_until(env: Env, unlock_at: u64) -> Result<(), PoolError> {
        Self::require_admin(&env)?;
        env.storage()
            .instance()
            .set(&DataKey::LockedUntil, &unlock_at);
        Ok(())
    }

    // -----------------------------------------------------------------------
    // Deposit
    // -----------------------------------------------------------------------

    /// Deposits Nova tokens from the caller into the reward pool.
    ///
    /// # Parameters
    /// - `from` – Address transferring tokens into the pool.
    /// - `amount` – Number of Nova tokens to deposit. Must be > 0.
    ///
    /// # Authorization
    /// Requires `from` authorization.
    ///
    /// # Events
    /// Emits `("rwd_pool", "deposited")` with data `(from: Address, amount: i128)`.
    ///
    /// # Panics
    /// Panics if `amount ≤ 0`.
    pub fn deposit(env: Env, from: Address, amount: i128) {
        from.require_auth();
        assert!(amount > 0, "amount must be positive");

        let token: Address = env
            .storage()
            .instance()
            .get(&DataKey::Token)
            .expect("token not set");

        // Transfer tokens from caller → pool
        let _: () = env.invoke_contract(
            &token,
            &Symbol::new(&env, "transfer"),
            soroban_sdk::vec![
                &env,
                from.clone().to_val(),
                env.current_contract_address().to_val(),
                amount.into_val(&env),
            ],
        );

        env.events().publish(
            (symbol_short!("rwd_pool"), symbol_short!("deposited")),
            (from, amount),
        );
    }

    // -----------------------------------------------------------------------
    // Withdraw
    // -----------------------------------------------------------------------

    /// Withdraws Nova tokens from the pool to a recipient. Admin only.
    ///
    /// If a fee (fee_bps > 0) is configured and a treasury address is set, the
    /// fee portion is transferred to the treasury and the net amount to `to`.
    ///
    /// `fee  = amount * fee_bps / 10_000`  (truncated)
    /// `net  = amount - fee`
    ///
    /// # Parameters
    /// - `to`     – Address receiving the net tokens.
    /// - `amount` – Gross number of Nova tokens to withdraw. Must be > 0.
    ///
    /// # Authorization
    /// Requires admin authorization.
    ///
    /// # Events
    /// - Emits `("rwd_pool", "withdrawn")` with data `(to: Address, amount: i128)` (gross amount).
    /// - Emits `("rwd_pool", "fee_coll")` with data `(gross: i128, fee: i128, net: i128)`
    ///   when fee > 0.
    ///
    /// # Errors
    /// - `PoolError::PoolLocked`           – Current time is before `locked_until`.
    /// - `PoolError::InsufficientBalance`  – Pool balance < `amount`.
    /// - `PoolError::TreasuryNotSet`       – fee_bps > 0 but no treasury address configured.
    pub fn withdraw(env: Env, to: Address, amount: i128) -> Result<(), PoolError> {
        Self::require_admin(&env)?;
        assert!(amount > 0, "amount must be positive");

        // ── Lock check ───────────────────────────────────────────────────────
        let locked_until: u64 = env
            .storage()
            .instance()
            .get(&DataKey::LockedUntil)
            .unwrap_or(0);
        let now = env.ledger().timestamp();
        if now < locked_until {
            return Err(PoolError::PoolLocked);
        }

        // ── Balance check ────────────────────────────────────────────────────
        let token: Address = env
            .storage()
            .instance()
            .get(&DataKey::Token)
            .expect("token not set");

        let pool_balance: i128 = env.invoke_contract(
            &token,
            &Symbol::new(&env, "balance"),
            soroban_sdk::vec![&env, env.current_contract_address().to_val()],
        );

        if pool_balance < amount {
            return Err(PoolError::InsufficientBalance);
        }

        // ── Fee computation ──────────────────────────────────────────────────
        let fee_bps: u32 = env
            .storage()
            .instance()
            .get(&DataKey::FeeBps)
            .unwrap_or(0);

        let fee: i128 = if fee_bps > 0 {
            // fee = amount * fee_bps / 10_000  (integer truncation, always ≥ 0)
            amount * (fee_bps as i128) / 10_000
        } else {
            0
        };
        let net: i128 = amount - fee;

        // ── Treasury transfer (if fee > 0) ───────────────────────────────────
        if fee > 0 {
            let treasury: Address = env
                .storage()
                .instance()
                .get(&DataKey::Treasury)
                .ok_or(PoolError::TreasuryNotSet)?;

            let _: () = env.invoke_contract(
                &token,
                &Symbol::new(&env, "transfer"),
                soroban_sdk::vec![
                    &env,
                    env.current_contract_address().to_val(),
                    treasury.clone().to_val(),
                    fee.into_val(&env),
                ],
            );

            env.events().publish(
                (symbol_short!("rwd_pool"), symbol_short!("fee_coll")),
                (amount, fee, net),
            );
        }

        // ── Recipient transfer ───────────────────────────────────────────────
        let _: () = env.invoke_contract(
            &token,
            &Symbol::new(&env, "transfer"),
            soroban_sdk::vec![
                &env,
                env.current_contract_address().to_val(),
                to.clone().to_val(),
                net.into_val(&env),
            ],
        );

        env.events().publish(
            (symbol_short!("rwd_pool"), symbol_short!("withdrawn")),
            (to, amount),
        );

        Ok(())
    }

    // -----------------------------------------------------------------------
    // View functions
    // -----------------------------------------------------------------------

    /// Returns the pool's current Nova token balance (via live token contract call).
    pub fn get_balance(env: Env) -> i128 {
        let token: Address = match env.storage().instance().get(&DataKey::Token) {
            Some(t) => t,
            None => return 0,
        };
        env.invoke_contract(
            &token,
            &Symbol::new(&env, "balance"),
            soroban_sdk::vec![&env, env.current_contract_address().to_val()],
        )
    }

    /// Returns the treasury's current Nova token balance.
    ///
    /// Returns 0 if no treasury has been set.
    pub fn get_treasury_balance(env: Env) -> i128 {
        let token: Address = match env.storage().instance().get(&DataKey::Token) {
            Some(t) => t,
            None => return 0,
        };
        let treasury: Address = match env.storage().instance().get(&DataKey::Treasury) {
            Some(t) => t,
            None => return 0,
        };
        env.invoke_contract(
            &token,
            &Symbol::new(&env, "balance"),
            soroban_sdk::vec![&env, treasury.to_val()],
        )
    }

    /// Returns the current unlock timestamp (0 = unlocked).
    pub fn get_locked_until(env: Env) -> u64 {
        env.storage()
            .instance()
            .set(&DataKey::Balance, &(balance - amount));

        env.events().publish(
            (symbol_short!("rwd_pool"), symbol_short!("withdrawn")),
            (to, amount),
        );

        Ok(())
    }

    /// Updates the per-wallet daily withdrawal cap. Admin only.
    ///
    /// # Parameters
    /// - `limit` – New daily cap in base units (must be > 0).
    ///
    /// # Authorization
    /// Requires admin authorization.
    ///
    /// # Panics
    /// - `"limit must be positive"` if `limit <= 0`.
    pub fn set_daily_limit(env: Env, limit: i128) {
        Self::admin(&env).require_auth();
        assert!(limit > 0, "limit must be positive");
        env.storage().instance().set(&DataKey::DailyLimit, &limit);
    }

    /// Returns the total funds currently held by the reward pool (internal accounting).
    pub fn get_balance(env: Env) -> i128 {
        env.storage().instance().get(&DataKey::Balance).unwrap_or(0)
    }

    /// Returns the current fee rate in basis points (0 = no fee).
    pub fn get_fee_bps(env: Env) -> u32 {
        env.storage()
            .instance()
            .get(&DataKey::FeeBps)
            .unwrap_or(0)
    }

    // -----------------------------------------------------------------------
    // Private helpers
    // -----------------------------------------------------------------------

    fn require_admin(env: &Env) -> Result<(), PoolError> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(PoolError::Unauthorized)?;
        admin.require_auth();
        Ok(())
    }
}
