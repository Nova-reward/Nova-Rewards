//! # Campaign Contract
//!
//! Allows merchants to create, update, pause, and terminate reward campaigns
//! on-chain. Each campaign defines the reward token, amount per action,
//! eligibility criteria, and expiry (start/end ledger).
//!
//! This contract is the primary interface between merchant business logic and
//! the reward distribution system.
//!
//! ## Lifecycle
//! 1. Admin calls [`initialize`](CampaignContract::initialize).
//! 2. Merchant calls [`create_campaign`](CampaignContract::create_campaign).
//! 3. Merchant calls [`pause_campaign`](CampaignContract::pause_campaign) /
//!    [`resume_campaign`](CampaignContract::resume_campaign) as needed.
//! 4. Merchant or admin calls [`end_campaign`](CampaignContract::end_campaign)
//!    to terminate early, or the campaign expires at `end_ledger`.
//!
//! ## Error Handling
//! All public functions return `Result<T, ContractError>`. No `unwrap()` or
//! `panic!()` calls exist in production code paths.
#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, contracterror,
    symbol_short, Address, Env, String,
};

// ── Error Enum ────────────────────────────────────────────────────────────────

/// Structured error enum covering all failure modes in the campaign contract.
///
/// Error codes are stable and documented so the frontend and backend can
/// display meaningful messages to users.
///
/// # Variants
/// | Code | Name                    | Meaning                                              |
/// |------|-------------------------|------------------------------------------------------|
/// | 1    | AlreadyInitialized      | Contract has already been initialized                |
/// | 2    | NotInitialized          | Contract has not been initialized yet                |
/// | 3    | Unauthorized            | Caller is not the campaign owner or admin            |
/// | 4    | CampaignNotFound        | No campaign exists with the given ID                 |
/// | 5    | CampaignAlreadyExists   | A campaign with this ID already exists               |
/// | 6    | CampaignExpired         | Campaign end_ledger has passed                       |
/// | 7    | CampaignNotStarted      | Campaign start_ledger has not been reached           |
/// | 8    | CampaignPaused          | Campaign is currently paused                         |
/// | 9    | CampaignNotPaused       | Campaign is not paused (cannot resume)               |
/// | 10   | CampaignEnded           | Campaign has already been ended/terminated           |
/// | 11   | BudgetExhausted         | Campaign budget cap has been reached                 |
/// | 12   | InsufficientBudget      | Provided max_budget is less than reward_amount       |
/// | 13   | InvalidRewardAmount     | reward_amount_per_action must be positive            |
/// | 14   | InvalidLedgerRange      | start_ledger must be before end_ledger               |
/// | 15   | InvalidMaxBudget        | max_budget must be positive                          |
/// | 16   | ContractPaused          | The entire contract is paused by admin               |
/// | 17   | InvalidCampaignId       | Campaign ID must be non-zero                         |
/// | 18   | NameTooLong             | Campaign name exceeds the maximum allowed length     |
/// | 19   | ArithmeticOverflow      | An arithmetic operation overflowed                   |
/// | 20   | InvalidEligibilityCriteria | Eligibility criteria string is empty              |
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum ContractError {
    AlreadyInitialized       = 1,
    NotInitialized           = 2,
    Unauthorized             = 3,
    CampaignNotFound         = 4,
    CampaignAlreadyExists    = 5,
    CampaignExpired          = 6,
    CampaignNotStarted       = 7,
    CampaignPaused           = 8,
    CampaignNotPaused        = 9,
    CampaignEnded            = 10,
    BudgetExhausted          = 11,
    InsufficientBudget       = 12,
    InvalidRewardAmount      = 13,
    InvalidLedgerRange       = 14,
    InvalidMaxBudget         = 15,
    ContractPaused           = 16,
    InvalidCampaignId        = 17,
    NameTooLong              = 18,
    ArithmeticOverflow       = 19,
    InvalidEligibilityCriteria = 20,
}

// ── Constants ─────────────────────────────────────────────────────────────────

/// Maximum byte length for a campaign name.
const MAX_NAME_LEN: u32 = 64;

/// Persistent storage TTL extension in ledgers (~31 days at 5 s/ledger).
const PERSISTENT_TTL: u32 = 2_678_400;

// ── Storage Keys ──────────────────────────────────────────────────────────────

/// Storage key classification:
/// - `Admin`, `Paused`: Instance storage (contract-level metadata, no TTL).
/// - `Campaign(u64)`: Persistent storage (hot path, extend TTL on access).
#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    /// The contract administrator address.
    Admin,
    /// Whether the entire contract is paused.
    Paused,
    /// Campaign data keyed by campaign ID.
    Campaign(u64),
}

// ── Data Structures ───────────────────────────────────────────────────────────

/// Status of a campaign.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum CampaignStatus {
    /// Campaign is live and accepting actions.
    Active,
    /// Campaign has been temporarily paused by the owner or admin.
    Paused,
    /// Campaign has been permanently ended (by owner, admin, or expiry).
    Ended,
}

