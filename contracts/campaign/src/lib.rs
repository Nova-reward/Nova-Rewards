//! # Campaign Contract
//!
//! Allows merchants to create, update, pause, and terminate reward campaigns
//! on-chain. Each campaign defines the reward token, amount per action,
//! eligibility criteria, and expiry ledger. This contract is the primary
//! interface between merchant business logic and the reward distribution system.
//!
//! ## Lifecycle
//! 1. Admin calls [`initialize`](CampaignContract::initialize).
//! 2. Merchant calls [`create_campaign`](CampaignContract::create_campaign).
//! 3. Merchant calls [`pause_campaign`](CampaignContract::pause_campaign) /
//!    [`resume_campaign`](CampaignContract::resume_campaign) as needed.
//! 4. Merchant or admin calls [`end_campaign`](CampaignContract::end_campaign)
//!    to permanently close the campaign.
//! 5. Distribution contract calls [`deduct_budget`](CampaignContract::deduct_budget)
//!    when issuing a reward; fails gracefully when budget is exhausted.
//!
//! ## Events
//! - `("campaign", "created")` — campaign created
//! - `("campaign", "paused")`  — campaign paused
//! - `("campaign", "resumed")` — campaign resumed
//! - `("campaign", "ended")`   — campaign permanently ended
//!
//! ## Error Handling
//! All public functions return `Result<T, ContractError>`. No `unwrap()` or
//! `panic!()` calls exist in production code paths.
#![no_std]

use soroban_sdk::{contract, contractimpl, contracttype, symbol_short, Address, Env};
use errors::ContractError;

// ── Storage TTL (ledgers) ─────────────────────────────────────────────────────

/// Persistent storage TTL: ~31 days at 5 s/ledger (535 680 ledgers).
const PERSISTENT_TTL: u32 = 535_680;

// ── Storage keys ──────────────────────────────────────────────────────────────

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    /// Instance: admin address.
    Admin,
    /// Instance: contract-level pause flag.
    Paused,
    /// Instance: monotonically increasing campaign id counter.
    CampaignCount,
    /// Persistent: campaign data keyed by id.
    Campaign(u64),
}

// ── Campaign status ───────────────────────────────────────────────────────────

/// Lifecycle state of a campaign.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum CampaignStatus {
    /// Accepting reward distributions.
    Active,
    /// Temporarily halted; can be resumed.
    Paused,
    /// Permanently closed; no further distributions allowed.
    Ended,
}

// ── Campaign data ─────────────────────────────────────────────────────────────

/// Full on-chain representation of a merchant reward campaign.
#[contracttype]
#[derive(Clone, Debug)]
pub struct Campaign {
    /// Address of the merchant that owns this campaign.
    pub owner: Address,
    /// SEP-41 token contract address used for reward payouts.
    pub token: Address,
    /// Reward amount issued per qualifying action (in token base units).
    pub reward_per_action: i128,
    /// Ledger sequence number at which the campaign becomes active.
    pub start_ledger: u32,
    /// Ledger sequence number after which the campaign is considered expired.
    pub end_ledger: u32,
    /// Maximum total tokens that may be distributed from this campaign.
    pub max_budget: i128,
    /// Tokens already distributed; incremented by [`deduct_budget`].
    pub spent_budget: i128,
    /// Current lifecycle state.
    pub status: CampaignStatus,
}

// ── Contract ──────────────────────────────────────────────────────────────────

#[contract]
pub struct CampaignContract;

#[contractimpl]
impl CampaignContract {
    // ── Initialization ────────────────────────────────────────────────────────

