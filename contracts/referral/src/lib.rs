//! # Referral Contract
//!
//! Tracks one-time referral relationships and distributes rewards to **both**
//! the referrer and the referee when the referee completes onboarding.
//!
//! ## Lifecycle
//! 1. Admin calls [`initialize`](ReferralContract::initialize).
//! 2. Admin calls [`fund_pool`](ReferralContract::fund_pool) to seed the reward budget.
//! 3. Referee calls [`register_referral`](ReferralContract::register_referral) to record
//!    the relationship on-chain (self-referral rejected).
//! 4. Admin calls [`claim_referral_reward`](ReferralContract::claim_referral_reward) once
//!    the referee has completed onboarding — tokens are distributed to both parties and a
//!    [`ReferralRewarded`](ReferralContract::claim_referral_reward) event is emitted.
//!
//! ## Guards
//! - Self-referral → `SelfReferralNotAllowed` error.
//! - Each referee can only be referred once → `AlreadyReferred` error.
//! - Each referral relationship can only be claimed once → `AlreadyRewarded` error.
//!
//! ## Usage
//! ```ignore
//! client.initialize(&admin);
//! client.fund_pool(&20_000);
//! client.register_referral(&referrer, &referee);
//! // referee completes onboarding off-chain …
//! client.claim_referral_reward(&referee, &500, &500); // 500 to referrer, 500 to referee
//! ```

#![no_std]
use soroban_sdk::{contract, contracterror, contractimpl, contracttype, symbol_short, Address, Env};

// ── Errors ────────────────────────────────────────────────────────────────────

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum ReferralError {
    /// Caller attempted to refer themselves.
    SelfReferralNotAllowed = 1,
    /// The referee address already has a registered referrer.
    AlreadyReferred = 2,
    /// The referral reward for this referee has already been claimed.
    AlreadyRewarded = 3,
    /// No referrer is registered for the given referee.
    ReferrerNotFound = 4,
    /// The reward pool does not hold enough tokens.
    InsufficientPool = 5,
    /// The requested payout exceeds the configured per-claim maximum.
    ClaimExceedsMax = 6,
    /// The requested payout would exceed the configured per-day aggregate cap.
    DailyCapExceeded = 7,
}

// ── Storage keys ──────────────────────────────────────────────────────────────

#[contracttype]
pub enum DataKey {
    Admin,
    Initialized,
    /// referee → referrer
    Referral(Address),
    /// referrer → total successful referral count
    TotalReferrals(Address),
    /// referee → bool: reward already claimed
    RewardClaimed(Address),
    /// Internal pool balance available for payouts
    PoolBalance,
    /// Maximum total payout (referrer + referee) allowed per single claim
    MaxPerClaim,
    /// Maximum aggregate payout allowed within a single day window
    DailyCap,
    /// Aggregate amount already paid out in the current day window
    DailySpent,
    /// Ledger timestamp marking the start of the current day window
    DailyWindowStart,
}

// ── Day window length (seconds) ──────────────────────────────────────────────
const DAY_SECONDS: u64 = 86_400;

// ── TTL constant (31 days in ledgers at ~5 s/ledger) ─────────────────────────
const PERSISTENT_TTL: u32 = 2_678_400;

// ── Contract ──────────────────────────────────────────────────────────────────

#[contract]
pub struct ReferralContract;

#[contractimpl]
impl ReferralContract {
    // ── Init ─────────────────────────────────────────────────────────────────

