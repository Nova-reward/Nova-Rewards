//! # Referral Contract
//!
//! Tracks one-time referral relationships and distributes rewards from a funded pool.
//!
//! ## Lifecycle
//! 1. Admin calls [`fund_pool`](ReferralContract::fund_pool) to seed the reward pool.
//! 2. A new user calls [`register_referral`](ReferralContract::register_referral) to link themselves to a referrer.
//! 3. Admin calls [`credit_referrer`](ReferralContract::credit_referrer) to pay out the reward.
//!
//! ## Usage
//! ```ignore
//! client.initialize(&admin);
//! client.fund_pool(&10_000);
//! client.register_referral(&referrer, &new_user);
//! client.credit_referrer(&new_user, &500);
//! ```
#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, symbol_short, Address, Env};

// ── Storage keys ──────────────────────────────────────────────────────────────
#[contracttype]
pub enum DataKey {
    Admin,
    /// referred -> referrer
    Referral(Address),
    /// referrer -> total count
    TotalReferrals(Address),
    /// Pool balance for reward payouts
    PoolBalance,
}

// ── Contract ──────────────────────────────────────────────────────────────────
#[contract]
pub struct ReferralContract;

#[contractimpl]
impl ReferralContract {
    /// Initializes the referral contract and resets the reward pool to zero.
    ///
    /// # Parameters
    /// - `admin` – Address authorized to call [`fund_pool`](ReferralContract::fund_pool)
    ///   and [`credit_referrer`](ReferralContract::credit_referrer).
    ///
    /// # Panics
    /// - `"already initialised"` if called more than once.
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialised");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::PoolBalance, &0_i128);
    }

    /// Returns the admin address stored in instance storage.
    fn admin(env: &Env) -> Address {
        env.storage().instance().get(&DataKey::Admin).unwrap()
    }

    /// Adds tokens to the referral reward pool.
    ///
    /// # Parameters
    /// - `amount` – Tokens to add (must be > 0).
    ///
    /// # Authorization
    /// Requires admin authorization.
    ///
    /// # Panics
    /// - `"amount must be positive"` if `amount <= 0`.
    pub fn fund_pool(env: Env, amount: i128) {
        Self::admin(&env).require_auth();
        assert!(amount > 0, "amount must be positive");
        let bal: i128 = env
            .storage()
            .instance()
            .get(&DataKey::PoolBalance)
            .unwrap_or(0);
        env.storage()
            .instance()
            .set(&DataKey::PoolBalance, &(bal + amount));
    }

    /// Registers a one-time referral relationship for a wallet.
    ///
    /// Each wallet can only be referred once. The referred wallet must authorize
    /// this call to prevent unauthorized referral registration.
    ///
    /// # Parameters
    /// - `referrer` – Address that made the referral.
    /// - `referred` – New user being referred (must authorize).
    ///
    /// # Authorization
    /// Requires `referred` authorization.
    ///
    /// # Events
    /// Emits `("referral", "ref_reg")` with data `(referrer: Address, referred: Address)`.
    ///
    /// # Panics
    /// - `"cannot refer yourself"` if `referrer == referred`.
    /// - `"already referred"` if `referred` already has a referrer registered.
    pub fn register_referral(env: Env, referrer: Address, referred: Address) {
        // referred wallet authorises the registration
        referred.require_auth();
        assert!(referrer != referred, "cannot refer yourself");

        let key = DataKey::Referral(referred.clone());
        if env.storage().persistent().has(&key) {
            panic!("already referred");
        }

        env.storage().persistent().set(&key, &referrer);

        // increment referrer counter
        let count_key = DataKey::TotalReferrals(referrer.clone());
        let count: u32 = env.storage().persistent().get(&count_key).unwrap_or(0);
        env.storage().persistent().set(&count_key, &(count + 1));

        env.events().publish(
            (symbol_short!("referral"), symbol_short!("ref_reg")),
            (referrer, referred),
        );
    }

    /// Returns the referrer associated with the provided wallet, if any.
    pub fn get_referrer(env: Env, referred: Address) -> Option<Address> {
        env.storage().persistent().get(&DataKey::Referral(referred))
    }

    /// Pays a referral reward from the pool to the stored referrer relationship.
    ///
    /// Deducts `reward_amount` from the pool and emits an on-chain credit event.
    /// In production, the off-chain service listens for this event to trigger
    /// the actual token transfer.
    ///
    /// # Parameters
    /// - `referred` – The referred wallet whose referrer receives the reward.
    /// - `reward_amount` – Amount to credit (must be > 0).
    ///
    /// # Authorization
    /// Requires admin authorization.
    ///
    /// # Events
    /// Emits `("referral", "ref_cred")` with data `(referrer: Address, referred: Address, amount: i128)`.
    ///
    /// # Panics
    /// - `"reward_amount must be positive"` if `reward_amount <= 0`.
    /// - `"no referrer found"` if `referred` has no registered referrer.
    /// - `"insufficient pool balance"` if the pool holds fewer tokens than `reward_amount`.
    pub fn credit_referrer(env: Env, referred: Address, reward_amount: i128) {
        Self::admin(&env).require_auth();
        assert!(reward_amount > 0, "reward_amount must be positive");

        let referrer: Address = env
            .storage()
            .persistent()
            .get(&DataKey::Referral(referred.clone()))
            .expect("no referrer found");

        let pool_bal: i128 = env
            .storage()
            .instance()
            .get(&DataKey::PoolBalance)
            .unwrap_or(0);
        assert!(pool_bal >= reward_amount, "insufficient pool balance");
        env.storage()
            .instance()
            .set(&DataKey::PoolBalance, &(pool_bal - reward_amount));

        // In a real deployment this would call the token contract transfer.
        // Here we emit the event to record the credit on-chain.
        env.events().publish(
            (symbol_short!("referral"), symbol_short!("ref_cred")),
            (referrer, referred, reward_amount),
        );
    }

    /// Returns how many successful referrals a referrer has registered.
    pub fn total_referrals(env: Env, referrer: Address) -> u32 {
        env.storage()
            .persistent()
            .get(&DataKey::TotalReferrals(referrer))
            .unwrap_or(0)
    }

    /// Returns the remaining reward balance held by the contract.
    pub fn pool_balance(env: Env) -> i128 {
        env.storage()
            .instance()
            .get(&DataKey::PoolBalance)
            .unwrap_or(0)
    }
}

