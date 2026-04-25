//! # Reward Pool Contract
//!
//! A shared liquidity pool that merchants deposit into and users withdraw from,
//! subject to a configurable per-wallet daily withdrawal cap.
//!
//! ## Usage
//! ```ignore
//! // Admin initializes
//! client.initialize(&admin);
//!
//! // Merchant deposits
//! client.deposit(&merchant, &50_000);
//!
//! // Set a daily limit of 1 000 tokens per wallet
//! client.set_daily_limit(&1_000);
//!
//! // User withdraws
//! client.withdraw(&user, &500);
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
    PoolLocked = 1,
    InsufficientBalance = 2,
    Unauthorized = 3,
}

// ---------------------------------------------------------------------------
// Data structures
// ---------------------------------------------------------------------------

#[contracttype]
pub enum DataKey {
    Admin,
    /// Address of the Nova token contract.
    NovaToken,
    /// Timestamp before which withdrawals are blocked.
    LockedUntil,
}

// ---------------------------------------------------------------------------
// Contract
// ---------------------------------------------------------------------------

#[contract]
pub struct RewardPoolContract;

#[contractimpl]
impl RewardPoolContract {
    /// Initializes the reward pool and stores the admin address.
    ///
    /// Sets the initial pool balance to `0` and the daily limit to `i128::MAX` (unlimited).
    ///
    /// # Parameters
    /// - `admin` – Address authorized to call [`set_daily_limit`](RewardPoolContract::set_daily_limit).
    ///
    /// # Panics
    /// - `"already initialised"` if called more than once.
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage()
            .instance()
            .set(&DataKey::NovaToken, &nova_token_address);
        env.storage().instance().set(&DataKey::LockedUntil, &0u64);
    }

    // -----------------------------------------------------------------------
    // Deposit
    // -----------------------------------------------------------------------

    /// Deposits Nova tokens from the caller into the reward pool.
    ///
    /// # Parameters
    /// * `from` – address transferring tokens into the pool.
    /// * `amount` – number of Nova tokens to deposit.
    ///
    /// # Events
    /// Emits `("rwd_pool", "deposited")` with data `(from, amount)`.
    ///
    /// # Panics
    /// Panics if amount is not positive or if the token transfer fails.
    pub fn deposit(env: Env, from: Address, amount: i128) {
        from.require_auth();
        assert!(amount > 0, "amount must be positive");

        let nova_token: Address = env
            .storage()
            .instance()
            .get(&DataKey::NovaToken)
            .expect("nova token not set");

        // Transfer Nova tokens from caller to this contract
        let _: () = env.invoke_contract(
            &nova_token,
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
    /// # Parameters
    /// * `to` – address receiving the tokens.
    /// * `amount` – number of Nova tokens to withdraw.
    ///
    /// # Events
    /// Emits `("rwd_pool", "withdrawn")` with data `(to, amount)`.
    ///
    /// # Errors
    /// Returns `PoolError::PoolLocked` if current time is before `locked_until`.
    /// Returns `PoolError::InsufficientBalance` if pool balance is too low.
    ///
    /// # Panics
    /// Panics if caller is not the admin or if amount is not positive.
    pub fn withdraw(env: Env, to: Address, amount: i128) -> Result<(), PoolError> {
        Self::require_admin(&env);
        assert!(amount > 0, "amount must be positive");

        // Check if pool is locked
        let locked_until: u64 = env
            .storage()
            .instance()
            .get(&DataKey::LockedUntil)
            .unwrap_or(0);
        let now = env.ledger().timestamp();

        if now < locked_until {
            return Err(PoolError::PoolLocked);
        }

        // Check pool balance
        let nova_token: Address = env
            .storage()
            .instance()
            .get(&DataKey::NovaToken)
            .expect("nova token not set");

        let pool_balance: i128 = env.invoke_contract(
            &nova_token,
            &Symbol::new(&env, "balance"),
            soroban_sdk::vec![&env, env.current_contract_address().to_val()],
        );

        if pool_balance < amount {
            return Err(PoolError::InsufficientBalance);
        }

        // Transfer Nova tokens from pool to recipient
        let _: () = env.invoke_contract(
            &nova_token,
            &Symbol::new(&env, "transfer"),
            soroban_sdk::vec![
                &env,
                env.current_contract_address().to_val(),
                to.clone().to_val(),
                amount.into_val(&env),
            ],
        );

        env.events().publish(
            (symbol_short!("rwd_pool"), symbol_short!("withdrawn")),
            (to, amount),
        );

        Ok(())
    }

    /// Returns `true` if the given address has already claimed.
    pub fn is_claimed(env: Env, claimer: Address) -> bool {
        env.storage()
            .persistent()
            .get::<_, bool>(&DataKey::Claimed(claimer))
            .unwrap_or(false)
    }

    /// Returns the stored Merkle root.
    pub fn get_merkle_root(env: Env) -> BytesN<32> {
        env.storage()
            .instance()
            .get(&DataKey::MerkleRoot)
            .expect("merkle root not set")
    }

    /// Deposits funds into the shared reward pool.
    ///
    /// # Parameters
    /// - `from` – Address making the deposit (must authorize).
    /// - `amount` – Amount to deposit (must be > 0).
    ///
    /// # Authorization
    /// Requires `from` authorization.
    ///
    /// # Events
    /// Emits `("rwd_pool", "deposited")` with data `(from: Address, amount: i128)`.
    ///
    /// # Panics
    /// - `"amount must be positive"` if `amount <= 0`.
    pub fn deposit(env: Env, from: Address, amount: i128) {
        from.require_auth();
        assert!(amount > 0, "amount must be positive");

        let balance: i128 = env.storage().instance().get(&DataKey::Balance).unwrap_or(0);
        env.storage()
            .instance()
            .set(&DataKey::Balance, &(balance + amount));

        env.events().publish(
            (symbol_short!("rwd_pool"), symbol_short!("deposited")),
            (from, amount),
        );
    }

    /// Withdraws funds from the shared reward pool subject to the daily wallet limit.
    ///
    /// The 24-hour window resets automatically when 86 400 seconds have elapsed
    /// since the wallet's last window start.
    ///
    /// # Parameters
    /// - `to` – Recipient address (must authorize).
    /// - `amount` – Amount to withdraw (must be > 0).
    ///
    /// # Authorization
    /// Requires `to` authorization.
    ///
    /// # Events
    /// Emits `("rwd_pool", "withdrawn")` with data `(to: Address, amount: i128)`.
    ///
    /// # Panics
    /// - `"amount must be positive"` if `amount <= 0`.
    /// - `"insufficient pool balance"` if the pool holds fewer tokens than `amount`.
    /// - `"daily withdrawal limit exceeded"` if the wallet's 24-hour usage would exceed the limit.
    pub fn withdraw(env: Env, to: Address, amount: i128) {
        to.require_auth();
        assert!(amount > 0, "amount must be positive");

        let balance: i128 = env.storage().instance().get(&DataKey::Balance).unwrap_or(0);
        assert!(balance >= amount, "insufficient pool balance");

        let limit: i128 = env
            .storage()
            .instance()
            .get(&DataKey::DailyLimit)
            .unwrap_or(i128::MAX);
        let mut usage = Self::current_usage(&env, &to);
        assert!(
            usage.amount + amount <= limit,
            "daily withdrawal limit exceeded"
        );

        usage.amount += amount;
        Self::set_usage(&env, &to, &usage);
        env.storage()
            .instance()
            .set(&DataKey::Balance, &(balance - amount));

        env.events().publish(
            (symbol_short!("rwd_pool"), symbol_short!("withdrawn")),
            (to, amount),
        );
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

    /// Returns the current unlock timestamp.
    ///
    /// # Returns
    /// Unix timestamp (seconds) before which withdrawals are blocked.
    pub fn get_locked_until(env: Env) -> u64 {
        env.storage()
            .instance()
            .get(&DataKey::LockedUntil)
            .unwrap_or(0)
    }

    // -----------------------------------------------------------------------
    // Private Helpers
    // -----------------------------------------------------------------------

    fn require_admin(env: &Env) {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("admin not set");
        admin.require_auth();
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Env};

    #[test]
    fn test_initialize() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let token = Address::generate(&env);

        let id = env.register(RewardPoolContract, ());
        let client = RewardPoolContractClient::new(&env, &id);

        client.initialize(&admin, &token);

        assert_eq!(client.get_locked_until(), 0);
    }

    #[test]
    #[should_panic(expected = "already initialized")]
    fn test_double_initialize() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let token = Address::generate(&env);

        let id = env.register(RewardPoolContract, ());
        let client = RewardPoolContractClient::new(&env, &id);

        client.initialize(&admin, &token);
        client.initialize(&admin, &token); // Should panic
    }
}
