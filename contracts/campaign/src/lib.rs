//! # Campaign Contract
//!
//! Multi-token reward campaigns with participant management and M-of-N upgrade support.
//!
//! ## Event Schema (v1)
//! All events include `schema_version` as the first data element.
//!
//! | topics                          | data                                                    |
//! |---------------------------------|---------------------------------------------------------|
//! | `("camp", "created")`           | `(v, id, owner, reward_count, max_participants)`        |
//! | `("camp", "activated")`         | `(v, id, owner)`                                        |
//! | `("camp", "deactivated")`       | `(v, id, owner)`                                        |
//! | `("camp", "joined")`            | `(v, id, participant)`                                  |
//! | `("camp", "reward_issued")`     | `(v, id, participant, reward_count)`                    |
//! | `("camp", "paused")`            | `(v, admin)`                                            |
//! | `("camp", "unpaused")`          | `(v, admin)`                                            |
//! | `("camp", "upgraded")`          | `(v, new_wasm_hash)`                                    |
#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, Address, BytesN, Env, Vec,
};

// ── Constants ────────────────────────────────────────────────────────────────
const MAX_TOKENS: u32 = 5;

/// Schema version for all events emitted by this contract.
pub const EVENT_SCHEMA_VERSION: u32 = 1;

// ── Storage Keys ─────────────────────────────────────────────────────────────
#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    /// Instance: admin address.
    Admin,
    Campaign(u64),
    Participants(u64),
    Joined(u64, Address),
    Paused,
    /// Multisig signers for upgrade authorization
    Signers,
    /// Minimum approvals required for upgrade
    Threshold,
    /// Pending upgrade approvals: wasm_hash -> Vec<Address>
    UpgradeApprovals(BytesN<32>),
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

// ── Event helpers ─────────────────────────────────────────────────────────────

fn emit_campaign_created(
    env: &Env,
    id: u64,
    owner: &Address,
    reward_count: u32,
    max_participants: u32,
) {
    env.events().publish(
        (symbol_short!("camp"), symbol_short!("created")),
        (EVENT_SCHEMA_VERSION, id, owner.clone(), reward_count, max_participants),
    );
}

fn emit_campaign_activated(env: &Env, id: u64, owner: &Address) {
    env.events().publish(
        (symbol_short!("camp"), symbol_short!("activated")),
        (EVENT_SCHEMA_VERSION, id, owner.clone()),
    );
}

fn emit_campaign_deactivated(env: &Env, id: u64, owner: &Address) {
    env.events().publish(
        (symbol_short!("camp"), symbol_short!("deactivated")),
        (EVENT_SCHEMA_VERSION, id, owner.clone()),
    );
}

fn emit_campaign_joined(env: &Env, id: u64, participant: &Address) {
    env.events().publish(
        (symbol_short!("camp"), symbol_short!("joined")),
        (EVENT_SCHEMA_VERSION, id, participant.clone()),
    );
}

fn emit_reward_issued(env: &Env, id: u64, participant: &Address, reward_count: u32) {
    env.events().publish(
        (symbol_short!("camp"), symbol_short!("rwd_issued")),
        (EVENT_SCHEMA_VERSION, id, participant.clone(), reward_count),
    );
}

fn emit_paused(env: &Env, admin: &Address) {
    env.events().publish(
        (symbol_short!("camp"), symbol_short!("paused")),
        (EVENT_SCHEMA_VERSION, admin.clone()),
    );
}

fn emit_unpaused(env: &Env, admin: &Address) {
    env.events().publish(
        (symbol_short!("camp"), symbol_short!("unpaused")),
        (EVENT_SCHEMA_VERSION, admin.clone()),
    );
}