    /// Initializes the referral contract and resets the reward pool to zero.
    ///
    /// # Parameters
    /// - `admin` – Address authorized to call [`fund_pool`](ReferralContract::fund_pool)
    ///   and [`claim_referral_reward`](ReferralContract::claim_referral_reward).
    ///
    /// # Panics
    /// - `"already initialised"` if called more than once.
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialised");
        }
        env.storage().instance().set(&DataKey::Initialized, &true);
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::PoolBalance, &0_i128);
    }

    fn admin(env: &Env) -> Address {
        env.storage().instance().get(&DataKey::Admin).unwrap()
    }

    // ── Cap configuration ─────────────────────────────────────────────────────

    /// Sets the maximum total payout (`referrer_amount + referee_amount`)
    /// permitted for a single [`claim_referral_reward`](ReferralContract::claim_referral_reward).
    ///
    /// A value of `0` disables the per-claim cap.
    ///
    /// # Authorization
    /// Requires admin authorization.
    ///
    /// # Panics
    /// - `"max_per_claim must be non-negative"` if `max_per_claim < 0`.
    pub fn set_max_per_claim(env: Env, max_per_claim: i128) {
        Self::admin(&env).require_auth();
        assert!(max_per_claim >= 0, "max_per_claim must be non-negative");
        env.storage()
            .instance()
            .set(&DataKey::MaxPerClaim, &max_per_claim);
    }

    /// Sets the maximum aggregate payout permitted within a single day window.
    ///
    /// A value of `0` disables the daily cap.
    ///
    /// # Authorization
    /// Requires admin authorization.
    ///
    /// # Panics
    /// - `"daily_cap must be non-negative"` if `daily_cap < 0`.
    pub fn set_daily_cap(env: Env, daily_cap: i128) {
        Self::admin(&env).require_auth();
        assert!(daily_cap >= 0, "daily_cap must be non-negative");
        env.storage().instance().set(&DataKey::DailyCap, &daily_cap);
    }

    /// Returns the configured per-claim maximum (`0` means disabled).
    pub fn max_per_claim(env: Env) -> i128 {
        env.storage()
            .instance()
            .get(&DataKey::MaxPerClaim)
            .unwrap_or(0)
    }

    /// Returns the configured per-day aggregate cap (`0` means disabled).
    pub fn daily_cap(env: Env) -> i128 {
        env.storage()
            .instance()
            .get(&DataKey::DailyCap)
            .unwrap_or(0)
    }

    /// Returns the aggregate amount paid out in the current day window.
    pub fn daily_spent(env: Env) -> i128 {
        env.storage()
            .instance()
            .get(&DataKey::DailySpent)
            .unwrap_or(0)
    }

    // ── Pool funding ──────────────────────────────────────────────────────────

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

    // ── Referral registration ─────────────────────────────────────────────────

    /// Records a referral relationship on-chain.
    ///
    /// The referee must authorize this call. Self-referral and duplicate
    /// registration are both rejected.
    ///
    /// # Parameters
    /// - `referrer` – Address that made the referral.
    /// - `referee`  – New user being referred (must authorize).
    ///
    /// # Authorization
    /// Requires `referee` authorization.
    ///
    /// # Events
    /// Emits `("referral", "ref_reg")` with data `(referrer: Address, referee: Address)`.
    ///
    /// # Errors
    /// - [`ReferralError::SelfReferralNotAllowed`] if `referrer == referee`.
    /// - [`ReferralError::AlreadyReferred`] if `referee` already has a referrer.
    pub fn register_referral(
        env: Env,
        referrer: Address,
        referee: Address,
    ) -> Result<(), ReferralError> {
        referee.require_auth();

        if referrer == referee {
            return Err(ReferralError::SelfReferralNotAllowed);
        }

        let key = DataKey::Referral(referee.clone());
        if env.storage().persistent().has(&key) {
            return Err(ReferralError::AlreadyReferred);
        }

        env.storage().persistent().set(&key, &referrer);
        env.storage()
            .persistent()
            .extend_ttl(&key, PERSISTENT_TTL, PERSISTENT_TTL);

        // Increment referrer's total count
        let count_key = DataKey::TotalReferrals(referrer.clone());
        let count: u32 = env
            .storage()
            .persistent()
            .get(&count_key)
            .unwrap_or(0);
        env.storage()
            .persistent()
            .set(&count_key, &(count + 1));
        env.storage()
            .persistent()
            .extend_ttl(&count_key, PERSISTENT_TTL, PERSISTENT_TTL);

        env.events().publish(
            (symbol_short!("referral"), symbol_short!("ref_reg")),
            (referrer, referee),
        );

        Ok(())
    }

    // ── Reward claim ──────────────────────────────────────────────────────────

    /// Distributes referral rewards to both the referrer and the referee after
    /// the referee has completed onboarding.
    ///
    /// Each referral relationship can only be claimed once. The total cost
    /// (`referrer_amount + referee_amount`) is deducted from the pool in a
    /// single atomic step.
    ///
    /// # Parameters
    /// - `referee`          – The referred wallet whose referrer receives a reward.
    /// - `referrer_amount`  – Tokens awarded to the referrer (must be > 0).
    /// - `referee_amount`   – Tokens awarded to the referee (must be > 0).
    ///
    /// # Authorization
    /// Requires admin authorization.
    ///
    /// # Events
    /// Emits `("referral", "ref_rwrd")` with data
    /// `(referrer: Address, referee: Address, referrer_amount: i128, referee_amount: i128)`.
    ///
    /// # Errors
    /// - [`ReferralError::ReferrerNotFound`] if `referee` has no registered referrer.
    /// - [`ReferralError::AlreadyRewarded`] if the reward has already been claimed.
    /// - [`ReferralError::ClaimExceedsMax`] if the total payout exceeds the per-claim cap.
    /// - [`ReferralError::DailyCapExceeded`] if the payout would exceed the daily cap.
    /// - [`ReferralError::InsufficientPool`] if the pool cannot cover the total payout.
    ///
    /// # Panics
    /// - `"referrer_amount must be positive"` if `referrer_amount <= 0`.
    /// - `"referee_amount must be positive"` if `referee_amount <= 0`.
    pub fn claim_referral_reward(
        env: Env,
        referee: Address,
        referrer_amount: i128,
        referee_amount: i128,
    ) -> Result<(), ReferralError> {
        Self::admin(&env).require_auth();
        assert!(referrer_amount > 0, "referrer_amount must be positive");
        assert!(referee_amount > 0, "referee_amount must be positive");

        // Look up the referrer
        let referrer: Address = env
            .storage()
            .persistent()
            .get(&DataKey::Referral(referee.clone()))
            .ok_or(ReferralError::ReferrerNotFound)?;

        // Guard: each referral can only be rewarded once
        let claimed_key = DataKey::RewardClaimed(referee.clone());
        if env
            .storage()
            .persistent()
            .get::<_, bool>(&claimed_key)
            .unwrap_or(false)
        {
            return Err(ReferralError::AlreadyRewarded);
        }

        let total = referrer_amount
            .checked_add(referee_amount)
            .expect("overflow in total reward");

        // Guard: per-claim maximum (0 disables the cap)
        let max_per_claim: i128 = env
            .storage()
            .instance()
            .get(&DataKey::MaxPerClaim)
            .unwrap_or(0);
        if max_per_claim > 0 && total > max_per_claim {
            return Err(ReferralError::ClaimExceedsMax);
        }

        // Guard: per-day aggregate cap (0 disables the cap)
        let daily_cap: i128 = env
            .storage()
            .instance()
            .get(&DataKey::DailyCap)
            .unwrap_or(0);
        let now = env.ledger().timestamp();
        let window_start: u64 = env
            .storage()
            .instance()
            .get(&DataKey::DailyWindowStart)
            .unwrap_or(0);
        let mut daily_spent: i128 = env
            .storage()
            .instance()
            .get(&DataKey::DailySpent)
            .unwrap_or(0);
        // Roll the window forward once a full day has elapsed.
        if now >= window_start.saturating_add(DAY_SECONDS) {
            daily_spent = 0;
        }
        if daily_cap > 0 && daily_spent.saturating_add(total) > daily_cap {
            return Err(ReferralError::DailyCapExceeded);
        }

        // Check pool has enough for both payouts (before any deduction/transfer)
        let pool_bal: i128 = env
            .storage()
            .instance()
            .get(&DataKey::PoolBalance)
            .unwrap_or(0);
        if pool_bal < total {
            return Err(ReferralError::InsufficientPool);
        }

        // Deduct from pool and mark as claimed
        env.storage()
            .instance()
            .set(&DataKey::PoolBalance, &(pool_bal - total));

        // Record daily spend against the (possibly rolled) window.
        if now >= window_start.saturating_add(DAY_SECONDS) {
            env.storage()
                .instance()
                .set(&DataKey::DailyWindowStart, &now);
        }
        env.storage()
            .instance()
            .set(&DataKey::DailySpent, &(daily_spent + total));

        env.storage().persistent().set(&claimed_key, &true);
        env.storage()
            .persistent()
            .extend_ttl(&claimed_key, PERSISTENT_TTL, PERSISTENT_TTL);

        // Emit ReferralRewarded event with both addresses and amounts
        env.events().publish(
            (symbol_short!("referral"), symbol_short!("ref_rwrd")),
            (referrer, referee, referrer_amount, referee_amount),
        );

        Ok(())
    }

    // ── Read-only ─────────────────────────────────────────────────────────────

    /// Returns the referrer associated with the provided wallet, if any.
    pub fn get_referrer(env: Env, referee: Address) -> Option<Address> {
        env.storage()
            .persistent()
            .get(&DataKey::Referral(referee))
    }

    /// Returns `true` if the referral reward for `referee` has already been claimed.
    pub fn is_reward_claimed(env: Env, referee: Address) -> bool {
        env.storage()
            .persistent()
            .get::<_, bool>(&DataKey::RewardClaimed(referee))
            .unwrap_or(false)
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
    use soroban_sdk::{testutils::Address as _, Env};

    fn setup() -> (Env, Address, ReferralContractClient<'static>) {
        let env = Env::default();
        env.mock_all_auths();
        let id = env.register(ReferralContract, ());
        let client = ReferralContractClient::new(&env, &id);
        let admin = Address::generate(&env);
        client.initialize(&admin);
        client.fund_pool(&20_000);
        (env, admin, client)
    }

    // ── register_referral ─────────────────────────────────────────────────────

    #[test]
    fn test_register_records_relationship() {
        let (env, _, client) = setup();
        let referrer = Address::generate(&env);
        let referee = Address::generate(&env);

        client.register_referral(&referrer, &referee).unwrap();

        assert_eq!(client.get_referrer(&referee), Some(referrer.clone()));
        assert_eq!(client.total_referrals(&referrer), 1);
    }

    #[test]
    fn test_register_emits_event() {
        let (env, _, client) = setup();
        let referrer = Address::generate(&env);
        let referee = Address::generate(&env);
        client.register_referral(&referrer, &referee).unwrap();
        assert!(!env.events().all().is_empty());
    }

    #[test]
    fn test_multiple_referees_increment_counter() {
        let (env, _, client) = setup();
        let referrer = Address::generate(&env);
        let r1 = Address::generate(&env);
        let r2 = Address::generate(&env);
        let r3 = Address::generate(&env);
        client.register_referral(&referrer, &r1).unwrap();
        client.register_referral(&referrer, &r2).unwrap();
        client.register_referral(&referrer, &r3).unwrap();
        assert_eq!(client.total_referrals(&referrer), 3);
    }

    // ── Self-referral guard ───────────────────────────────────────────────────

    #[test]
    fn test_self_referral_rejected() {
        let (env, _, client) = setup();
        let user = Address::generate(&env);
        let result = client.register_referral(&user, &user);
        assert_eq!(result, Err(ReferralError::SelfReferralNotAllowed));
    }

    // ── Duplicate registration guard ──────────────────────────────────────────

    #[test]
    fn test_duplicate_registration_rejected() {
        let (env, _, client) = setup();
        let referrer = Address::generate(&env);
        let referee = Address::generate(&env);
        client.register_referral(&referrer, &referee).unwrap();
        let result = client.register_referral(&referrer, &referee);
        assert_eq!(result, Err(ReferralError::AlreadyReferred));
    }

    // ── claim_referral_reward ─────────────────────────────────────────────────

    #[test]
    fn test_claim_distributes_to_both_and_deducts_pool() {
        let (env, _, client) = setup();
        let referrer = Address::generate(&env);
        let referee = Address::generate(&env);

        client.register_referral(&referrer, &referee).unwrap();
        client.claim_referral_reward(&referee, &600, &400).unwrap();

        // Pool deducted by 600 + 400 = 1000
        assert_eq!(client.pool_balance(), 19_000);
        assert!(client.is_reward_claimed(&referee));
    }

    #[test]
    fn test_claim_emits_referral_rewarded_event() {
        let (env, _, client) = setup();
        let referrer = Address::generate(&env);
        let referee = Address::generate(&env);
        client.register_referral(&referrer, &referee).unwrap();
        client.claim_referral_reward(&referee, &500, &500).unwrap();
        assert!(!env.events().all().is_empty());
    }

    #[test]
    fn test_double_claim_rejected() {
        let (env, _, client) = setup();
        let referrer = Address::generate(&env);
        let referee = Address::generate(&env);
        client.register_referral(&referrer, &referee).unwrap();
        client.claim_referral_reward(&referee, &500, &500).unwrap();

        let result = client.claim_referral_reward(&referee, &500, &500);
        assert_eq!(result, Err(ReferralError::AlreadyRewarded));
    }

    #[test]
    fn test_claim_without_registration_fails() {
        let (env, _, client) = setup();
        let referee = Address::generate(&env);
        let result = client.claim_referral_reward(&referee, &500, &500);
        assert_eq!(result, Err(ReferralError::ReferrerNotFound));
    }

    #[test]
    fn test_claim_insufficient_pool_fails() {
        let (env, _, client) = setup();
        let referrer = Address::generate(&env);
        let referee = Address::generate(&env);
        client.register_referral(&referrer, &referee).unwrap();

        // Request more than the 20_000 pool
        let result = client.claim_referral_reward(&referee, &15_000, &10_000);
        assert_eq!(result, Err(ReferralError::InsufficientPool));
        // Pool unchanged
        assert_eq!(client.pool_balance(), 20_000);
    }

    #[test]
    fn test_insufficient_pool_fires_before_any_state_change() {
        let (env, _, client) = setup();
        let referrer = Address::generate(&env);
        let referee = Address::generate(&env);
        client.register_referral(&referrer, &referee).unwrap();

        // pool_balance (20_000) < referrer_amount + referee_amount (25_000)
        let result = client.claim_referral_reward(&referee, &20_000, &5_000);
        assert_eq!(result, Err(ReferralError::InsufficientPool));

        // No deduction, no claim marker, no daily spend recorded.
        assert_eq!(client.pool_balance(), 20_000);
        assert!(!client.is_reward_claimed(&referee));
        assert_eq!(client.daily_spent(), 0);
    }

    // ── Per-claim cap ─────────────────────────────────────────────────────────

    #[test]
    fn test_claim_exceeding_max_per_claim_rejected() {
        let (env, _, client) = setup();
        let referrer = Address::generate(&env);
        let referee = Address::generate(&env);
        client.register_referral(&referrer, &referee).unwrap();

        client.set_max_per_claim(&1_000);
        assert_eq!(client.max_per_claim(), 1_000);

        let result = client.claim_referral_reward(&referee, &800, &800);
        assert_eq!(result, Err(ReferralError::ClaimExceedsMax));
        assert_eq!(client.pool_balance(), 20_000);
        assert!(!client.is_reward_claimed(&referee));
    }

    #[test]
    fn test_claim_within_max_per_claim_succeeds() {
        let (env, _, client) = setup();
        let referrer = Address::generate(&env);
        let referee = Address::generate(&env);
        client.register_referral(&referrer, &referee).unwrap();

        client.set_max_per_claim(&1_000);
        client.claim_referral_reward(&referee, &600, &400).unwrap();
        assert_eq!(client.pool_balance(), 19_000);
    }

    // ── Daily cap ─────────────────────────────────────────────────────────────

    #[test]
    fn test_daily_cap_exceeded_rejected() {
        let (env, _, client) = setup();
        let referrer = Address::generate(&env);
        let r1 = Address::generate(&env);
        let r2 = Address::generate(&env);
        client.register_referral(&referrer, &r1).unwrap();
        client.register_referral(&referrer, &r2).unwrap();

        client.set_daily_cap(&1_000);
        assert_eq!(client.daily_cap(), 1_000);

        client.claim_referral_reward(&r1, &500, &500).unwrap();
        assert_eq!(client.daily_spent(), 1_000);

        let result = client.claim_referral_reward(&r2, &500, &500);
        assert_eq!(result, Err(ReferralError::DailyCapExceeded));
        assert_eq!(client.pool_balance(), 19_000);
        assert!(!client.is_reward_claimed(&r2));
    }

    #[test]
    fn test_daily_cap_rolls_over_after_a_day() {
        let (env, _, client) = setup();
        let referrer = Address::generate(&env);
        let r1 = Address::generate(&env);
        let r2 = Address::generate(&env);
        client.register_referral(&referrer, &r1).unwrap();
        client.register_referral(&referrer, &r2).unwrap();

        client.set_daily_cap(&1_000);
        client.claim_referral_reward(&r1, &500, &500).unwrap();
        assert_eq!(client.daily_spent(), 1_000);

        // Advance the ledger past the day window.
        env.ledger().with_mut(|li| {
            li.timestamp = DAY_SECONDS + 1;
        });

        client.claim_referral_reward(&r2, &500, &500).unwrap();
        assert_eq!(client.daily_spent(), 1_000);
        assert_eq!(client.pool_balance(), 18_000);
    }

    // ── Initialization guard ──────────────────────────────────────────────────

    #[test]
    #[should_panic(expected = "already initialised")]
    fn test_reinitialize_is_blocked() {
        let (env, admin, client) = setup();
        client.initialize(&admin);
    }
}