// ── Tests ─────────────────────────────────────────────────────────────────────
#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{
        testutils::{Address as _, Events},
        Env,
    };

    fn setup() -> (Env, Address, ReferralContractClient<'static>) {
        let env = Env::default();
        env.mock_all_auths();
        let id = env.register(ReferralContract, ());
        let client = ReferralContractClient::new(&env, &id);
        let admin = Address::generate(&env);
        client.initialize(&admin);
        client.fund_pool(&10_000);
        (env, admin, client)
    }

    #[test]
    fn test_first_time_registration() {
        let (env, _admin, client) = setup();
        let referrer = Address::generate(&env);
        let referred = Address::generate(&env);
        client.register_referral(&referrer, &referred);
        assert_eq!(client.get_referrer(&referred), Some(referrer.clone()));
        assert_eq!(client.total_referrals(&referrer), 1);
    }

    #[test]
    #[should_panic(expected = "already referred")]
    fn test_duplicate_registration_rejected() {
        let (env, _admin, client) = setup();
        let referrer = Address::generate(&env);
        let referred = Address::generate(&env);
        client.register_referral(&referrer, &referred);
        client.register_referral(&referrer, &referred); // should panic
    }

    #[test]
    fn test_referrer_credit() {
        let (env, _admin, client) = setup();
        let referrer = Address::generate(&env);
        let referred = Address::generate(&env);
        client.register_referral(&referrer, &referred);
        client.credit_referrer(&referred, &500);
        assert_eq!(client.pool_balance(), 9_500);
        let _ = env.events().all(); // drain; event emission verified via snapshot
    }

    #[test]
    fn test_counter_increments() {
        let (env, _admin, client) = setup();
        let referrer = Address::generate(&env);
        let r1 = Address::generate(&env);
        let r2 = Address::generate(&env);
        let r3 = Address::generate(&env);
        client.register_referral(&referrer, &r1);
        client.register_referral(&referrer, &r2);
        client.register_referral(&referrer, &r3);
        assert_eq!(client.total_referrals(&referrer), 3);
    }

    #[test]
    fn test_registration_emits_event() {
        let (env, _admin, client) = setup();
        let referrer = Address::generate(&env);
        let referred = Address::generate(&env);
        client.register_referral(&referrer, &referred);
        let _ = env.events().all(); // drain; event emission verified via snapshot
    }
}