fn emit_contract_upgraded(env: &Env, new_wasm_hash: &BytesN<32>) {
    env.events().publish(
        (symbol_short!("camp"), symbol_short!("upgraded")),
        (EVENT_SCHEMA_VERSION, new_wasm_hash.clone()),
    );
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
    /// Initialize the contract with an admin and upgrade multisig config.
    ///
    /// # Parameters
    /// - `admin` – Admin address for pause/unpause operations.
    /// - `signers` – Multisig signer set for upgrade authorization.
    /// - `threshold` – Minimum approvals required to execute an upgrade.
    pub fn initialize(env: Env, admin: Address, signers: Vec<Address>, threshold: u32) {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(ContractError::AlreadyInitialized);
        }
        assert!(threshold >= 1, "threshold must be at least 1");
        assert!(
            signers.len() >= threshold,
            "signers count must be >= threshold"
        );
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Signers, &signers);
        env.storage().instance().set(&DataKey::Threshold, &threshold);
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
    fn is_paused_internal(env: &Env) -> bool {
        env.storage().instance().get(&DataKey::Paused).unwrap_or(false)
    }

    fn require_not_paused(env: &Env) {
        if Self::is_paused_internal(env) {
            panic!("contract is paused");
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
    /// Create a new campaign with multiple token rewards (up to 5).
    ///
    /// # Events
    /// Emits `("camp", "created")` with `(schema_version, id, owner, reward_count, max_participants)`.
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
        if rewards.len() > MAX_TOKENS {
            panic!("too many tokens");
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

        for reward in rewards.iter() {
            if reward.amount <= 0 {
                panic!("reward amount must be positive");
            }
        }

        let reward_count = rewards.len() as u32;
        let data = CampaignData {
            owner: owner.clone(),
            rewards,
            active: false,
            completed: false,
            max_participants,
            current_participants: 0,
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
        emit_campaign_created(&env, id, &owner, reward_count, max_participants);
    }

    /// Activate or deactivate a campaign. Only owner can call.
    ///
    /// # Events
    /// Emits `("camp", "activated")` or `("camp", "deactivated")`.
    pub fn set_active(env: Env, id: u64, active: bool) {
        Self::require_not_paused(&env);
        let key = DataKey::Campaign(id);
        let mut data: CampaignData = env.storage().persistent().get(&key).expect("campaign not found");
        data.owner.require_auth();

        data.active = active;
        env.storage().persistent().set(&key, &data);
        env.storage().persistent().extend_ttl(&key, 2_678_400, 2_678_400);

        if active {
            emit_campaign_activated(&env, id, &data.owner);
        } else {
            emit_campaign_deactivated(&env, id, &data.owner);
        }
    }

    /// Join an active campaign.
    ///
    /// # Events
    /// Emits `("camp", "joined")` with `(schema_version, id, participant)`.
    pub fn join_campaign(env: Env, id: u64, participant: Address) {
        Self::require_not_paused(&env);
        participant.require_auth();
        let key = DataKey::Campaign(id);
        let mut data: CampaignData = env.storage().persistent().get(&key).expect("campaign not found");

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
        data.current_participants += 1;
        env.storage().persistent().set(&key, &data);
        env.storage().persistent().extend_ttl(&key, 2_678_400, 2_678_400);
        env.storage().persistent().set(&joined_key, &true);

        let mut participants: Vec<Address> = env
            .storage()
            .persistent()
            .get(&DataKey::Participants(id))
            .unwrap();
        participants.push_back(participant.clone());
        env.storage().persistent().set(&DataKey::Participants(id), &participants);
        env.storage()
            .persistent()
            .extend_ttl(&DataKey::Participants(id), 2_678_400, 2_678_400);

        emit_campaign_joined(&env, id, &participant);
    }

    /// Distribute all configured rewards to a participant atomically.
    ///
    /// # Events
    /// Emits `("camp", "rwd_issued")` with `(schema_version, id, participant, reward_count)`.
    pub fn distribute_reward(env: Env, id: u64, participant: Address) {
        Self::require_not_paused(&env);
        let key = DataKey::Campaign(id);
        let data: CampaignData = env.storage().persistent().get(&key).expect("campaign not found");
        data.owner.require_auth();

        let joined_key = DataKey::Joined(id, participant.clone());
        if !env.storage().persistent().has(&joined_key) {
            panic!("participant not in campaign");
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
        let reward_count = data.rewards.len() as u32;
        emit_reward_issued(&env, id, &participant, reward_count);
    }

    pub fn get_campaign(env: Env, id: u64) -> CampaignData {
        let key = DataKey::Campaign(id);
        let data = env.storage().persistent().get(&key).expect("campaign not found");
        env.storage().persistent().extend_ttl(&key, 2_678_400, 2_678_400);
        data
    }

    /// Pauses all contract operations. Only admin can call.
    ///
    /// # Events
    /// Emits `("camp", "paused")` with `(schema_version, admin)`.
    pub fn pause(env: Env) {
        let admin = Self::get_admin(&env);
        admin.require_auth();
        env.storage().instance().set(&DataKey::Paused, &true);
        emit_paused(&env, &admin);
    }

    /// Unpauses contract operations. Only admin can call.
    ///
    /// # Events
    /// Emits `("camp", "unpaused")` with `(schema_version, admin)`.
    pub fn unpause(env: Env) {
        let admin = Self::get_admin(&env);
        admin.require_auth();
        env.storage().instance().set(&DataKey::Paused, &false);
        emit_unpaused(&env, &admin);
    }

    pub fn is_paused(env: Env) -> bool {
        Self::is_paused_internal(&env)
    }

    // ── Upgrade (M-of-N multisig) ─────────────────────────────────────────────

    /// Approve a pending WASM upgrade. Executes when threshold is reached.
    ///
    /// # Events
    /// Emits `("camp", "upgraded")` with `(schema_version, new_wasm_hash)` when threshold is met.
    ///
    /// # Panics
    /// - `"not an authorized signer"` if `signer` is not in the signer set.
    /// - `"already approved"` if `signer` has already approved this hash.
    pub fn approve_upgrade(env: Env, signer: Address, new_wasm_hash: BytesN<32>) {
        signer.require_auth();

        let signers: Vec<Address> = env
            .storage()
            .instance()
            .get(&DataKey::Signers)
            .expect("not initialized");
        let is_authorized = signers.iter().any(|s| s == signer);
        assert!(is_authorized, "not an authorized signer");

        let approval_key = DataKey::UpgradeApprovals(new_wasm_hash.clone());
        let mut approvals: Vec<Address> = env
            .storage()
            .instance()
            .get(&approval_key)
            .unwrap_or(Vec::new(&env));

        let already_approved = approvals.iter().any(|a| a == signer);
        assert!(!already_approved, "already approved");

        approvals.push_back(signer);
        env.storage().instance().set(&approval_key, &approvals);

        let threshold: u32 = env
            .storage()
            .instance()
            .get(&DataKey::Threshold)
            .unwrap_or(1);

        if approvals.len() >= threshold {
            env.storage().instance().remove(&approval_key);
            emit_contract_upgraded(&env, &new_wasm_hash);
            env.deployer().update_current_contract_wasm(new_wasm_hash);
        }
    }

    pub fn get_upgrade_approvals(env: Env, new_wasm_hash: BytesN<32>) -> u32 {
        let approval_key = DataKey::UpgradeApprovals(new_wasm_hash);
        let approvals: Vec<Address> = env
            .storage()
            .instance()
            .get(&approval_key)
            .unwrap_or(Vec::new(&env));
        approvals.len()
    }

    pub fn get_threshold(env: Env) -> u32 {
        env.storage()
            .instance()
            .get(&DataKey::Threshold)
            .unwrap_or(1)
    }

    pub fn get_signers(env: Env) -> Vec<Address> {
        env.storage()
            .instance()
            .get(&DataKey::Signers)
            .unwrap_or(Vec::new(&env))
    }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use errors::ContractError;
    use soroban_sdk::{testutils::{Address as _, Ledger}, Env};
    use soroban_sdk::testutils::Address as _;

    // ── Helpers ───────────────────────────────────────────────────────────────

    fn setup() -> (Env, Address, Address, CampaignContractClient<'static>) {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(CampaignContract, ());
        let client = CampaignContractClient::new(env, &contract_id);
        client.initialize(&admin, &soroban_sdk::vec![env, admin.clone()], &1);
        (admin, client)
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
        let (_admin, client) = setup(&env);
        let owner = Address::generate(&env);
        let token1 = Address::generate(&env);
        let token2 = Address::generate(&env);
        let id = 1u64;

        let rewards = soroban_sdk::vec![
            &env,
            TokenReward { token: token1.clone(), amount: 100 },
            TokenReward { token: token2.clone(), amount: 50 },
        ];
        client.create_campaign(&id, &owner, &rewards, &2);
        let data = client.get_campaign(&id);
        assert_eq!(data.owner, owner);
        assert_eq!(data.active, false);
        assert_eq!(data.rewards.len(), 2);

        client.set_active(&id, &true);
        assert_eq!(client.get_campaign(&id).active, true);

        let alice = Address::generate(&env);
        let bob = Address::generate(&env);
        client.join_campaign(&id, &alice);
        client.join_campaign(&id, &bob);

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
        client.distribute_reward(&id, &alice);
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
        let tokens: Vec<Address> = (0..5).map(|_| Address::generate(&env)).collect();
        let id = 1u64;

        let rewards = soroban_sdk::vec![
            &env,
            TokenReward { token: tokens[0].clone(), amount: 100 },
            TokenReward { token: tokens[1].clone(), amount: 200 },
            TokenReward { token: tokens[2].clone(), amount: 300 },
            TokenReward { token: tokens[3].clone(), amount: 400 },
            TokenReward { token: tokens[4].clone(), amount: 500 },
        ];
        client.create_campaign(&id, &owner, &rewards, &1);
        let data = client.get_campaign(&id);
        assert_eq!(data.rewards.len(), 5);
    }

    #[test]
    #[should_panic(expected = "too many tokens")]
    fn test_max_tokens_exceeded() {
        let env = Env::default();
        let (_admin, client) = setup(&env);
        let owner = Address::generate(&env);
        let tokens: Vec<Address> = (0..6).map(|_| Address::generate(&env)).collect();
        let id = 1u64;

        let rewards = soroban_sdk::vec![
            &env,
            TokenReward { token: tokens[0].clone(), amount: 100 },
            TokenReward { token: tokens[1].clone(), amount: 100 },
            TokenReward { token: tokens[2].clone(), amount: 100 },
            TokenReward { token: tokens[3].clone(), amount: 100 },
            TokenReward { token: tokens[4].clone(), amount: 100 },
            TokenReward { token: tokens[5].clone(), amount: 100 },
        ];
        client.create_campaign(&id, &owner, &rewards, &1);
    }

    #[test]
    #[should_panic(expected = "campaign is full")]
    fn test_campaign_full() {
        let env = Env::default();
        let (_admin, client) = setup(&env);
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
        let rewards = soroban_sdk::vec![&env, TokenReward { token: token.clone(), amount: 100 }];
        client.create_campaign(&id, &owner, &rewards, &1);
        client.set_active(&id, &true);

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
        let rewards = soroban_sdk::vec![&env, TokenReward { token: token.clone(), amount: 100 }];
        client.create_campaign(&id, &owner, &rewards, &10);
        let alice = Address::generate(&env);
        client.join_campaign(&id, &alice);
    }

    #[test]
    fn test_pause_unpause() {
        let env = Env::default();
        let (_admin, client) = setup(&env);

        assert_eq!(client.is_paused(), false);
        client.pause();
        assert_eq!(client.is_paused(), true);
        client.unpause();
        assert_eq!(client.is_paused(), false);
    }

    #[test]
    #[should_panic(expected = "contract is paused")]
    fn test_create_campaign_while_paused() {
        let env = Env::default();
        let (_admin, client) = setup(&env);
        let owner = Address::generate(&env);
        let token = Address::generate(&env);
        let id = 1u64;

        client.pause();

        let rewards = soroban_sdk::vec![&env, TokenReward { token: token.clone(), amount: 100 }];
        client.create_campaign(&id, &owner, &rewards, &10);
    }

    // ── Upgrade tests ─────────────────────────────────────────────────────────

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
    fn test_upgrade_approval_accumulates() {
        let env = Env::default();
        env.mock_all_auths();
        let cid = env.register(CampaignContract, ());
        let client = CampaignContractClient::new(&env, &cid);
        let s1 = Address::generate(&env);
        let s2 = Address::generate(&env);
        client.initialize(&s1, &soroban_sdk::vec![&env, s1.clone(), s2.clone()], &2);

        let fake_hash = BytesN::from_array(&env, &[0u8; 32]);
        client.approve_upgrade(&s1, &fake_hash);
        assert_eq!(client.get_upgrade_approvals(&fake_hash), 1);
        assert_eq!(client.get_threshold(), 2);
    }

    #[test]
    #[should_panic(expected = "not an authorized signer")]
    fn test_unauthorized_upgrade_rejected() {
        let env = Env::default();
        let (_admin, client) = setup(&env);
        let outsider = Address::generate(&env);
        let fake_hash = BytesN::from_array(&env, &[1u8; 32]);
        client.approve_upgrade(&outsider, &fake_hash);
    }
}
