//! # Redemption Contract
//!
//! Create, validate, process, and track NOVA token redemption requests.
//! Users burn reward tokens in exchange for merchant-defined perks.
//!
//! ## Expiry mechanism
//! Each campaign has a configurable `expiry_ledger_offset` — the number of
//! ledgers after issuance before a reward expires. When a reward is issued via
//! [`issue_reward`](RedemptionContract::issue_reward), the contract records
//! `expiration_ledger = current_ledger + expiry_ledger_offset`. Calling
//! [`redeem`](RedemptionContract::redeem) after that ledger returns
//! [`RedemptionError::RewardExpired`] and emits a `RewardExpired` event.
//! The admin can call [`reclaim_expired`](RedemptionContract::reclaim_expired)
//! to return the unclaimed balance back to the campaign treasury pool.
//!
//! ## Lifecycle
//! 1. Admin calls [`initialize`](RedemptionContract::initialize).
//! 2. Admin calls [`set_campaign_expiry`](RedemptionContract::set_campaign_expiry)
//!    to configure the expiry window per campaign.
//! 3. Admin calls [`issue_reward`](RedemptionContract::issue_reward) to allocate
//!    tokens to a user for a specific campaign.
//! 4. User calls [`redeem`](RedemptionContract::redeem) before the expiry ledger.
//! 5. Admin calls [`reclaim_expired`](RedemptionContract::reclaim_expired) to
//!    sweep expired, unclaimed rewards back to the treasury pool.
//!
//! ## Usage
//! ```ignore
//! client.initialize(&admin);
//! client.set_campaign_expiry(&campaign_id, &50_000); // expires in 50 000 ledgers
//! client.issue_reward(&campaign_id, &user, &1_000);
//! // before expiry:
//! client.redeem(&campaign_id, &user);
//! // or after expiry:
//! client.reclaim_expired(&campaign_id, &user);
//! ```

#![no_std]
use soroban_sdk::{contract, contracterror, contractimpl, contracttype, symbol_short, Address, Env};

// ── Constants ─────────────────────────────────────────────────────────────────

/// Default persistent storage TTL extension (31 days in ledgers at ~5 s/ledger).
const PERSISTENT_TTL: u32 = 2_678_400;

// ── Errors ────────────────────────────────────────────────────────────────────

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum RedemptionError {
    /// The reward has passed its expiration ledger and can no longer be redeemed.
    RewardExpired = 1,
    /// No reward has been issued to this user for the given campaign.
    RewardNotFound = 2,
    /// The reward has already been redeemed.
    AlreadyRedeemed = 3,
    /// The reward has not yet expired; reclaim is not permitted.
    RewardNotExpired = 4,
}

// ── Types ─────────────────────────────────────────────────────────────────────

/// A reward issuance record stored per (campaign, user).
#[contracttype]
#[derive(Clone)]
pub struct RewardRecord {
    /// Token amount allocated to the user.
    pub amount: i128,
    /// Ledger sequence number after which this reward is considered expired.
    pub expiration_ledger: u32,
    /// Whether the user has already redeemed this reward.
    pub redeemed: bool,
}

#[contracttype]
pub enum DataKey {
    Admin,
    /// campaign_id → expiry_ledger_offset (u32): ledgers added to current ledger at issuance
    CampaignExpiry(u64),
    /// (campaign_id, user) → RewardRecord
    Reward(u64, Address),
    /// campaign_id → treasury pool balance (i128): reclaimed expired rewards accumulate here
    TreasuryPool(u64),
}

// ── Contract ──────────────────────────────────────────────────────────────────

#[contract]
pub struct RedemptionContract;

#[contractimpl]
impl RedemptionContract {
    // ── Init ─────────────────────────────────────────────────────────────────