    /// One-time contract setup. Sets the admin and initializes the campaign counter.
    ///
    /// # Errors
    /// - [`ContractError::AlreadyInitialized`] if called more than once.
    pub fn initialize(env: Env, admin: Address) -> Result<(), ContractError> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(ContractError::AlreadyInitialized);
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Paused, &false);
        env.storage().instance().set(&DataKey::CampaignCount, &0_u64);
        Ok(())
    }

    // ── Internal helpers ──────────────────────────────────────────────────────

    /// Loads the admin address from instance storage.
    fn load_admin(env: &Env) -> Result<Address, ContractError> {
        env.storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(ContractError::NotInitialized)
    }

    /// Returns `true` when the contract-level pause is active.
    fn contract_is_paused(env: &Env) -> bool {
        env.storage()
            .instance()
            .get(&DataKey::Paused)
            .unwrap_or(false)
    }

    /// Fails with [`ContractError::ContractPaused`] when the contract is paused.
    fn require_not_paused(env: &Env) -> Result<(), ContractError> {
        if Self::contract_is_paused(env) {
            return Err(ContractError::ContractPaused);
        }
        Ok(())
    }

    /// Loads a campaign from persistent storage.
    fn load_campaign(env: &Env, id: u64) -> Result<Campaign, ContractError> {
        env.storage()
            .persistent()
            .get(&DataKey::Campaign(id))
            .ok_or(ContractError::CampaignNotFound)
    }

    /// Persists a campaign and extends its TTL.
    fn save_campaign(env: &Env, id: u64, campaign: &Campaign) {
        let key = DataKey::Campaign(id);
        env.storage().persistent().set(&key, campaign);
        env.storage()
            .persistent()
            .extend_ttl(&key, PERSISTENT_TTL, PERSISTENT_TTL);
    }

    /// Returns `true` if `caller` is the campaign owner or the contract admin.
    fn is_owner_or_admin(
        env: &Env,
        caller: &Address,
        campaign: &Campaign,
    ) -> Result<bool, ContractError> {
        let admin = Self::load_admin(env)?;
        Ok(caller == &campaign.owner || caller == &admin)
    }

    // ── Campaign management ───────────────────────────────────────────────────

    /// Create a new reward campaign.
    ///
    /// The caller becomes the campaign owner. The campaign starts in
    /// [`CampaignStatus::Active`] state immediately.
    ///
    /// # Parameters
    /// - `owner`             – Merchant address (must authorize).
    /// - `token`             – SEP-41 reward token contract address.
    /// - `reward_per_action` – Tokens issued per qualifying action (> 0).
    /// - `start_ledger`      – First ledger at which rewards may be issued.
    /// - `end_ledger`        – Ledger after which the campaign expires.
    /// - `max_budget`        – Maximum total tokens distributable (> 0).
    ///
    /// # Returns
    /// The new campaign id (`u64`), starting at `1`.
    ///
    /// # Events
    /// Emits `("campaign", "created")` with data
    /// `(id, owner, token, reward_per_action, start_ledger, end_ledger, max_budget)`.
    ///
    /// # Errors
    /// - [`ContractError::ContractPaused`]      — contract is paused.
    /// - [`ContractError::InvalidRewardAmount`] — `reward_per_action <= 0`.
    /// - [`ContractError::InvalidBudget`]       — `max_budget <= 0`.
    /// - [`ContractError::InvalidLedgerRange`]  — `start_ledger >= end_ledger`.
    pub fn create_campaign(
        env: Env,
        owner: Address,
        token: Address,
        reward_per_action: i128,
        start_ledger: u32,
        end_ledger: u32,
        max_budget: i128,
    ) -> Result<u64, ContractError> {
        Self::require_not_paused(&env)?;
        owner.require_auth();

        if reward_per_action <= 0 {
            return Err(ContractError::InvalidRewardAmount);
        }
        if max_budget <= 0 {
            return Err(ContractError::InvalidBudget);
        }
        if start_ledger >= end_ledger {
            return Err(ContractError::InvalidLedgerRange);
        }

        // Assign the next id.
        let count: u64 = env
            .storage()
            .instance()
            .get(&DataKey::CampaignCount)
            .unwrap_or(0);
        let id = count + 1;
        env.storage().instance().set(&DataKey::CampaignCount, &id);

        let campaign = Campaign {
            owner: owner.clone(),
            token: token.clone(),
            reward_per_action,
            start_ledger,
            end_ledger,
            max_budget,
            spent_budget: 0,
            status: CampaignStatus::Active,
        };

        Self::save_campaign(&env, id, &campaign);

        // Emit two events to stay within Soroban's tuple-size limits:
        // first the identifiers, then the budget/ledger parameters.
        env.events().publish(
            (symbol_short!("campaign"), symbol_short!("created")),
            (id, owner, token, reward_per_action),
        );
        env.events().publish(
            (symbol_short!("campaign"), symbol_short!("crt_meta")),
            (id, start_ledger, end_ledger, max_budget),
        );

        Ok(id)
    }

    /// Pause an active campaign, temporarily halting reward distributions.
    ///
    /// Only the campaign owner or the contract admin may call this.
    ///
    /// # Parameters
    /// - `caller` – Address performing the action (must authorize).
    /// - `id`     – Campaign identifier.
    ///
    /// # Events
    /// Emits `("campaign", "paused")` with data `(id, caller)`.
    ///
    /// # Errors
    /// - [`ContractError::ContractPaused`]       — contract is paused.
    /// - [`ContractError::CampaignNotFound`]     — no campaign with this id.
    /// - [`ContractError::Unauthorized`]         — caller is not owner or admin.
    /// - [`ContractError::CampaignAlreadyEnded`] — campaign is permanently ended.
    /// - [`ContractError::CampaignAlreadyPaused`]— campaign is already paused.
    pub fn pause_campaign(env: Env, caller: Address, id: u64) -> Result<(), ContractError> {
        Self::require_not_paused(&env)?;
        caller.require_auth();

        let mut campaign = Self::load_campaign(&env, id)?;

        if !Self::is_owner_or_admin(&env, &caller, &campaign)? {
            return Err(ContractError::Unauthorized);
        }
        if campaign.status == CampaignStatus::Ended {
            return Err(ContractError::CampaignAlreadyEnded);
        }
        if campaign.status == CampaignStatus::Paused {
            return Err(ContractError::CampaignAlreadyPaused);
        }

        campaign.status = CampaignStatus::Paused;
        Self::save_campaign(&env, id, &campaign);

        env.events().publish(
            (symbol_short!("campaign"), symbol_short!("paused")),
            (id, caller),
        );

        Ok(())
    }

    /// Resume a paused campaign, re-enabling reward distributions.
    ///
    /// Only the campaign owner or the contract admin may call this.
    ///
    /// # Parameters
    /// - `caller` – Address performing the action (must authorize).
    /// - `id`     – Campaign identifier.
    ///
    /// # Events
    /// Emits `("campaign", "resumed")` with data `(id, caller)`.
    ///
    /// # Errors
    /// - [`ContractError::ContractPaused`]       — contract is paused.
    /// - [`ContractError::CampaignNotFound`]     — no campaign with this id.
    /// - [`ContractError::Unauthorized`]         — caller is not owner or admin.
    /// - [`ContractError::CampaignAlreadyEnded`] — campaign is permanently ended.
    /// - [`ContractError::CampaignNotPaused`]    — campaign is not currently paused.
    /// - [`ContractError::CampaignExpired`]      — campaign end ledger has passed.
    pub fn resume_campaign(env: Env, caller: Address, id: u64) -> Result<(), ContractError> {
        Self::require_not_paused(&env)?;
        caller.require_auth();

        let mut campaign = Self::load_campaign(&env, id)?;

        if !Self::is_owner_or_admin(&env, &caller, &campaign)? {
            return Err(ContractError::Unauthorized);
        }
        if campaign.status == CampaignStatus::Ended {
            return Err(ContractError::CampaignAlreadyEnded);
        }
        if campaign.status != CampaignStatus::Paused {
            return Err(ContractError::CampaignNotPaused);
        }
        // Prevent resuming an already-expired campaign.
        if env.ledger().sequence() > campaign.end_ledger {
            return Err(ContractError::CampaignExpired);
        }

        campaign.status = CampaignStatus::Active;
        Self::save_campaign(&env, id, &campaign);

        env.events().publish(
            (symbol_short!("campaign"), symbol_short!("resumed")),
            (id, caller),
        );

        Ok(())
    }

    /// Permanently end a campaign. This action is irreversible.
    ///
    /// Only the campaign owner or the contract admin may call this.
    ///
    /// # Parameters
    /// - `caller` – Address performing the action (must authorize).
    /// - `id`     – Campaign identifier.
    ///
    /// # Events
    /// Emits `("campaign", "ended")` with data `(id, caller, spent_budget)`.
    ///
    /// # Errors
    /// - [`ContractError::ContractPaused`]       — contract is paused.
    /// - [`ContractError::CampaignNotFound`]     — no campaign with this id.
    /// - [`ContractError::Unauthorized`]         — caller is not owner or admin.
    /// - [`ContractError::CampaignAlreadyEnded`] — campaign is already ended.
    pub fn end_campaign(env: Env, caller: Address, id: u64) -> Result<(), ContractError> {
        Self::require_not_paused(&env)?;
        caller.require_auth();

        let mut campaign = Self::load_campaign(&env, id)?;

        if !Self::is_owner_or_admin(&env, &caller, &campaign)? {
            return Err(ContractError::Unauthorized);
        }
        if campaign.status == CampaignStatus::Ended {
            return Err(ContractError::CampaignAlreadyEnded);
        }

        let spent = campaign.spent_budget;
        campaign.status = CampaignStatus::Ended;
        Self::save_campaign(&env, id, &campaign);

        env.events().publish(
            (symbol_short!("campaign"), symbol_short!("ended")),
            (id, caller, spent),
        );

        Ok(())
    }

    /// Deduct `amount` from the campaign budget when a reward is distributed.
    ///
    /// Called by the distribution contract (or admin) each time a reward is
    /// issued. Fails gracefully when the budget is exhausted so the caller can
    /// handle the shortfall without reverting the entire transaction.
    ///
    /// # Parameters
    /// - `caller` – Address performing the deduction (must be owner or admin).
    /// - `id`     – Campaign identifier.
    /// - `amount` – Tokens being distributed (> 0).
    ///
    /// # Errors
    /// - [`ContractError::ContractPaused`]      — contract is paused.
    /// - [`ContractError::CampaignNotFound`]    — no campaign with this id.
    /// - [`ContractError::Unauthorized`]        — caller is not owner or admin.
    /// - [`ContractError::CampaignNotActive`]   — campaign is paused or ended.
    /// - [`ContractError::CampaignExpired`]     — campaign end ledger has passed.
    /// - [`ContractError::AmountMustBePositive`]— `amount <= 0`.
    /// - [`ContractError::InsufficientBudget`]  — remaining budget < amount.
    /// - [`ContractError::Overflow`]            — arithmetic overflow.
    pub fn deduct_budget(
        env: Env,
        caller: Address,
        id: u64,
        amount: i128,
    ) -> Result<i128, ContractError> {
        Self::require_not_paused(&env)?;
        caller.require_auth();

        let mut campaign = Self::load_campaign(&env, id)?;

        if !Self::is_owner_or_admin(&env, &caller, &campaign)? {
            return Err(ContractError::Unauthorized);
        }
        if campaign.status != CampaignStatus::Active {
            return Err(ContractError::CampaignNotActive);
        }
        if env.ledger().sequence() > campaign.end_ledger {
            return Err(ContractError::CampaignExpired);
        }
        if amount <= 0 {
            return Err(ContractError::AmountMustBePositive);
        }

        let remaining = campaign
            .max_budget
            .checked_sub(campaign.spent_budget)
            .ok_or(ContractError::Overflow)?;

        if remaining < amount {
            return Err(ContractError::InsufficientBudget);
        }

        campaign.spent_budget = campaign
            .spent_budget
            .checked_add(amount)
            .ok_or(ContractError::Overflow)?;

        let new_remaining = campaign.max_budget - campaign.spent_budget;
        Self::save_campaign(&env, id, &campaign);

        Ok(new_remaining)
    }

    // ── Contract-level pause ──────────────────────────────────────────────────

    /// Pause all state-changing contract operations. Admin only.
    ///
    /// # Errors
    /// - [`ContractError::NotInitialized`] — contract not initialized.
    /// - [`ContractError::Unauthorized`]   — caller is not the admin.
    pub fn pause_contract(env: Env, caller: Address) -> Result<(), ContractError> {
        caller.require_auth();
        let admin = Self::load_admin(&env)?;
        if caller != admin {
            return Err(ContractError::Unauthorized);
        }
        env.storage().instance().set(&DataKey::Paused, &true);
        Ok(())
    }

    /// Unpause contract operations. Admin only.
    ///
    /// # Errors
    /// - [`ContractError::NotInitialized`] — contract not initialized.
    /// - [`ContractError::Unauthorized`]   — caller is not the admin.
    pub fn unpause_contract(env: Env, caller: Address) -> Result<(), ContractError> {
        caller.require_auth();
        let admin = Self::load_admin(&env)?;
        if caller != admin {
            return Err(ContractError::Unauthorized);
        }
        env.storage().instance().set(&DataKey::Paused, &false);
        Ok(())
    }

    // ── Read-only helpers ─────────────────────────────────────────────────────

    /// Returns the full [`Campaign`] struct for a given id.
    ///
    /// # Errors
    /// - [`ContractError::CampaignNotFound`] — no campaign with this id.
    pub fn get_campaign(env: Env, id: u64) -> Result<Campaign, ContractError> {
        let campaign = Self::load_campaign(&env, id)?;
        // Extend TTL on read so hot campaigns don't expire from storage.
        env.storage()
            .persistent()
            .extend_ttl(&DataKey::Campaign(id), PERSISTENT_TTL, PERSISTENT_TTL);
        Ok(campaign)
    }

    /// Returns the remaining budget for a campaign (max_budget − spent_budget).
    ///
    /// # Errors
    /// - [`ContractError::CampaignNotFound`] — no campaign with this id.
    pub fn remaining_budget(env: Env, id: u64) -> Result<i128, ContractError> {
        let campaign = Self::load_campaign(&env, id)?;
        Ok(campaign.max_budget - campaign.spent_budget)
    }

    /// Returns the total number of campaigns created.
    pub fn campaign_count(env: Env) -> u64 {
        env.storage()
            .instance()
            .get(&DataKey::CampaignCount)
            .unwrap_or(0)
    }

    /// Returns `true` if the contract-level pause is active.
    pub fn is_contract_paused(env: Env) -> bool {
        Self::contract_is_paused(&env)
    }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use errors::ContractError;
    use soroban_sdk::{testutils::{Address as _, Ledger}, Env};

    // ── Helpers ───────────────────────────────────────────────────────────────

    fn setup() -> (Env, Address, Address, CampaignContractClient<'static>) {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(CampaignContract, ());
        let client = CampaignContractClient::new(&env, &contract_id);
        let admin = Address::generate(&env);
        let token = Address::generate(&env);
        client.initialize(&admin).unwrap();
        (env, admin, token, client)
    }

    /// Creates a default campaign starting at ledger 1, ending at ledger 1000.
    fn make_campaign(
        env: &Env,
        client: &CampaignContractClient,
        token: &Address,
    ) -> (u64, Address) {
        let owner = Address::generate(env);
        let id = client
            .create_campaign(&owner, token, &100, &1, &1000, &10_000)
            .unwrap();
        (id, owner)
    }

    // ── initialize ────────────────────────────────────────────────────────────

    #[test]
    fn test_initialize_ok() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(CampaignContract, ());
        let client = CampaignContractClient::new(&env, &contract_id);
        let admin = Address::generate(&env);
        assert_eq!(client.initialize(&admin), Ok(()));
    }

    #[test]
    fn test_initialize_twice_returns_already_initialized() {
        let (_, admin, _, client) = setup();
        let result = client.initialize(&admin);
        assert_eq!(result, Err(ContractError::AlreadyInitialized));
    }

    // ── create_campaign ───────────────────────────────────────────────────────

    #[test]
    fn test_create_campaign_ok() {
        let (env, _admin, token, client) = setup();
        let owner = Address::generate(&env);
        let id = client
            .create_campaign(&owner, &token, &50, &1, &500, &5_000)
            .unwrap();
        assert_eq!(id, 1);
        assert_eq!(client.campaign_count(), 1);

        let c = client.get_campaign(&id).unwrap();
        assert_eq!(c.owner, owner);
        assert_eq!(c.token, token);
        assert_eq!(c.reward_per_action, 50);
        assert_eq!(c.start_ledger, 1);
        assert_eq!(c.end_ledger, 500);
        assert_eq!(c.max_budget, 5_000);
        assert_eq!(c.spent_budget, 0);
        assert_eq!(c.status, CampaignStatus::Active);
    }

    #[test]
    fn test_create_campaign_ids_increment() {
        let (env, _admin, token, client) = setup();
        let owner = Address::generate(&env);
        let id1 = client.create_campaign(&owner, &token, &10, &1, &100, &1_000).unwrap();
        let id2 = client.create_campaign(&owner, &token, &10, &1, &100, &1_000).unwrap();
        assert_eq!(id1, 1);
        assert_eq!(id2, 2);
    }

    #[test]
    fn test_create_campaign_invalid_reward_amount() {
        let (env, _admin, token, client) = setup();
        let owner = Address::generate(&env);
        let result = client.create_campaign(&owner, &token, &0, &1, &100, &1_000);
        assert_eq!(result, Err(ContractError::InvalidRewardAmount));
    }

    #[test]
    fn test_create_campaign_negative_reward_amount() {
        let (env, _admin, token, client) = setup();
        let owner = Address::generate(&env);
        let result = client.create_campaign(&owner, &token, &-1, &1, &100, &1_000);
        assert_eq!(result, Err(ContractError::InvalidRewardAmount));
    }

    #[test]
    fn test_create_campaign_invalid_budget() {
        let (env, _admin, token, client) = setup();
        let owner = Address::generate(&env);
        let result = client.create_campaign(&owner, &token, &10, &1, &100, &0);
        assert_eq!(result, Err(ContractError::InvalidBudget));
    }

    #[test]
    fn test_create_campaign_invalid_ledger_range_equal() {
        let (env, _admin, token, client) = setup();
        let owner = Address::generate(&env);
        let result = client.create_campaign(&owner, &token, &10, &100, &100, &1_000);
        assert_eq!(result, Err(ContractError::InvalidLedgerRange));
    }

    #[test]
    fn test_create_campaign_invalid_ledger_range_start_after_end() {
        let (env, _admin, token, client) = setup();
        let owner = Address::generate(&env);
        let result = client.create_campaign(&owner, &token, &10, &200, &100, &1_000);
        assert_eq!(result, Err(ContractError::InvalidLedgerRange));
    }

    #[test]
    fn test_create_campaign_while_contract_paused() {
        let (env, admin, token, client) = setup();
        client.pause_contract(&admin).unwrap();
        let owner = Address::generate(&env);
        let result = client.create_campaign(&owner, &token, &10, &1, &100, &1_000);
        assert_eq!(result, Err(ContractError::ContractPaused));
    }

    // ── pause_campaign ────────────────────────────────────────────────────────

    #[test]
    fn test_pause_campaign_by_owner() {
        let (env, _admin, token, client) = setup();
        let (id, owner) = make_campaign(&env, &client, &token);
        client.pause_campaign(&owner, &id).unwrap();
        assert_eq!(client.get_campaign(&id).unwrap().status, CampaignStatus::Paused);
    }

    #[test]
    fn test_pause_campaign_by_admin() {
        let (env, admin, token, client) = setup();
        let (id, _owner) = make_campaign(&env, &client, &token);
        client.pause_campaign(&admin, &id).unwrap();
        assert_eq!(client.get_campaign(&id).unwrap().status, CampaignStatus::Paused);
    }

    #[test]
    fn test_pause_campaign_unauthorized() {
        let (env, _admin, token, client) = setup();
        let (id, _owner) = make_campaign(&env, &client, &token);
        let stranger = Address::generate(&env);
        let result = client.pause_campaign(&stranger, &id);
        assert_eq!(result, Err(ContractError::Unauthorized));
    }

    #[test]
    fn test_pause_campaign_not_found() {
        let (env, _admin, _token, client) = setup();
        let caller = Address::generate(&env);
        let result = client.pause_campaign(&caller, &999);
        assert_eq!(result, Err(ContractError::CampaignNotFound));
    }

    #[test]
    fn test_pause_campaign_already_paused() {
        let (env, _admin, token, client) = setup();
        let (id, owner) = make_campaign(&env, &client, &token);
        client.pause_campaign(&owner, &id).unwrap();
        let result = client.pause_campaign(&owner, &id);
        assert_eq!(result, Err(ContractError::CampaignAlreadyPaused));
    }

    #[test]
    fn test_pause_campaign_already_ended() {
        let (env, _admin, token, client) = setup();
        let (id, owner) = make_campaign(&env, &client, &token);
        client.end_campaign(&owner, &id).unwrap();
        let result = client.pause_campaign(&owner, &id);
        assert_eq!(result, Err(ContractError::CampaignAlreadyEnded));
    }

    // ── resume_campaign ───────────────────────────────────────────────────────

    #[test]
    fn test_resume_campaign_by_owner() {
        let (env, _admin, token, client) = setup();
        let (id, owner) = make_campaign(&env, &client, &token);
        client.pause_campaign(&owner, &id).unwrap();
        client.resume_campaign(&owner, &id).unwrap();
        assert_eq!(client.get_campaign(&id).unwrap().status, CampaignStatus::Active);
    }

    #[test]
    fn test_resume_campaign_by_admin() {
        let (env, admin, token, client) = setup();
        let (id, owner) = make_campaign(&env, &client, &token);
        client.pause_campaign(&owner, &id).unwrap();
        client.resume_campaign(&admin, &id).unwrap();
        assert_eq!(client.get_campaign(&id).unwrap().status, CampaignStatus::Active);
    }

    #[test]
    fn test_resume_campaign_unauthorized() {
        let (env, _admin, token, client) = setup();
        let (id, owner) = make_campaign(&env, &client, &token);
        client.pause_campaign(&owner, &id).unwrap();
        let stranger = Address::generate(&env);
        let result = client.resume_campaign(&stranger, &id);
        assert_eq!(result, Err(ContractError::Unauthorized));
    }

    #[test]
    fn test_resume_campaign_not_paused() {
        let (env, _admin, token, client) = setup();
        let (id, owner) = make_campaign(&env, &client, &token);
        // Campaign is Active, not Paused.
        let result = client.resume_campaign(&owner, &id);
        assert_eq!(result, Err(ContractError::CampaignNotPaused));
    }

    #[test]
    fn test_resume_campaign_already_ended() {
        let (env, _admin, token, client) = setup();
        let (id, owner) = make_campaign(&env, &client, &token);
        client.end_campaign(&owner, &id).unwrap();
        let result = client.resume_campaign(&owner, &id);
        assert_eq!(result, Err(ContractError::CampaignAlreadyEnded));
    }

    #[test]
    fn test_resume_campaign_expired() {
        let (env, _admin, token, client) = setup();
        let (id, owner) = make_campaign(&env, &client, &token);
        client.pause_campaign(&owner, &id).unwrap();
        // Advance ledger past end_ledger (1000).
        env.ledger().with_mut(|l| l.sequence_number = 1001);
        let result = client.resume_campaign(&owner, &id);
        assert_eq!(result, Err(ContractError::CampaignExpired));
    }

    // ── end_campaign ──────────────────────────────────────────────────────────

    #[test]
    fn test_end_campaign_by_owner() {
        let (env, _admin, token, client) = setup();
        let (id, owner) = make_campaign(&env, &client, &token);
        client.end_campaign(&owner, &id).unwrap();
        assert_eq!(client.get_campaign(&id).unwrap().status, CampaignStatus::Ended);
    }

    #[test]
    fn test_end_campaign_by_admin() {
        let (env, admin, token, client) = setup();
        let (id, _owner) = make_campaign(&env, &client, &token);
        client.end_campaign(&admin, &id).unwrap();
        assert_eq!(client.get_campaign(&id).unwrap().status, CampaignStatus::Ended);
    }

    #[test]
    fn test_end_campaign_from_paused_state() {
        let (env, _admin, token, client) = setup();
        let (id, owner) = make_campaign(&env, &client, &token);
        client.pause_campaign(&owner, &id).unwrap();
        client.end_campaign(&owner, &id).unwrap();
        assert_eq!(client.get_campaign(&id).unwrap().status, CampaignStatus::Ended);
    }

    #[test]
    fn test_end_campaign_unauthorized() {
        let (env, _admin, token, client) = setup();
        let (id, _owner) = make_campaign(&env, &client, &token);
        let stranger = Address::generate(&env);
        let result = client.end_campaign(&stranger, &id);
        assert_eq!(result, Err(ContractError::Unauthorized));
    }

    #[test]
    fn test_end_campaign_not_found() {
        let (env, _admin, _token, client) = setup();
        let caller = Address::generate(&env);
        let result = client.end_campaign(&caller, &999);
        assert_eq!(result, Err(ContractError::CampaignNotFound));
    }

    #[test]
    fn test_end_campaign_already_ended() {
        let (env, _admin, token, client) = setup();
        let (id, owner) = make_campaign(&env, &client, &token);
        client.end_campaign(&owner, &id).unwrap();
        let result = client.end_campaign(&owner, &id);
        assert_eq!(result, Err(ContractError::CampaignAlreadyEnded));
    }

    // ── deduct_budget ─────────────────────────────────────────────────────────

    #[test]
    fn test_deduct_budget_ok() {
        let (env, _admin, token, client) = setup();
        let (id, owner) = make_campaign(&env, &client, &token);
        // Budget: 10_000, deduct 100 → remaining 9_900.
        let remaining = client.deduct_budget(&owner, &id, &100).unwrap();
        assert_eq!(remaining, 9_900);
        assert_eq!(client.get_campaign(&id).unwrap().spent_budget, 100);
    }

    #[test]
    fn test_deduct_budget_exhausted() {
        let (env, _admin, token, client) = setup();
        let (id, owner) = make_campaign(&env, &client, &token);
        // Drain the full budget.
        client.deduct_budget(&owner, &id, &10_000).unwrap();
        // Next deduction should fail.
        let result = client.deduct_budget(&owner, &id, &1);
        assert_eq!(result, Err(ContractError::InsufficientBudget));
    }

    #[test]
    fn test_deduct_budget_partial_exhaustion() {
        let (env, _admin, token, client) = setup();
        let (id, owner) = make_campaign(&env, &client, &token);
        client.deduct_budget(&owner, &id, &9_999).unwrap();
        // Only 1 token left; requesting 2 should fail.
        let result = client.deduct_budget(&owner, &id, &2);
        assert_eq!(result, Err(ContractError::InsufficientBudget));
    }

    #[test]
    fn test_deduct_budget_campaign_not_active() {
        let (env, _admin, token, client) = setup();
        let (id, owner) = make_campaign(&env, &client, &token);
        client.pause_campaign(&owner, &id).unwrap();
        let result = client.deduct_budget(&owner, &id, &100);
        assert_eq!(result, Err(ContractError::CampaignNotActive));
    }

    #[test]
    fn test_deduct_budget_campaign_expired() {
        let (env, _admin, token, client) = setup();
        let (id, owner) = make_campaign(&env, &client, &token);
        env.ledger().with_mut(|l| l.sequence_number = 1001);
        let result = client.deduct_budget(&owner, &id, &100);
        assert_eq!(result, Err(ContractError::CampaignExpired));
    }

    #[test]
    fn test_deduct_budget_zero_amount() {
        let (env, _admin, token, client) = setup();
        let (id, owner) = make_campaign(&env, &client, &token);
        let result = client.deduct_budget(&owner, &id, &0);
        assert_eq!(result, Err(ContractError::AmountMustBePositive));
    }

    #[test]
    fn test_deduct_budget_unauthorized() {
        let (env, _admin, token, client) = setup();
        let (id, _owner) = make_campaign(&env, &client, &token);
        let stranger = Address::generate(&env);
        let result = client.deduct_budget(&stranger, &id, &100);
        assert_eq!(result, Err(ContractError::Unauthorized));
    }

    // ── remaining_budget ──────────────────────────────────────────────────────

    #[test]
    fn test_remaining_budget() {
        let (env, _admin, token, client) = setup();
        let (id, owner) = make_campaign(&env, &client, &token);
        assert_eq!(client.remaining_budget(&id).unwrap(), 10_000);
        client.deduct_budget(&owner, &id, &3_000).unwrap();
        assert_eq!(client.remaining_budget(&id).unwrap(), 7_000);
    }

    #[test]
    fn test_remaining_budget_not_found() {
        let (_env, _admin, _token, client) = setup();
        let result = client.remaining_budget(&999);
        assert_eq!(result, Err(ContractError::CampaignNotFound));
    }

    // ── contract-level pause ──────────────────────────────────────────────────

    #[test]
    fn test_contract_pause_unpause() {
        let (_env, admin, _token, client) = setup();
        assert!(!client.is_contract_paused());
        client.pause_contract(&admin).unwrap();
        assert!(client.is_contract_paused());
        client.unpause_contract(&admin).unwrap();
        assert!(!client.is_contract_paused());
    }

    #[test]
    fn test_contract_pause_unauthorized() {
        let (env, _admin, _token, client) = setup();
        let stranger = Address::generate(&env);
        let result = client.pause_contract(&stranger);
        assert_eq!(result, Err(ContractError::Unauthorized));
    }

    // ── events ────────────────────────────────────────────────────────────────

    #[test]
    fn test_create_campaign_emits_event() {
        let (env, _admin, token, client) = setup();
        let owner = Address::generate(&env);
        client.create_campaign(&owner, &token, &10, &1, &100, &1_000).unwrap();
        assert!(!env.events().all().is_empty());
    }

    #[test]
    fn test_pause_campaign_emits_event() {
        let (env, _admin, token, client) = setup();
        let (id, owner) = make_campaign(&env, &client, &token);
        client.pause_campaign(&owner, &id).unwrap();
        assert!(!env.events().all().is_empty());
    }

    #[test]
    fn test_resume_campaign_emits_event() {
        let (env, _admin, token, client) = setup();
        let (id, owner) = make_campaign(&env, &client, &token);
        client.pause_campaign(&owner, &id).unwrap();
        client.resume_campaign(&owner, &id).unwrap();
        assert!(!env.events().all().is_empty());
    }

    #[test]
    fn test_end_campaign_emits_event() {
        let (env, _admin, token, client) = setup();
        let (id, owner) = make_campaign(&env, &client, &token);
        client.end_campaign(&owner, &id).unwrap();
        assert!(!env.events().all().is_empty());
    }

    // ── full lifecycle ────────────────────────────────────────────────────────

    #[test]
    fn test_full_campaign_lifecycle() {
        let (env, admin, token, client) = setup();
        let owner = Address::generate(&env);

        // 1. Create
        let id = client
            .create_campaign(&owner, &token, &100, &1, &1000, &10_000)
            .unwrap();
        assert_eq!(client.get_campaign(&id).unwrap().status, CampaignStatus::Active);

        // 2. Distribute some rewards
        client.deduct_budget(&owner, &id, &500).unwrap();
        assert_eq!(client.remaining_budget(&id).unwrap(), 9_500);

        // 3. Pause
        client.pause_campaign(&owner, &id).unwrap();
        assert_eq!(client.get_campaign(&id).unwrap().status, CampaignStatus::Paused);

        // 4. Resume
        client.resume_campaign(&admin, &id).unwrap();
        assert_eq!(client.get_campaign(&id).unwrap().status, CampaignStatus::Active);

        // 5. End
        client.end_campaign(&owner, &id).unwrap();
        assert_eq!(client.get_campaign(&id).unwrap().status, CampaignStatus::Ended);

        // 6. No further distributions allowed
        let result = client.deduct_budget(&owner, &id, &100);
        assert_eq!(result, Err(ContractError::CampaignNotActive));
    }
}