/// Full on-chain representation of a reward campaign.
#[contracttype]
#[derive(Clone, Debug)]
pub struct Campaign {
    /// Address that created and owns this campaign.
    pub owner: Address,
    /// The reward token contract address.
    pub token: Address,
    /// Reward tokens distributed per qualifying action.
    pub reward_amount_per_action: i128,
    /// Ledger sequence number at which the campaign becomes active.
    pub start_ledger: u32,
    /// Ledger sequence number after which no new rewards are issued.
    pub end_ledger: u32,
    /// Maximum total tokens that can be distributed from this campaign.
    pub max_budget: i128,
    /// Total tokens distributed so far (monotonically increasing).
    pub budget_used: i128,
    /// Human-readable campaign name (max 64 bytes).
    pub name: String,
    /// Eligibility criteria description (non-empty).
    pub eligibility_criteria: String,
    /// Current lifecycle status.
    pub status: CampaignStatus,
}

// ── Contract ──────────────────────────────────────────────────────────────────

#[contract]
pub struct CampaignContract;

// ── Internal helpers (not exposed via ABI) ────────────────────────────────────

impl CampaignContract {
    /// Returns the admin address, or `NotInitialized` if not set.
    fn read_admin(env: &Env) -> Result<Address, ContractError> {
        env.storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(ContractError::NotInitialized)
    }

    /// Returns `ContractPaused` if the contract-level pause flag is set.
    fn require_contract_active(env: &Env) -> Result<(), ContractError> {
        let paused: bool = env
            .storage()
            .instance()
            .get(&DataKey::Paused)
            .unwrap_or(false);
        if paused {
            Err(ContractError::ContractPaused)
        } else {
            Ok(())
        }
    }

    /// Loads a campaign from persistent storage.
    fn load_campaign(env: &Env, id: u64) -> Result<Campaign, ContractError> {
        let key = DataKey::Campaign(id);
        let campaign: Campaign = env
            .storage()
            .persistent()
            .get(&key)
            .ok_or(ContractError::CampaignNotFound)?;
        // Extend TTL on every read to keep hot campaigns alive.
        env.storage()
            .persistent()
            .extend_ttl(&key, PERSISTENT_TTL, PERSISTENT_TTL);
        Ok(campaign)
    }

    /// Persists a campaign and extends its TTL.
    fn save_campaign(env: &Env, id: u64, campaign: &Campaign) {
        let key = DataKey::Campaign(id);
        env.storage().persistent().set(&key, campaign);
        env.storage()
            .persistent()
            .extend_ttl(&key, PERSISTENT_TTL, PERSISTENT_TTL);
    }

    /// Returns `Unauthorized` unless `caller` is the campaign owner or admin.
    fn require_owner_or_admin(
        env: &Env,
        caller: &Address,
        campaign: &Campaign,
    ) -> Result<(), ContractError> {
        let admin = Self::read_admin(env)?;
        if caller == &campaign.owner || caller == &admin {
            caller.require_auth();
            Ok(())
        } else {
            Err(ContractError::Unauthorized)
        }
    }
}

// ── Public ABI ────────────────────────────────────────────────────────────────

#[contractimpl]
impl CampaignContract {
    // ── Initialization ────────────────────────────────────────────────────────