    /// One-time setup. Stores the admin address.
    ///
    /// # Parameters
    /// - `admin` – Address authorized to call admin-gated functions.
    ///
    /// # Panics
    /// - `"already initialised"` if called more than once.
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialised");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
    }

    fn admin(env: &Env) -> Address {
        env.storage().instance().get(&DataKey::Admin).unwrap()
    }

    // ── Campaign expiry configuration ─────────────────────────────────────────

    /// Sets the expiry window for a campaign in ledgers.
    ///
    /// When a reward is issued for `campaign_id`, its `expiration_ledger` is set
    /// to `current_ledger + expiry_ledger_offset`. A value of `0` means rewards
    /// never expire.
    ///
    /// # Parameters
    /// - `campaign_id`          – Campaign identifier.
    /// - `expiry_ledger_offset` – Ledgers from issuance until expiry (0 = no expiry).
    ///
    /// # Authorization
    /// Requires admin authorization.
    ///
    /// # Events
    /// Emits `("redeem", "exp_set")` with data `(campaign_id: u64, expiry_ledger_offset: u32)`.
    pub fn set_campaign_expiry(env: Env, campaign_id: u64, expiry_ledger_offset: u32) {
        Self::admin(&env).require_auth();
        env.storage()
            .instance()
            .set(&DataKey::CampaignExpiry(campaign_id), &expiry_ledger_offset);

        env.events().publish(
            (symbol_short!("redeem"), symbol_short!("exp_set")),
            (campaign_id, expiry_ledger_offset),
        );
    }

    /// Returns the configured expiry offset for a campaign (0 if not set / no expiry).
    pub fn get_campaign_expiry(env: Env, campaign_id: u64) -> u32 {
        env.storage()
            .instance()
            .get(&DataKey::CampaignExpiry(campaign_id))
            .unwrap_or(0)
    }

    // ── Reward issuance ───────────────────────────────────────────────────────

    /// Issues a reward allocation to a user for a specific campaign.
    ///
    /// The `expiration_ledger` is computed as
    /// `current_ledger + expiry_ledger_offset` where `expiry_ledger_offset` is
    /// the value set via [`set_campaign_expiry`](RedemptionContract::set_campaign_expiry).
    /// If no expiry is configured (`offset == 0`), `expiration_ledger` is set to
    /// `u32::MAX` (effectively never expires).
    ///
    /// # Parameters
    /// - `campaign_id` – Campaign the reward belongs to.
    /// - `user`        – Recipient of the reward.
    /// - `amount`      – Token amount to allocate (must be > 0).
    ///
    /// # Authorization
    /// Requires admin authorization.
    ///
    /// # Events
    /// Emits `("redeem", "issued")` with data
    /// `(campaign_id: u64, user: Address, amount: i128, expiration_ledger: u32)`.
    ///
    /// # Panics
    /// - `"amount must be positive"` if `amount <= 0`.
    pub fn issue_reward(env: Env, campaign_id: u64, user: Address, amount: i128) {
        Self::admin(&env).require_auth();
        assert!(amount > 0, "amount must be positive");

        let offset: u32 = env
            .storage()
            .instance()
            .get(&DataKey::CampaignExpiry(campaign_id))
            .unwrap_or(0);

        let expiration_ledger: u32 = if offset == 0 {
            u32::MAX
        } else {
            env.ledger()
                .sequence()
                .checked_add(offset)
                .unwrap_or(u32::MAX)
        };

        let record = RewardRecord {
            amount,
            expiration_ledger,
            redeemed: false,
        };

        let key = DataKey::Reward(campaign_id, user.clone());
        env.storage().persistent().set(&key, &record);
        env.storage()
            .persistent()
            .extend_ttl(&key, PERSISTENT_TTL, PERSISTENT_TTL);

        env.events().publish(
            (symbol_short!("redeem"), symbol_short!("issued")),
            (campaign_id, user, amount, expiration_ledger),
        );
    }

    // ── Redemption ────────────────────────────────────────────────────────────

    /// Redeems a reward for the caller.
    ///
    /// Fails with [`RedemptionError::RewardExpired`] if the current ledger
    /// sequence exceeds `expiration_ledger`. Also emits a `RewardExpired` event
    /// when expiry is detected so off-chain indexers can track it.
    ///
    /// # Parameters
    /// - `campaign_id` – Campaign the reward belongs to.
    /// - `user`        – Address redeeming the reward (must authorize).
    ///
    /// # Authorization
    /// Requires `user` authorization.
    ///
    /// # Events
    /// - Emits `("redeem", "redeemed")` with data `(campaign_id, user, amount)` on success.
    /// - Emits `("redeem", "expired")` with data `(campaign_id, user, expiration_ledger)`
    ///   when the reward is found to be expired.
    ///
    /// # Errors
    /// - [`RedemptionError::RewardNotFound`] if no reward exists for `(campaign_id, user)`.
    /// - [`RedemptionError::AlreadyRedeemed`] if the reward was already redeemed.
    /// - [`RedemptionError::RewardExpired`] if `current_ledger > expiration_ledger`.
    pub fn redeem(
        env: Env,
        campaign_id: u64,
        user: Address,
    ) -> Result<i128, RedemptionError> {
        user.require_auth();

        let key = DataKey::Reward(campaign_id, user.clone());
        let mut record: RewardRecord = env
            .storage()
            .persistent()
            .get(&key)
            .ok_or(RedemptionError::RewardNotFound)?;

        if record.redeemed {
            return Err(RedemptionError::AlreadyRedeemed);
        }

        // Check expiry
        if env.ledger().sequence() > record.expiration_ledger {
            // Emit RewardExpired event so indexers can track it
            env.events().publish(
                (symbol_short!("redeem"), symbol_short!("expired")),
                (campaign_id, user, record.expiration_ledger),
            );
            return Err(RedemptionError::RewardExpired);
        }

        // Mark as redeemed
        record.redeemed = true;
        env.storage().persistent().set(&key, &record);
        env.storage()
            .persistent()
            .extend_ttl(&key, PERSISTENT_TTL, PERSISTENT_TTL);

        env.events().publish(
            (symbol_short!("redeem"), symbol_short!("redeemed")),
            (campaign_id, user, record.amount),
        );

        Ok(record.amount)
    }

    // ── Expired reward reclaim ────────────────────────────────────────────────

    /// Reclaims an expired, unclaimed reward back to the campaign treasury pool.
    ///
    /// Only callable by the admin. The reward must be expired and not yet redeemed.
    /// The reclaimed amount is added to `TreasuryPool(campaign_id)` for accounting.
    ///
    /// # Parameters
    /// - `campaign_id` – Campaign the reward belongs to.
    /// - `user`        – Address whose expired reward is being reclaimed.
    ///
    /// # Authorization
    /// Requires admin authorization.
    ///
    /// # Events
    /// Emits `("redeem", "reclaimed")` with data `(campaign_id, user, amount)`.
    ///
    /// # Errors
    /// - [`RedemptionError::RewardNotFound`] if no reward exists for `(campaign_id, user)`.
    /// - [`RedemptionError::AlreadyRedeemed`] if the reward was already redeemed.
    /// - [`RedemptionError::RewardNotExpired`] if the reward has not yet expired.
    pub fn reclaim_expired(
        env: Env,
        campaign_id: u64,
        user: Address,
    ) -> Result<i128, RedemptionError> {
        Self::admin(&env).require_auth();

        let key = DataKey::Reward(campaign_id, user.clone());
        let mut record: RewardRecord = env
            .storage()
            .persistent()
            .get(&key)
            .ok_or(RedemptionError::RewardNotFound)?;

        if record.redeemed {
            return Err(RedemptionError::AlreadyRedeemed);
        }

        if env.ledger().sequence() <= record.expiration_ledger {
            return Err(RedemptionError::RewardNotExpired);
        }

        // Mark as redeemed so it cannot be reclaimed twice
        record.redeemed = true;
        env.storage().persistent().set(&key, &record);
        env.storage()
            .persistent()
            .extend_ttl(&key, PERSISTENT_TTL, PERSISTENT_TTL);

        // Accumulate in the campaign treasury pool
        let pool_key = DataKey::TreasuryPool(campaign_id);
        let pool: i128 = env
            .storage()
            .instance()
            .get(&pool_key)
            .unwrap_or(0);
        env.storage()
            .instance()
            .set(&pool_key, &(pool + record.amount));

        env.events().publish(
            (symbol_short!("redeem"), symbol_short!("reclaimed")),
            (campaign_id, user, record.amount),
        );

        Ok(record.amount)
    }

    // ── Read-only ─────────────────────────────────────────────────────────────

    /// Returns the reward record for a `(campaign_id, user)` pair, if it exists.
    pub fn get_reward(env: Env, campaign_id: u64, user: Address) -> Option<RewardRecord> {
        let key = DataKey::Reward(campaign_id, user);
        let record = env.storage().persistent().get(&key)?;
        env.storage()
            .persistent()
            .extend_ttl(&key, PERSISTENT_TTL, PERSISTENT_TTL);
        Some(record)
    }

    /// Returns the accumulated reclaimed balance for a campaign's treasury pool.
    pub fn treasury_pool(env: Env, campaign_id: u64) -> i128 {
        env.storage()
            .instance()
            .get(&DataKey::TreasuryPool(campaign_id))
            .unwrap_or(0)
    }

    /// Returns the admin address.
    pub fn get_admin(env: Env) -> Address {
        Self::admin(&env)
    }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{testutils::{Address as _, Ledger}, Env};

    fn setup() -> (Env, Address, RedemptionContractClient<'static>) {
        let env = Env::default();
        env.mock_all_auths();
        let id = env.register(RedemptionContract, ());
        let client = RedemptionContractClient::new(&env, &id);
        let admin = Address::generate(&env);
        client.initialize(&admin);
        (env, admin, client)
    }

    // ── Campaign expiry config ────────────────────────────────────────────────

    #[test]
    fn test_set_and_get_campaign_expiry() {
        let (_, _, client) = setup();
        client.set_campaign_expiry(&1, &50_000);
        assert_eq!(client.get_campaign_expiry(&1), 50_000);
    }

    #[test]
    fn test_default_expiry_is_zero() {
        let (_, _, client) = setup();
        assert_eq!(client.get_campaign_expiry(&99), 0);
    }

    // ── issue_reward ──────────────────────────────────────────────────────────

    #[test]
    fn test_issue_reward_stores_record() {
        let (env, _, client) = setup();
        let user = Address::generate(&env);
        client.set_campaign_expiry(&1, &10_000);
        client.issue_reward(&1, &user, &500);

        let record = client.get_reward(&1, &user).unwrap();
        assert_eq!(record.amount, 500);
        assert!(!record.redeemed);
        // expiration_ledger = 0 (initial sequence) + 10_000
        assert_eq!(record.expiration_ledger, 10_000);
    }

    #[test]
    fn test_issue_reward_no_expiry_sets_max() {
        let (env, _, client) = setup();
        let user = Address::generate(&env);
        // No expiry configured for campaign 2
        client.issue_reward(&2, &user, &1_000);

        let record = client.get_reward(&2, &user).unwrap();
        assert_eq!(record.expiration_ledger, u32::MAX);
    }

    #[test]
    fn test_issue_reward_emits_event() {
        let (env, _, client) = setup();
        let user = Address::generate(&env);
        client.issue_reward(&1, &user, &100);
        assert!(!env.events().all().is_empty());
    }

    // ── redeem — happy path ───────────────────────────────────────────────────

    #[test]
    fn test_redeem_before_expiry_succeeds() {
        let (env, _, client) = setup();
        let user = Address::generate(&env);
        client.set_campaign_expiry(&1, &10_000);
        client.issue_reward(&1, &user, &750);

        // Advance ledger but stay within expiry
        env.ledger().with_mut(|l| l.sequence_number = 5_000);

        let amount = client.redeem(&1, &user).unwrap();
        assert_eq!(amount, 750);

        // Record is now marked redeemed
        let record = client.get_reward(&1, &user).unwrap();
        assert!(record.redeemed);
    }

    #[test]
    fn test_redeem_at_exact_expiry_ledger_succeeds() {
        let (env, _, client) = setup();
        let user = Address::generate(&env);
        client.set_campaign_expiry(&1, &100);
        client.issue_reward(&1, &user, &200);

        // Advance to exactly the expiration ledger — still valid
        env.ledger().with_mut(|l| l.sequence_number = 100);

        let amount = client.redeem(&1, &user).unwrap();
        assert_eq!(amount, 200);
    }

    #[test]
    fn test_redeem_emits_event() {
        let (env, _, client) = setup();
        let user = Address::generate(&env);
        client.issue_reward(&1, &user, &300);
        client.redeem(&1, &user).unwrap();
        assert!(!env.events().all().is_empty());
    }

    // ── redeem — expiry rejection ─────────────────────────────────────────────

    #[test]
    fn test_redeem_after_expiry_returns_error() {
        let (env, _, client) = setup();
        let user = Address::generate(&env);
        client.set_campaign_expiry(&1, &50);
        client.issue_reward(&1, &user, &500);

        // Advance past expiry
        env.ledger().with_mut(|l| l.sequence_number = 51);

        let result = client.redeem(&1, &user);
        assert_eq!(result, Err(RedemptionError::RewardExpired));
    }

    #[test]
    fn test_redeem_expired_emits_expired_event() {
        let (env, _, client) = setup();
        let user = Address::generate(&env);
        client.set_campaign_expiry(&1, &10);
        client.issue_reward(&1, &user, &100);
        env.ledger().with_mut(|l| l.sequence_number = 11);

        let _ = client.redeem(&1, &user); // returns Err but also emits event
        assert!(!env.events().all().is_empty());
    }

    #[test]
    fn test_redeem_not_found_returns_error() {
        let (env, _, client) = setup();
        let user = Address::generate(&env);
        let result = client.redeem(&1, &user);
        assert_eq!(result, Err(RedemptionError::RewardNotFound));
    }

    #[test]
    fn test_double_redeem_rejected() {
        let (env, _, client) = setup();
        let user = Address::generate(&env);
        client.issue_reward(&1, &user, &100);
        client.redeem(&1, &user).unwrap();
        let result = client.redeem(&1, &user);
        assert_eq!(result, Err(RedemptionError::AlreadyRedeemed));
    }

    // ── reclaim_expired ───────────────────────────────────────────────────────

    #[test]
    fn test_reclaim_expired_returns_to_treasury_pool() {
        let (env, _, client) = setup();
        let user = Address::generate(&env);
        client.set_campaign_expiry(&1, &50);
        client.issue_reward(&1, &user, &800);

        // Advance past expiry
        env.ledger().with_mut(|l| l.sequence_number = 51);

        let reclaimed = client.reclaim_expired(&1, &user).unwrap();
        assert_eq!(reclaimed, 800);
        assert_eq!(client.treasury_pool(&1), 800);
    }

    #[test]
    fn test_reclaim_emits_event() {
        let (env, _, client) = setup();
        let user = Address::generate(&env);
        client.set_campaign_expiry(&1, &10);
        client.issue_reward(&1, &user, &100);
        env.ledger().with_mut(|l| l.sequence_number = 11);
        client.reclaim_expired(&1, &user).unwrap();
        assert!(!env.events().all().is_empty());
    }

    #[test]
    fn test_reclaim_not_expired_returns_error() {
        let (env, _, client) = setup();
        let user = Address::generate(&env);
        client.set_campaign_expiry(&1, &1_000);
        client.issue_reward(&1, &user, &100);

        // Still within expiry window
        let result = client.reclaim_expired(&1, &user);
        assert_eq!(result, Err(RedemptionError::RewardNotExpired));
    }

    #[test]
    fn test_reclaim_already_redeemed_returns_error() {
        let (env, _, client) = setup();
        let user = Address::generate(&env);
        client.set_campaign_expiry(&1, &100);
        client.issue_reward(&1, &user, &100);

        // User redeems before expiry
        client.redeem(&1, &user).unwrap();

        // Advance past expiry and try to reclaim
        env.ledger().with_mut(|l| l.sequence_number = 101);
        let result = client.reclaim_expired(&1, &user);
        assert_eq!(result, Err(RedemptionError::AlreadyRedeemed));
    }

    #[test]
    fn test_reclaim_accumulates_across_users() {
        let (env, _, client) = setup();
        let u1 = Address::generate(&env);
        let u2 = Address::generate(&env);
        client.set_campaign_expiry(&1, &20);
        client.issue_reward(&1, &u1, &300);
        client.issue_reward(&1, &u2, &700);

        env.ledger().with_mut(|l| l.sequence_number = 21);

        client.reclaim_expired(&1, &u1).unwrap();
        client.reclaim_expired(&1, &u2).unwrap();

        assert_eq!(client.treasury_pool(&1), 1_000);
    }

    // ── Expiry per campaign is independent ────────────────────────────────────

    #[test]
    fn test_different_campaigns_have_independent_expiry() {
        let (env, _, client) = setup();
        let user = Address::generate(&env);

        client.set_campaign_expiry(&1, &10);   // expires at ledger 10
        client.set_campaign_expiry(&2, &1_000); // expires at ledger 1000

        client.issue_reward(&1, &user, &100);
        client.issue_reward(&2, &user, &200);

        // Advance past campaign 1 expiry but not campaign 2
        env.ledger().with_mut(|l| l.sequence_number = 11);

        // Campaign 1 expired
        assert_eq!(client.redeem(&1, &user), Err(RedemptionError::RewardExpired));
        // Campaign 2 still valid
        assert_eq!(client.redeem(&2, &user).unwrap(), 200);
    }

    // ── Initialization guard ──────────────────────────────────────────────────

    #[test]
    #[should_panic(expected = "already initialised")]
    fn test_reinitialize_is_blocked() {
        let (env, admin, client) = setup();
        client.initialize(&admin);
    }
}
