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
use soroban_sdk::{contract, contractimpl, contracttype, symbol_short, Address, Env};

const DAY_IN_SECONDS: u64 = 86_400;
const DAILY_USAGE_TTL: u32 = 172_800;

/// Tracks how much a wallet has withdrawn within the current 24-hour window.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct DailyUsage {
    pub amount: i128,
    pub window_start: u64,
}

#[contracttype]
pub enum DataKey {
    Admin,
    Balance,
    DailyLimit,
    DailyUsage(Address),
}

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
            panic!("already initialised");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Balance, &0_i128);
        env.storage()
            .instance()
            .set(&DataKey::DailyLimit, &i128::MAX);
    }

    /// Returns the admin account used for privileged configuration updates.
    fn admin(env: &Env) -> Address {
        env.storage().instance().get(&DataKey::Admin).unwrap()
    }

    /// Loads the current daily usage for a wallet and resets the window when it has expired.
    fn current_usage(env: &Env, wallet: &Address) -> DailyUsage {
        let key = DataKey::DailyUsage(wallet.clone());
        let now = env.ledger().timestamp();
        let usage = env.storage().persistent().get(&key).unwrap_or(DailyUsage {
            amount: 0,
            window_start: now,
        });

        if now.saturating_sub(usage.window_start) >= DAY_IN_SECONDS {
            DailyUsage {
                amount: 0,
                window_start: now,
            }
        } else {
            env.storage()
                .persistent()
                .extend_ttl(&key, DAILY_USAGE_TTL, DAILY_USAGE_TTL);
            usage
        }
    }

    /// Persists daily usage for a wallet and refreshes the entry TTL.
    fn set_usage(env: &Env, wallet: &Address, usage: &DailyUsage) {
        let key = DataKey::DailyUsage(wallet.clone());
        env.storage().persistent().set(&key, usage);
        env.storage()
            .persistent()
            .extend_ttl(&key, DAILY_USAGE_TTL, DAILY_USAGE_TTL);
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

    /// Returns the total funds currently held by the reward pool.
    pub fn get_balance(env: Env) -> i128 {
        env.storage().instance().get(&DataKey::Balance).unwrap_or(0)
    }

    /// Returns the configured per-wallet daily withdrawal cap.
    pub fn get_daily_limit(env: Env) -> i128 {
        env.storage()
            .instance()
            .get(&DataKey::DailyLimit)
            .unwrap_or(i128::MAX)
    }

    pub fn get_daily_usage(env: Env, wallet: Address) -> DailyUsage {
        read_daily_usage(&env, &wallet)
    }
}

fn read_admin(env: &Env) -> Address {
    env.storage()
        .instance()
        .get(&DataKey::Admin)
        .expect("not initialized")
}

fn read_daily_usage(env: &Env, wallet: &Address) -> DailyUsage {
    let key = DataKey::DailyUsage(wallet.clone());
    if env.storage().persistent().has(&key) {
        let usage = env.storage().persistent().get(&key).unwrap();
        env.storage()
            .persistent()
            .extend_ttl(&key, DAILY_USAGE_TTL, DAILY_USAGE_TTL);
        usage
    } else {
        DailyUsage {
            amount: 0,
            window_started_at: 0,
        }
    }
}

fn write_daily_usage(env: &Env, wallet: &Address, usage: &DailyUsage) {
    let key = DataKey::DailyUsage(wallet.clone());
    env.storage().persistent().set(&key, usage);
    env.storage()
        .persistent()
        .extend_ttl(&key, DAILY_USAGE_TTL, DAILY_USAGE_TTL);
}

fn assert_positive_amount(amount: i128) {
    if amount <= 0 {
        panic!("amount must be positive");
    /// Returns the tracked 24-hour withdrawal usage for a wallet.
    pub fn get_daily_usage(env: Env, wallet: Address) -> DailyUsage {
        Self::current_usage(&env, &wallet)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{
        testutils::{Address as _, Events},
        Env,
    };

    fn setup() -> (Env, Address, RewardPoolContractClient<'static>) {
        let env = Env::default();
        env.mock_all_auths();
        let id = env.register(RewardPoolContract, ());
        let client = RewardPoolContractClient::new(&env, &id);
        let admin = Address::generate(&env);
        client.initialize(&admin);
        (env, admin, client)
    }

    #[test]
    fn test_deposit_withdraw_events() {
        let (env, _admin, client) = setup();
        let depositor = Address::generate(&env);
        let recipient = Address::generate(&env);

        client.deposit(&depositor, &1_000);
        client.withdraw(&recipient, &400);

        assert_eq!(client.get_balance(), 600);
        let _ = env.events().all();
    }

    #[test]
    #[should_panic(expected = "insufficient pool balance")]
    fn test_withdraw_overdraft() {
        let (env, _admin, client) = setup();
        let recipient = Address::generate(&env);

        client.withdraw(&recipient, &1);
    }
}