    /// One-time contract setup. Sets the admin address.
    ///
    /// # Parameters
    /// - `admin` – Address authorized to pause/unpause the contract and act as
    ///   a fallback owner on any campaign.
    ///
    /// # Errors
    /// - [`ContractError::AlreadyInitialized`] if called more than once.
    pub fn initialize(env: Env, admin: Address) -> Result<(), ContractError> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(ContractError::AlreadyInitialized);
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Paused, &false);
        Ok(())
    }

    // ── Campaign lifecycle ────────────────────────────────────────────────────

    /// Create a new reward campaign on-chain.
    ///
    /// The campaign is created in [`CampaignStatus::Active`] state and becomes
    /// distributable once `start_ledger` is reached.
    ///
    /// # Parameters
    /// - `id` – Unique campaign identifier (must be non-zero).
    /// - `owner` – Merchant address that owns this campaign (must authorize).
    /// - `token` – Reward token contract address.
    /// - `reward_amount_per_action` – Tokens issued per qualifying action (> 0).
    /// - `start_ledger` – Ledger sequence at which the campaign starts.
    /// - `end_ledger` – Ledger sequence after which no rewards are issued
    ///   (`end_ledger > start_ledger`).
    /// - `max_budget` – Maximum total tokens that may be distributed (> 0 and
    ///   must be ≥ `reward_amount_per_action`).
    /// - `name` – Human-readable name (max 64 bytes).
    /// - `eligibility_criteria` – Non-empty description of who qualifies.
    ///
    /// # Errors
    /// - [`ContractError::ContractPaused`] if the contract is paused.
    /// - [`ContractError::InvalidCampaignId`] if `id == 0`.
    /// - [`ContractError::CampaignAlreadyExists`] if a campaign with `id` exists.
    /// - [`ContractError::InvalidRewardAmount`] if `reward_amount_per_action <= 0`.
    /// - [`ContractError::InvalidMaxBudget`] if `max_budget <= 0`.
    /// - [`ContractError::InsufficientBudget`] if `max_budget < reward_amount_per_action`.
    /// - [`ContractError::InvalidLedgerRange`] if `end_ledger <= start_ledger`.
    /// - [`ContractError::NameTooLong`] if `name` exceeds 64 bytes.
    /// - [`ContractError::InvalidEligibilityCriteria`] if `eligibility_criteria` is empty.
    ///
    /// # Events
    /// Emits `("campaign", "created")` with data
    /// `(id: u64, owner: Address, token: Address, reward_amount_per_action: i128,
    ///   start_ledger: u32, end_ledger: u32, max_budget: i128)`.
    pub fn create_campaign(
        env: Env,
        id: u64,
        owner: Address,
        token: Address,
        reward_amount_per_action: i128,
        start_ledger: u32,
        end_ledger: u32,
        max_budget: i128,
        name: String,
        eligibility_criteria: String,
    ) -> Result<(), ContractError> {
        Self::require_contract_active(&env)?;

        if id == 0 {
            return Err(ContractError::InvalidCampaignId);
        }
        if env.storage().persistent().has(&DataKey::Campaign(id)) {
            return Err(ContractError::CampaignAlreadyExists);
        }
        if reward_amount_per_action <= 0 {
            return Err(ContractError::InvalidRewardAmount);
        }
        if max_budget <= 0 {
            return Err(ContractError::InvalidMaxBudget);
        }
        if max_budget < reward_amount_per_action {
            return Err(ContractError::InsufficientBudget);
        }
        if end_ledger <= start_ledger {
            return Err(ContractError::InvalidLedgerRange);
        }
        if name.len() > MAX_NAME_LEN {
            return Err(ContractError::NameTooLong);
        }
        if eligibility_criteria.len() == 0 {
            return Err(ContractError::InvalidEligibilityCriteria);
        }

        owner.require_auth();

        let campaign = Campaign {
            owner: owner.clone(),
            token: token.clone(),
            reward_amount_per_action,
            start_ledger,
            end_ledger,
            max_budget,
            budget_used: 0,
            name,
            eligibility_criteria,
            status: CampaignStatus::Active,
        };

        Self::save_campaign(&env, id, &campaign);

        env.events().publish(
            (symbol_short!("campaign"), symbol_short!("created")),
            (id, owner, token, reward_amount_per_action, start_ledger, end_ledger, max_budget),
        );

        Ok(())
    }

    /// Pause an active campaign. Only the campaign owner or admin may call.
    ///
    /// A paused campaign does not distribute rewards until resumed.
    ///
    /// # Parameters
    /// - `id` – Campaign to pause.
    /// - `caller` – Address requesting the pause (must be owner or admin).
    ///
    /// # Errors
    /// - [`ContractError::ContractPaused`] if the contract is paused.
    /// - [`ContractError::CampaignNotFound`] if no campaign with `id` exists.
    /// - [`ContractError::Unauthorized`] if `caller` is not owner or admin.
    /// - [`ContractError::CampaignPaused`] if the campaign is already paused.
    /// - [`ContractError::CampaignEnded`] if the campaign has already ended.
    ///
    /// # Events
    /// Emits `("campaign", "paused")` with data `(id: u64, caller: Address)`.
    pub fn pause_campaign(
        env: Env,
        id: u64,
        caller: Address,
    ) -> Result<(), ContractError> {
        Self::require_contract_active(&env)?;

        let mut campaign = Self::load_campaign(&env, id)?;
        Self::require_owner_or_admin(&env, &caller, &campaign)?;

        match campaign.status {
            CampaignStatus::Paused => return Err(ContractError::CampaignPaused),
            CampaignStatus::Ended  => return Err(ContractError::CampaignEnded),
            CampaignStatus::Active => {}
        }

        campaign.status = CampaignStatus::Paused;
        Self::save_campaign(&env, id, &campaign);

        env.events().publish(
            (symbol_short!("campaign"), symbol_short!("paused")),
            (id, caller),
        );

        Ok(())
    }

    /// Resume a paused campaign. Only the campaign owner or admin may call.
    ///
    /// # Parameters
    /// - `id` – Campaign to resume.
    /// - `caller` – Address requesting the resume (must be owner or admin).
    ///
    /// # Errors
    /// - [`ContractError::ContractPaused`] if the contract is paused.
    /// - [`ContractError::CampaignNotFound`] if no campaign with `id` exists.
    /// - [`ContractError::Unauthorized`] if `caller` is not owner or admin.
    /// - [`ContractError::CampaignNotPaused`] if the campaign is not paused.
    /// - [`ContractError::CampaignEnded`] if the campaign has already ended.
    /// - [`ContractError::CampaignExpired`] if `end_ledger` has already passed.
    ///
    /// # Events
    /// Emits `("campaign", "resumed")` with data `(id: u64, caller: Address)`.
    pub fn resume_campaign(
        env: Env,
        id: u64,
        caller: Address,
    ) -> Result<(), ContractError> {
        Self::require_contract_active(&env)?;

        let mut campaign = Self::load_campaign(&env, id)?;
        Self::require_owner_or_admin(&env, &caller, &campaign)?;

        match campaign.status {
            CampaignStatus::Active => return Err(ContractError::CampaignNotPaused),
            CampaignStatus::Ended  => return Err(ContractError::CampaignEnded),
            CampaignStatus::Paused => {}
        }

        // Refuse to resume an already-expired campaign.
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

    /// Permanently end a campaign. Only the campaign owner or admin may call.
    ///
    /// Once ended, a campaign cannot be resumed or modified. Any remaining
    /// budget is considered unspent and should be reclaimed off-chain.
    ///
    /// # Parameters
    /// - `id` – Campaign to end.
    /// - `caller` – Address requesting termination (must be owner or admin).
    ///
    /// # Errors
    /// - [`ContractError::ContractPaused`] if the contract is paused.
    /// - [`ContractError::CampaignNotFound`] if no campaign with `id` exists.
    /// - [`ContractError::Unauthorized`] if `caller` is not owner or admin.
    /// - [`ContractError::CampaignEnded`] if the campaign has already ended.
    ///
    /// # Events
    /// Emits `("campaign", "ended")` with data
    /// `(id: u64, caller: Address, budget_used: i128, budget_remaining: i128)`.
    pub fn end_campaign(
        env: Env,
        id: u64,
        caller: Address,
    ) -> Result<(), ContractError> {
        Self::require_contract_active(&env)?;

        let mut campaign = Self::load_campaign(&env, id)?;
        Self::require_owner_or_admin(&env, &caller, &campaign)?;

        if campaign.status == CampaignStatus::Ended {
            return Err(ContractError::CampaignEnded);
        }

        let budget_remaining = campaign
            .max_budget
            .checked_sub(campaign.budget_used)
            .unwrap_or(0);

        campaign.status = CampaignStatus::Ended;
        Self::save_campaign(&env, id, &campaign);

        env.events().publish(
            (symbol_short!("campaign"), symbol_short!("ended")),
            (id, caller, campaign.budget_used, budget_remaining),
        );

        Ok(())
    }

    /// Record a reward distribution against a campaign's budget.
    ///
    /// Called by the distribution contract (or admin) when a qualifying action
    /// is confirmed. Increments `budget_used` by `reward_amount_per_action`.
    /// Fails gracefully when the budget cap would be exceeded.
    ///
    /// # Parameters
    /// - `id` – Campaign to charge.
    /// - `caller` – Address authorizing the distribution (must be owner or admin).
    ///
    /// # Returns
    /// The reward amount that was charged (`reward_amount_per_action`).
    ///
    /// # Errors
    /// - [`ContractError::ContractPaused`] if the contract is paused.
    /// - [`ContractError::CampaignNotFound`] if no campaign with `id` exists.
    /// - [`ContractError::Unauthorized`] if `caller` is not owner or admin.
    /// - [`ContractError::CampaignPaused`] if the campaign is paused.
    /// - [`ContractError::CampaignEnded`] if the campaign has ended.
    /// - [`ContractError::CampaignNotStarted`] if `start_ledger` has not been reached.
    /// - [`ContractError::CampaignExpired`] if `end_ledger` has passed.
    /// - [`ContractError::BudgetExhausted`] if adding one more reward would exceed `max_budget`.
    /// - [`ContractError::ArithmeticOverflow`] on internal overflow (should never occur in practice).
    pub fn record_distribution(
        env: Env,
        id: u64,
        caller: Address,
    ) -> Result<i128, ContractError> {
        Self::require_contract_active(&env)?;

        let mut campaign = Self::load_campaign(&env, id)?;
        Self::require_owner_or_admin(&env, &caller, &campaign)?;

        match campaign.status {
            CampaignStatus::Paused => return Err(ContractError::CampaignPaused),
            CampaignStatus::Ended  => return Err(ContractError::CampaignEnded),
            CampaignStatus::Active => {}
        }

        let current_ledger = env.ledger().sequence();
        if current_ledger < campaign.start_ledger {
            return Err(ContractError::CampaignNotStarted);
        }
        if current_ledger > campaign.end_ledger {
            return Err(ContractError::CampaignExpired);
        }

        let new_budget_used = campaign
            .budget_used
            .checked_add(campaign.reward_amount_per_action)
            .ok_or(ContractError::ArithmeticOverflow)?;

        if new_budget_used > campaign.max_budget {
            return Err(ContractError::BudgetExhausted);
        }

        campaign.budget_used = new_budget_used;
        let reward = campaign.reward_amount_per_action;
        Self::save_campaign(&env, id, &campaign);

        Ok(reward)
    }

    // ── Admin contract-level controls ─────────────────────────────────────────

    /// Pause all contract operations. Admin only.
    ///
    /// While paused, all state-modifying functions return
    /// [`ContractError::ContractPaused`].
    ///
    /// # Errors
    /// - [`ContractError::NotInitialized`] if the contract has not been initialized.
    /// - [`ContractError::Unauthorized`] if `caller` is not the admin.
    pub fn pause_contract(env: Env, caller: Address) -> Result<(), ContractError> {
        let admin = Self::read_admin(&env)?;
        if caller != admin {
            return Err(ContractError::Unauthorized);
        }
        caller.require_auth();
        env.storage().instance().set(&DataKey::Paused, &true);
        Ok(())
    }

    /// Unpause contract operations. Admin only.
    ///
    /// # Errors
    /// - [`ContractError::NotInitialized`] if the contract has not been initialized.
    /// - [`ContractError::Unauthorized`] if `caller` is not the admin.
    pub fn unpause_contract(env: Env, caller: Address) -> Result<(), ContractError> {
        let admin = Self::read_admin(&env)?;
        if caller != admin {
            return Err(ContractError::Unauthorized);
        }
        caller.require_auth();
        env.storage().instance().set(&DataKey::Paused, &false);
        Ok(())
    }

    // ── Read-only queries ─────────────────────────────────────────────────────

    /// Returns the full [`Campaign`] struct for a given ID.
    ///
    /// # Errors
    /// - [`ContractError::CampaignNotFound`] if no campaign with `id` exists.
    pub fn get_campaign(env: Env, id: u64) -> Result<Campaign, ContractError> {
        Self::load_campaign(&env, id)
    }

    /// Returns the remaining budget for a campaign (`max_budget - budget_used`).
    ///
    /// # Errors
    /// - [`ContractError::CampaignNotFound`] if no campaign with `id` exists.
    pub fn get_remaining_budget(env: Env, id: u64) -> Result<i128, ContractError> {
        let campaign = Self::load_campaign(&env, id)?;
        Ok(campaign.max_budget - campaign.budget_used)
    }

    /// Returns `true` if the campaign is currently active and within its
    /// ledger window.
    ///
    /// # Errors
    /// - [`ContractError::CampaignNotFound`] if no campaign with `id` exists.
    pub fn is_campaign_live(env: Env, id: u64) -> Result<bool, ContractError> {
        let campaign = Self::load_campaign(&env, id)?;
        if campaign.status != CampaignStatus::Active {
            return Ok(false);
        }
        let seq = env.ledger().sequence();
        Ok(seq >= campaign.start_ledger && seq <= campaign.end_ledger)
    }

    /// Returns the current admin address.
    ///
    /// # Errors
    /// - [`ContractError::NotInitialized`] if the contract has not been initialized.
    pub fn get_admin(env: Env) -> Result<Address, ContractError> {
        Self::read_admin(&env)
    }

    /// Returns `true` if the contract-level pause is active.
    pub fn is_contract_paused(env: Env) -> bool {
        env.storage()
            .instance()
            .get(&DataKey::Paused)
            .unwrap_or(false)
    }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{
        testutils::{Address as _, Ledger},
        Env, String,
    };

    // ── Helpers ───────────────────────────────────────────────────────────────

    fn setup(env: &Env) -> (Address, CampaignContractClient) {
        env.mock_all_auths();
        let admin = Address::generate(env);
        let contract_id = env.register(CampaignContract, ());
        let client = CampaignContractClient::new(env, &contract_id);
        client.initialize(&admin).unwrap();
        (admin, client)
    }

    fn default_campaign_args(env: &Env) -> (Address, Address, i128, u32, u32, i128, String, String) {
        let owner = Address::generate(env);
        let token = Address::generate(env);
        (
            owner,
            token,
            100_i128,                                    // reward_amount_per_action
            10_u32,                                      // start_ledger
            1_000_u32,                                   // end_ledger
            10_000_i128,                                 // max_budget
            String::from_str(env, "Test Campaign"),
            String::from_str(env, "Must hold 1 NOVA"),
        )
    }

    fn create_default(env: &Env, client: &CampaignContractClient, id: u64) -> Address {
        let (owner, token, rpa, sl, el, mb, name, ec) = default_campaign_args(env);
        client
            .create_campaign(&id, &owner, &token, &rpa, &sl, &el, &mb, &name, &ec)
            .unwrap();
        owner
    }

    // ── initialize ────────────────────────────────────────────────────────────

    #[test]
    fn initialize_sets_admin() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let id = env.register(CampaignContract, ());
        let client = CampaignContractClient::new(&env, &id);
        client.initialize(&admin).unwrap();
        assert_eq!(client.get_admin().unwrap(), admin);
    }

    #[test]
    fn initialize_twice_returns_already_initialized() {
        let env = Env::default();
        let (_admin, client) = setup(&env);
        let other = Address::generate(&env);
        let err = client.initialize(&other).unwrap_err();
        assert_eq!(err, ContractError::AlreadyInitialized);
    }

    // ── create_campaign ───────────────────────────────────────────────────────

    #[test]
    fn create_campaign_stores_data() {
        let env = Env::default();
        let (_admin, client) = setup(&env);
        let owner = create_default(&env, &client, 1);
        let c = client.get_campaign(&1).unwrap();
        assert_eq!(c.owner, owner);
        assert_eq!(c.reward_amount_per_action, 100);
        assert_eq!(c.max_budget, 10_000);
        assert_eq!(c.budget_used, 0);
        assert_eq!(c.status, CampaignStatus::Active);
    }

    #[test]
    fn create_campaign_emits_created_event() {
        let env = Env::default();
        let (_admin, client) = setup(&env);
        create_default(&env, &client, 1);
        assert!(!env.events().all().is_empty());
    }

    #[test]
    fn create_campaign_duplicate_id_returns_error() {
        let env = Env::default();
        let (_admin, client) = setup(&env);
        create_default(&env, &client, 1);
        let (owner, token, rpa, sl, el, mb, name, ec) = default_campaign_args(&env);
        let err = client
            .create_campaign(&1, &owner, &token, &rpa, &sl, &el, &mb, &name, &ec)
            .unwrap_err();
        assert_eq!(err, ContractError::CampaignAlreadyExists);
    }

    #[test]
    fn create_campaign_zero_id_returns_error() {
        let env = Env::default();
        let (_admin, client) = setup(&env);
        let (owner, token, rpa, sl, el, mb, name, ec) = default_campaign_args(&env);
        let err = client
            .create_campaign(&0, &owner, &token, &rpa, &sl, &el, &mb, &name, &ec)
            .unwrap_err();
        assert_eq!(err, ContractError::InvalidCampaignId);
    }

    #[test]
    fn create_campaign_zero_reward_returns_error() {
        let env = Env::default();
        let (_admin, client) = setup(&env);
        let (owner, token, _, sl, el, mb, name, ec) = default_campaign_args(&env);
        let err = client
            .create_campaign(&1, &owner, &token, &0, &sl, &el, &mb, &name, &ec)
            .unwrap_err();
        assert_eq!(err, ContractError::InvalidRewardAmount);
    }

    #[test]
    fn create_campaign_zero_budget_returns_error() {
        let env = Env::default();
        let (_admin, client) = setup(&env);
        let (owner, token, rpa, sl, el, _, name, ec) = default_campaign_args(&env);
        let err = client
            .create_campaign(&1, &owner, &token, &rpa, &sl, &el, &0, &name, &ec)
            .unwrap_err();
        assert_eq!(err, ContractError::InvalidMaxBudget);
    }

    #[test]
    fn create_campaign_budget_less_than_reward_returns_error() {
        let env = Env::default();
        let (_admin, client) = setup(&env);
        let (owner, token, _, sl, el, _, name, ec) = default_campaign_args(&env);
        // reward=200, budget=100 → InsufficientBudget
        let err = client
            .create_campaign(&1, &owner, &token, &200, &sl, &el, &100, &name, &ec)
            .unwrap_err();
        assert_eq!(err, ContractError::InsufficientBudget);
    }

    #[test]
    fn create_campaign_invalid_ledger_range_returns_error() {
        let env = Env::default();
        let (_admin, client) = setup(&env);
        let (owner, token, rpa, _, _, mb, name, ec) = default_campaign_args(&env);
        // end_ledger == start_ledger → invalid
        let err = client
            .create_campaign(&1, &owner, &token, &rpa, &100, &100, &mb, &name, &ec)
            .unwrap_err();
        assert_eq!(err, ContractError::InvalidLedgerRange);
    }

    #[test]
    fn create_campaign_empty_eligibility_returns_error() {
        let env = Env::default();
        let (_admin, client) = setup(&env);
        let (owner, token, rpa, sl, el, mb, name, _) = default_campaign_args(&env);
        let err = client
            .create_campaign(
                &1, &owner, &token, &rpa, &sl, &el, &mb, &name,
                &String::from_str(&env, ""),
            )
            .unwrap_err();
        assert_eq!(err, ContractError::InvalidEligibilityCriteria);
    }

    // ── pause_campaign ────────────────────────────────────────────────────────

    #[test]
    fn pause_campaign_transitions_to_paused() {
        let env = Env::default();
        let (_admin, client) = setup(&env);
        let owner = create_default(&env, &client, 1);
        client.pause_campaign(&1, &owner).unwrap();
        assert_eq!(client.get_campaign(&1).unwrap().status, CampaignStatus::Paused);
    }

    #[test]
    fn pause_campaign_emits_paused_event() {
        let env = Env::default();
        let (_admin, client) = setup(&env);
        let owner = create_default(&env, &client, 1);
        let events_before = env.events().all().len();
        client.pause_campaign(&1, &owner).unwrap();
        assert!(env.events().all().len() > events_before);
    }

    #[test]
    fn pause_campaign_already_paused_returns_error() {
        let env = Env::default();
        let (_admin, client) = setup(&env);
        let owner = create_default(&env, &client, 1);
        client.pause_campaign(&1, &owner).unwrap();
        let err = client.pause_campaign(&1, &owner).unwrap_err();
        assert_eq!(err, ContractError::CampaignPaused);
    }

    #[test]
    fn pause_campaign_ended_returns_error() {
        let env = Env::default();
        let (admin, client) = setup(&env);
        let owner = create_default(&env, &client, 1);
        client.end_campaign(&1, &owner).unwrap();
        let err = client.pause_campaign(&1, &admin).unwrap_err();
        assert_eq!(err, ContractError::CampaignEnded);
    }

    #[test]
    fn pause_campaign_unauthorized_returns_error() {
        let env = Env::default();
        let (_admin, client) = setup(&env);
        create_default(&env, &client, 1);
        let stranger = Address::generate(&env);
        let err = client.pause_campaign(&1, &stranger).unwrap_err();
        assert_eq!(err, ContractError::Unauthorized);
    }

    #[test]
    fn admin_can_pause_any_campaign() {
        let env = Env::default();
        let (admin, client) = setup(&env);
        create_default(&env, &client, 1);
        client.pause_campaign(&1, &admin).unwrap();
        assert_eq!(client.get_campaign(&1).unwrap().status, CampaignStatus::Paused);
    }

    // ── resume_campaign ───────────────────────────────────────────────────────

    #[test]
    fn resume_campaign_transitions_to_active() {
        let env = Env::default();
        let (_admin, client) = setup(&env);
        let owner = create_default(&env, &client, 1);
        client.pause_campaign(&1, &owner).unwrap();
        client.resume_campaign(&1, &owner).unwrap();
        assert_eq!(client.get_campaign(&1).unwrap().status, CampaignStatus::Active);
    }

    #[test]
    fn resume_campaign_emits_resumed_event() {
        let env = Env::default();
        let (_admin, client) = setup(&env);
        let owner = create_default(&env, &client, 1);
        client.pause_campaign(&1, &owner).unwrap();
        let events_before = env.events().all().len();
        client.resume_campaign(&1, &owner).unwrap();
        assert!(env.events().all().len() > events_before);
    }

    #[test]
    fn resume_campaign_not_paused_returns_error() {
        let env = Env::default();
        let (_admin, client) = setup(&env);
        let owner = create_default(&env, &client, 1);
        let err = client.resume_campaign(&1, &owner).unwrap_err();
        assert_eq!(err, ContractError::CampaignNotPaused);
    }

    #[test]
    fn resume_campaign_ended_returns_error() {
        let env = Env::default();
        let (_admin, client) = setup(&env);
        let owner = create_default(&env, &client, 1);
        client.end_campaign(&1, &owner).unwrap();
        let err = client.resume_campaign(&1, &owner).unwrap_err();
        assert_eq!(err, ContractError::CampaignEnded);
    }

    #[test]
    fn resume_campaign_expired_returns_error() {
        let env = Env::default();
        let (_admin, client) = setup(&env);
        let owner = create_default(&env, &client, 1);
        client.pause_campaign(&1, &owner).unwrap();
        // Advance ledger past end_ledger (1000)
        env.ledger().with_mut(|l| l.sequence_number = 1_001);
        let err = client.resume_campaign(&1, &owner).unwrap_err();
        assert_eq!(err, ContractError::CampaignExpired);
    }

    // ── end_campaign ──────────────────────────────────────────────────────────

    #[test]
    fn end_campaign_transitions_to_ended() {
        let env = Env::default();
        let (_admin, client) = setup(&env);
        let owner = create_default(&env, &client, 1);
        client.end_campaign(&1, &owner).unwrap();
        assert_eq!(client.get_campaign(&1).unwrap().status, CampaignStatus::Ended);
    }

    #[test]
    fn end_campaign_emits_ended_event() {
        let env = Env::default();
        let (_admin, client) = setup(&env);
        let owner = create_default(&env, &client, 1);
        let events_before = env.events().all().len();
        client.end_campaign(&1, &owner).unwrap();
        assert!(env.events().all().len() > events_before);
    }

    #[test]
    fn end_campaign_already_ended_returns_error() {
        let env = Env::default();
        let (_admin, client) = setup(&env);
        let owner = create_default(&env, &client, 1);
        client.end_campaign(&1, &owner).unwrap();
        let err = client.end_campaign(&1, &owner).unwrap_err();
        assert_eq!(err, ContractError::CampaignEnded);
    }

    #[test]
    fn end_campaign_paused_campaign_succeeds() {
        let env = Env::default();
        let (_admin, client) = setup(&env);
        let owner = create_default(&env, &client, 1);
        client.pause_campaign(&1, &owner).unwrap();
        // Owner can still end a paused campaign
        client.end_campaign(&1, &owner).unwrap();
        assert_eq!(client.get_campaign(&1).unwrap().status, CampaignStatus::Ended);
    }

    #[test]
    fn end_campaign_unauthorized_returns_error() {
        let env = Env::default();
        let (_admin, client) = setup(&env);
        create_default(&env, &client, 1);
        let stranger = Address::generate(&env);
        let err = client.end_campaign(&1, &stranger).unwrap_err();
        assert_eq!(err, ContractError::Unauthorized);
    }

    #[test]
    fn admin_can_end_any_campaign() {
        let env = Env::default();
        let (admin, client) = setup(&env);
        create_default(&env, &client, 1);
        client.end_campaign(&1, &admin).unwrap();
        assert_eq!(client.get_campaign(&1).unwrap().status, CampaignStatus::Ended);
    }

    // ── record_distribution / budget cap ─────────────────────────────────────

    #[test]
    fn record_distribution_increments_budget_used() {
        let env = Env::default();
        let (_admin, client) = setup(&env);
        let owner = create_default(&env, &client, 1);
        // Advance ledger into the campaign window (start=10, end=1000)
        env.ledger().with_mut(|l| l.sequence_number = 50);
        let reward = client.record_distribution(&1, &owner).unwrap();
        assert_eq!(reward, 100);
        assert_eq!(client.get_campaign(&1).unwrap().budget_used, 100);
    }

    #[test]
    fn record_distribution_budget_exhausted_returns_error() {
        let env = Env::default();
        let (_admin, client) = setup(&env);
        let owner = create_default(&env, &client, 1);
        env.ledger().with_mut(|l| l.sequence_number = 50);
        // max_budget=10_000, reward=100 → 100 distributions allowed
        for _ in 0..100 {
            client.record_distribution(&1, &owner).unwrap();
        }
        // 101st should fail
        let err = client.record_distribution(&1, &owner).unwrap_err();
        assert_eq!(err, ContractError::BudgetExhausted);
    }

    #[test]
    fn record_distribution_before_start_returns_error() {
        let env = Env::default();
        let (_admin, client) = setup(&env);
        let owner = create_default(&env, &client, 1);
        // Ledger is at 0, start_ledger is 10
        let err = client.record_distribution(&1, &owner).unwrap_err();
        assert_eq!(err, ContractError::CampaignNotStarted);
    }

    #[test]
    fn record_distribution_after_end_returns_error() {
        let env = Env::default();
        let (_admin, client) = setup(&env);
        let owner = create_default(&env, &client, 1);
        env.ledger().with_mut(|l| l.sequence_number = 1_001);
        let err = client.record_distribution(&1, &owner).unwrap_err();
        assert_eq!(err, ContractError::CampaignExpired);
    }

    #[test]
    fn record_distribution_paused_campaign_returns_error() {
        let env = Env::default();
        let (_admin, client) = setup(&env);
        let owner = create_default(&env, &client, 1);
        env.ledger().with_mut(|l| l.sequence_number = 50);
        client.pause_campaign(&1, &owner).unwrap();
        let err = client.record_distribution(&1, &owner).unwrap_err();
        assert_eq!(err, ContractError::CampaignPaused);
    }

    #[test]
    fn record_distribution_ended_campaign_returns_error() {
        let env = Env::default();
        let (_admin, client) = setup(&env);
        let owner = create_default(&env, &client, 1);
        env.ledger().with_mut(|l| l.sequence_number = 50);
        client.end_campaign(&1, &owner).unwrap();
        let err = client.record_distribution(&1, &owner).unwrap_err();
        assert_eq!(err, ContractError::CampaignEnded);
    }

    // ── get_remaining_budget ──────────────────────────────────────────────────

    #[test]
    fn get_remaining_budget_returns_correct_value() {
        let env = Env::default();
        let (_admin, client) = setup(&env);
        let owner = create_default(&env, &client, 1);
        env.ledger().with_mut(|l| l.sequence_number = 50);
        client.record_distribution(&1, &owner).unwrap();
        assert_eq!(client.get_remaining_budget(&1).unwrap(), 9_900);
    }

    // ── is_campaign_live ──────────────────────────────────────────────────────

    #[test]
    fn is_campaign_live_returns_true_in_window() {
        let env = Env::default();
        let (_admin, client) = setup(&env);
        create_default(&env, &client, 1);
        env.ledger().with_mut(|l| l.sequence_number = 50);
        assert!(client.is_campaign_live(&1).unwrap());
    }

    #[test]
    fn is_campaign_live_returns_false_before_start() {
        let env = Env::default();
        let (_admin, client) = setup(&env);
        create_default(&env, &client, 1);
        // Ledger at 0, start_ledger=10
        assert!(!client.is_campaign_live(&1).unwrap());
    }

    #[test]
    fn is_campaign_live_returns_false_when_paused() {
        let env = Env::default();
        let (_admin, client) = setup(&env);
        let owner = create_default(&env, &client, 1);
        env.ledger().with_mut(|l| l.sequence_number = 50);
        client.pause_campaign(&1, &owner).unwrap();
        assert!(!client.is_campaign_live(&1).unwrap());
    }

    // ── contract-level pause ──────────────────────────────────────────────────

    #[test]
    fn contract_pause_blocks_create_campaign() {
        let env = Env::default();
        let (admin, client) = setup(&env);
        client.pause_contract(&admin).unwrap();
        let (owner, token, rpa, sl, el, mb, name, ec) = default_campaign_args(&env);
        let err = client
            .create_campaign(&1, &owner, &token, &rpa, &sl, &el, &mb, &name, &ec)
            .unwrap_err();
        assert_eq!(err, ContractError::ContractPaused);
    }

    #[test]
    fn contract_unpause_restores_operations() {
        let env = Env::default();
        let (admin, client) = setup(&env);
        client.pause_contract(&admin).unwrap();
        client.unpause_contract(&admin).unwrap();
        assert!(!client.is_contract_paused());
        create_default(&env, &client, 1);
    }

    #[test]
    fn non_admin_cannot_pause_contract() {
        let env = Env::default();
        let (_admin, client) = setup(&env);
        let stranger = Address::generate(&env);
        let err = client.pause_contract(&stranger).unwrap_err();
        assert_eq!(err, ContractError::Unauthorized);
    }

    // ── not found ─────────────────────────────────────────────────────────────

    #[test]
    fn get_campaign_not_found_returns_error() {
        let env = Env::default();
        let (_admin, client) = setup(&env);
        let err = client.get_campaign(&999).unwrap_err();
        assert_eq!(err, ContractError::CampaignNotFound);
    }

    #[test]
    fn pause_campaign_not_found_returns_error() {
        let env = Env::default();
        let (_admin, client) = setup(&env);
        let caller = Address::generate(&env);
        let err = client.pause_campaign(&999, &caller).unwrap_err();
        assert_eq!(err, ContractError::CampaignNotFound);
    }

    #[test]
    fn end_campaign_not_found_returns_error() {
        let env = Env::default();
        let (_admin, client) = setup(&env);
        let caller = Address::generate(&env);
        let err = client.end_campaign(&999, &caller).unwrap_err();
        assert_eq!(err, ContractError::CampaignNotFound);
    }
}
