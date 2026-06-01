//! # Distribution Contract
//!
//! Merchant-controlled reward distribution with campaign registration,
//! batch support (up to 50 recipients), and per-distribution events.
//!
//! ## Acceptance Criteria (closes #548)
//! - Merchant registers a campaign with token amount and eligibility rules
//! - `distribute_reward(user, amount)` executes correctly
//! - Batch distribution supports up to 50 recipients per call
//! - `RewardIssued` event emitted for each distribution
//! - Unauthorized callers rejected with descriptive error codes
#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, symbol_short, token, Address, Env, Symbol,
    Vec,
};

// ── Errors ────────────────────────────────────────────────────────────────────

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum DistributionError {
    /// Contract has already been initialized.
    AlreadyInitialized = 1,
    /// Caller is not the contract admin.
    Unauthorized = 2,
    /// Caller is not the registered merchant for this campaign.
    NotCampaignMerchant = 3,
    /// Campaign ID already exists.
    CampaignAlreadyExists = 4,
    /// Campaign ID does not exist.
    CampaignNotFound = 5,
    /// Campaign is not active.
    CampaignInactive = 6,
    /// Reward amount must be positive.
    InvalidAmount = 7,
    /// Batch size is zero or exceeds the 50-recipient limit.
    InvalidBatchSize = 8,
    /// `recipients` and `amounts` vectors have different lengths.
    BatchLengthMismatch = 9,
    /// Contract or campaign does not hold enough tokens.
    InsufficientBalance = 10,
    /// Contract has not been initialized.
    NotInitialized = 11,
    /// User has not met the campaign's minimum qualifying action count.
    Ineligible = 12,
}

// ── Storage keys ──────────────────────────────────────────────────────────────

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    TokenId,
    Campaign(u64),
    /// Qualifying action count for (campaign_id, user).
    UserActions(u64, Address),
}

/// Persistent storage TTL: ~31 days at 5 s/ledger.
const CAMPAIGN_TTL: u32 = 535_680;

// ── Types ─────────────────────────────────────────────────────────────────────

/// Eligibility rule: minimum qualifying action count a user must have reached.
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct EligibilityRule {
    /// Minimum number of qualifying actions required.
    pub min_actions: u32,
}

/// A merchant reward campaign.
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct Campaign {
    /// Merchant that owns this campaign.
    pub merchant: Address,
    /// Fixed token amount distributed per eligible user.
    pub reward_amount: i128,
    /// Eligibility rule applied before distribution.
    pub rule: EligibilityRule,
    /// Whether the campaign is currently accepting distributions.
    pub active: bool,
}

// ── Contract ──────────────────────────────────────────────────────────────────

#[contract]
pub struct DistributionContract;

#[contractimpl]
impl DistributionContract {
    // ── Init ──────────────────────────────────────────────────────────────────

    /// One-time setup. `token_id` is the Nova token contract address.
    pub fn initialize(
        env: Env,
        admin: Address,
        token_id: Address,
    ) -> Result<(), DistributionError> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(DistributionError::AlreadyInitialized);
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::TokenId, &token_id);
        Ok(())
    }

    // ── Campaign management ───────────────────────────────────────────────────

    /// Register a new reward campaign.
    ///
    /// Only the admin may register campaigns on behalf of merchants.
    ///
    /// # Parameters
    /// - `campaign_id` – Unique identifier for the campaign.
    /// - `merchant` – Address authorized to distribute rewards for this campaign.
    /// - `reward_amount` – Fixed token amount per eligible user (must be > 0).
    /// - `min_actions` – Minimum qualifying actions a user must have performed.
    pub fn register_campaign(
        env: Env,
        campaign_id: u64,
        merchant: Address,
        reward_amount: i128,
        min_actions: u32,
    ) -> Result<(), DistributionError> {
        Self::require_admin(&env)?;

        if env
            .storage()
            .persistent()
            .has(&DataKey::Campaign(campaign_id))
        {
            return Err(DistributionError::CampaignAlreadyExists);
        }
        if reward_amount <= 0 {
            return Err(DistributionError::InvalidAmount);
        }

        let campaign = Campaign {
            merchant,
            reward_amount,
            rule: EligibilityRule { min_actions },
            active: true,
        };
        let key = DataKey::Campaign(campaign_id);
        env.storage().persistent().set(&key, &campaign);
        env.storage()
            .persistent()
            .extend_ttl(&key, CAMPAIGN_TTL, CAMPAIGN_TTL);

        env.events().publish(
            (symbol_short!("campaign"), campaign_id),
            (campaign.reward_amount, campaign.rule.min_actions),
        );
        Ok(())
    }

    /// Deactivate a campaign. Only the admin may call this.
    pub fn deactivate_campaign(env: Env, campaign_id: u64) -> Result<(), DistributionError> {
        Self::require_admin(&env)?;
        let mut campaign = Self::load_campaign(&env, campaign_id)?;
        campaign.active = false;
        let key = DataKey::Campaign(campaign_id);
        env.storage().persistent().set(&key, &campaign);
        env.storage()
            .persistent()
            .extend_ttl(&key, CAMPAIGN_TTL, CAMPAIGN_TTL);
        Ok(())
    }

    // ── Eligibility ───────────────────────────────────────────────────────────

    /// Record a qualifying action for `user` in `campaign_id`.
    ///
    /// Admin-gated. Increments the user's action counter by 1.
    pub fn record_action(
        env: Env,
        campaign_id: u64,
        user: Address,
    ) -> Result<(), DistributionError> {
        Self::require_admin(&env)?;
        // Ensure campaign exists
        Self::load_campaign(&env, campaign_id)?;

        let key = DataKey::UserActions(campaign_id, user.clone());
        let count: u32 = env.storage().persistent().get(&key).unwrap_or(0);
        env.storage().persistent().set(&key, &(count + 1));
        env.storage()
            .persistent()
            .extend_ttl(&key, CAMPAIGN_TTL, CAMPAIGN_TTL);
        Ok(())
    }

    /// Returns the qualifying action count for `user` in `campaign_id`.
    pub fn get_user_actions(env: Env, campaign_id: u64, user: Address) -> u32 {
        env.storage()
            .persistent()
            .get(&DataKey::UserActions(campaign_id, user))
            .unwrap_or(0)
    }

    // ── Distribution ──────────────────────────────────────────────────────────

    /// Distribute a reward to a single user.
    ///
    /// The caller must be the merchant registered for `campaign_id`.
    /// `amount` must be > 0 and ≤ the campaign's `reward_amount`.
    /// The user must have met the campaign's `min_actions` eligibility rule.
    ///
    /// Emits a `RewardIssued` event on success.
    pub fn distribute_reward(
        env: Env,
        campaign_id: u64,
        user: Address,
        amount: i128,
    ) -> Result<(), DistributionError> {
        let campaign = Self::load_campaign(&env, campaign_id)?;
        campaign.merchant.require_auth();

        if !campaign.active {
            return Err(DistributionError::CampaignInactive);
        }
        if amount <= 0 || amount > campaign.reward_amount {
            return Err(DistributionError::InvalidAmount);
        }
        Self::check_eligibility(&env, campaign_id, &user, &campaign.rule)?;

        Self::do_transfer(&env, &user, amount)?;
        Self::emit_reward_issued(&env, campaign_id, &user, amount);
        Ok(())
    }

    /// Distribute rewards to up to 50 users in a single call.
    ///
    /// The caller must be the merchant registered for `campaign_id`.
    /// All amounts must be > 0 and ≤ the campaign's `reward_amount`.
    /// Every recipient must meet the campaign's `min_actions` eligibility rule.
    /// The entire batch is validated before any transfer executes.
    ///
    /// Emits a `RewardIssued` event per recipient.
    pub fn distribute_batch(
        env: Env,
        campaign_id: u64,
        recipients: Vec<Address>,
        amounts: Vec<i128>,
    ) -> Result<(), DistributionError> {
        let campaign = Self::load_campaign(&env, campaign_id)?;
        campaign.merchant.require_auth();

        if !campaign.active {
            return Err(DistributionError::CampaignInactive);
        }

        let n = recipients.len();
        if n == 0 || n > 50 {
            return Err(DistributionError::InvalidBatchSize);
        }
        if n != amounts.len() {
            return Err(DistributionError::BatchLengthMismatch);
        }

        // Pre-validate all amounts, eligibility, and compute total
        let mut total: i128 = 0;
        for i in 0..n {
            let amt = amounts.get(i).unwrap();
            if amt <= 0 || amt > campaign.reward_amount {
                return Err(DistributionError::InvalidAmount);
            }
            let recipient = recipients.get(i).unwrap();
            Self::check_eligibility(&env, campaign_id, &recipient, &campaign.rule)?;
            total = total.checked_add(amt).ok_or(DistributionError::InvalidAmount)?;
        }

        // Check contract balance covers the whole batch
        let tok = Self::token_client(&env)?;
        if tok.balance(&env.current_contract_address()) < total {
            return Err(DistributionError::InsufficientBalance);
        }

        // Execute transfers
        for i in 0..n {
            let recipient = recipients.get(i).unwrap();
            let amount = amounts.get(i).unwrap();
            Self::do_transfer(&env, &recipient, amount)?;
            Self::emit_reward_issued(&env, campaign_id, &recipient, amount);
        }
        Ok(())
    }

    // ── View ──────────────────────────────────────────────────────────────────

    /// Returns the campaign data for `campaign_id`.
    pub fn get_campaign_info(env: Env, campaign_id: u64) -> Result<Campaign, DistributionError> {
        Self::load_campaign(&env, campaign_id)
    }

    /// Returns the Nova token balance held by this contract.
    pub fn contract_balance(env: Env) -> Result<i128, DistributionError> {
        Ok(Self::token_client(&env)?.balance(&env.current_contract_address()))
    }

    // ── Internal helpers ──────────────────────────────────────────────────────

    fn require_admin(env: &Env) -> Result<Address, DistributionError> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(DistributionError::NotInitialized)?;
        admin.require_auth();
        Ok(admin)
    }

    fn token_client(env: &Env) -> Result<token::Client, DistributionError> {
        let id: Address = env
            .storage()
            .instance()
            .get(&DataKey::TokenId)
            .ok_or(DistributionError::NotInitialized)?;
        Ok(token::Client::new(env, &id))
    }

    fn load_campaign(env: &Env, campaign_id: u64) -> Result<Campaign, DistributionError> {
        let key = DataKey::Campaign(campaign_id);
        let campaign = env
            .storage()
            .persistent()
            .get(&key)
            .ok_or(DistributionError::CampaignNotFound)?;
        // Refresh TTL on read
        env.storage()
            .persistent()
            .extend_ttl(&key, CAMPAIGN_TTL, CAMPAIGN_TTL);
        Ok(campaign)
    }

    fn check_eligibility(
        env: &Env,
        campaign_id: u64,
        user: &Address,
        rule: &EligibilityRule,
    ) -> Result<(), DistributionError> {
        if rule.min_actions == 0 {
            return Ok(());
        }
        let actions: u32 = env
            .storage()
            .persistent()
            .get(&DataKey::UserActions(campaign_id, user.clone()))
            .unwrap_or(0);
        if actions < rule.min_actions {
            return Err(DistributionError::Ineligible);
        }
        Ok(())
    }

    fn do_transfer(env: &Env, to: &Address, amount: i128) -> Result<(), DistributionError> {
        let tok = Self::token_client(env)?;
        let contract_addr = env.current_contract_address();
        if tok.balance(&contract_addr) < amount {
            return Err(DistributionError::InsufficientBalance);
        }
        tok.transfer(&contract_addr, to, &amount);
        Ok(())
    }

    /// Emits `("RewardIssued", campaign_id)` with data `(user, amount)`.
    fn emit_reward_issued(env: &Env, campaign_id: u64, user: &Address, amount: i128) {
        env.events().publish(
            (Symbol::new(env, "RewardIssued"), campaign_id),
            (user.clone(), amount),
        );
    }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Env};

    mod mock_token {
        use soroban_sdk::{contract, contractimpl, contracttype, Address, Env};

        #[contracttype]
        pub enum Key {
            Balance(Address),
        }

        #[contract]
        pub struct MockToken;

        #[contractimpl]
        impl MockToken {
            pub fn mint(env: Env, to: Address, amount: i128) {
                let key = Key::Balance(to.clone());
                let bal: i128 = env.storage().instance().get(&key).unwrap_or(0);
                env.storage().instance().set(&key, &(bal + amount));
            }

            pub fn balance(env: Env, addr: Address) -> i128 {
                env.storage()
                    .instance()
                    .get(&Key::Balance(addr))
                    .unwrap_or(0)
            }

            pub fn transfer(env: Env, from: Address, to: Address, amount: i128) {
                let from_key = Key::Balance(from.clone());
                let to_key = Key::Balance(to.clone());
                let from_bal: i128 = env.storage().instance().get(&from_key).unwrap_or(0);
                assert!(from_bal >= amount, "insufficient balance");
                env.storage()
                    .instance()
                    .set(&from_key, &(from_bal - amount));
                let to_bal: i128 = env.storage().instance().get(&to_key).unwrap_or(0);
                env.storage().instance().set(&to_key, &(to_bal + amount));
            }
        }
    }

    fn setup() -> (
        Env,
        Address,
        DistributionContractClient<'static>,
        Address,
        Address,
    ) {
        let env = Env::default();
        env.mock_all_auths();

        let token_id = env.register(mock_token::MockToken, ());
        let contract_id = env.register(DistributionContract, ());
        let admin = Address::generate(&env);
        let merchant = Address::generate(&env);

        let client = DistributionContractClient::new(&env, &contract_id);
        client.initialize(&admin, &token_id).unwrap();

        // Fund the distribution contract
        let tok = mock_token::MockTokenClient::new(&env, &token_id);
        tok.mint(&contract_id, &100_000);

        (env, admin, client, token_id, merchant)
    }

    #[test]
    fn test_register_and_distribute_single() {
        let (env, _admin, client, token_id, merchant) = setup();
        let user = Address::generate(&env);

        // min_actions = 0 → no eligibility check
        client
            .register_campaign(&1, &merchant, &1_000, &0)
            .unwrap();
        client.distribute_reward(&1, &user, &500).unwrap();

        let tok = mock_token::MockTokenClient::new(&env, &token_id);
        assert_eq!(tok.balance(&user), 500);
    }

    #[test]
    fn test_eligibility_enforced() {
        let (env, _admin, client, token_id, merchant) = setup();
        let user = Address::generate(&env);

        // min_actions = 2
        client
            .register_campaign(&10, &merchant, &1_000, &2)
            .unwrap();

        // 0 actions → Ineligible
        let err = client
            .try_distribute_reward(&10, &user, &500)
            .unwrap_err()
            .unwrap();
        assert_eq!(err, DistributionError::Ineligible);

        // Record 1 action → still ineligible
        client.record_action(&10, &user).unwrap();
        let err = client
            .try_distribute_reward(&10, &user, &500)
            .unwrap_err()
            .unwrap();
        assert_eq!(err, DistributionError::Ineligible);

        // Record 2nd action → now eligible
        client.record_action(&10, &user).unwrap();
        client.distribute_reward(&10, &user, &500).unwrap();

        let tok = mock_token::MockTokenClient::new(&env, &token_id);
        assert_eq!(tok.balance(&user), 500);
    }

    #[test]
    fn test_batch_eligibility_enforced() {
        let (env, _admin, client, _token_id, merchant) = setup();
        let eligible = Address::generate(&env);
        let ineligible = Address::generate(&env);

        client
            .register_campaign(&11, &merchant, &100, &1)
            .unwrap();
        client.record_action(&11, &eligible).unwrap();

        let recipients = soroban_sdk::vec![&env, eligible.clone(), ineligible.clone()];
        let amounts = soroban_sdk::vec![&env, 100_i128, 100_i128];

        let err = client
            .try_distribute_batch(&11, &recipients, &amounts)
            .unwrap_err()
            .unwrap();
        assert_eq!(err, DistributionError::Ineligible);
    }

    #[test]
    fn test_distribute_batch_up_to_50() {
        let (env, _admin, client, token_id, merchant) = setup();

        client
            .register_campaign(&2, &merchant, &100, &0)
            .unwrap();

        let mut recipients = soroban_sdk::Vec::new(&env);
        let mut amounts = soroban_sdk::Vec::new(&env);
        for _ in 0..50 {
            recipients.push_back(Address::generate(&env));
            amounts.push_back(100_i128);
        }

        client.distribute_batch(&2, &recipients, &amounts).unwrap();

        let tok = mock_token::MockTokenClient::new(&env, &token_id);
        assert_eq!(tok.balance(&recipients.get(0).unwrap()), 100);
        assert_eq!(tok.balance(&recipients.get(49).unwrap()), 100);
    }

    #[test]
    fn test_batch_exceeds_50_rejected() {
        let (env, _admin, client, _token_id, merchant) = setup();
        client
            .register_campaign(&3, &merchant, &100, &0)
            .unwrap();

        let mut recipients = soroban_sdk::Vec::new(&env);
        let mut amounts = soroban_sdk::Vec::new(&env);
        for _ in 0..51 {
            recipients.push_back(Address::generate(&env));
            amounts.push_back(100_i128);
        }

        let err = client
            .try_distribute_batch(&3, &recipients, &amounts)
            .unwrap_err()
            .unwrap();
        assert_eq!(err, DistributionError::InvalidBatchSize);
    }

    #[test]
    fn test_campaign_not_found_rejected() {
        let (env, _admin, client, _token_id, _merchant) = setup();
        let user = Address::generate(&env);

        let err = client
            .try_distribute_reward(&99, &user, &100)
            .unwrap_err()
            .unwrap();
        assert_eq!(err, DistributionError::CampaignNotFound);
    }

    #[test]
    fn test_inactive_campaign_rejected() {
        let (env, _admin, client, _token_id, merchant) = setup();
        let user = Address::generate(&env);

        client
            .register_campaign(&5, &merchant, &500, &0)
            .unwrap();
        client.deactivate_campaign(&5).unwrap();

        let err = client
            .try_distribute_reward(&5, &user, &100)
            .unwrap_err()
            .unwrap();
        assert_eq!(err, DistributionError::CampaignInactive);
    }

    #[test]
    fn test_amount_exceeds_campaign_reward_rejected() {
        let (env, _admin, client, _token_id, merchant) = setup();
        let user = Address::generate(&env);

        client
            .register_campaign(&6, &merchant, &200, &0)
            .unwrap();

        let err = client
            .try_distribute_reward(&6, &user, &201)
            .unwrap_err()
            .unwrap();
        assert_eq!(err, DistributionError::InvalidAmount);
    }

    #[test]
    fn test_double_initialize_rejected() {
        let (env, admin, client, token_id, _merchant) = setup();
        let err = client
            .try_initialize(&admin, &token_id)
            .unwrap_err()
            .unwrap();
        assert_eq!(err, DistributionError::AlreadyInitialized);
    }

    #[test]
    fn test_batch_length_mismatch_rejected() {
        let (env, _admin, client, _token_id, merchant) = setup();
        client
            .register_campaign(&7, &merchant, &100, &0)
            .unwrap();

        let recipients = soroban_sdk::vec![&env, Address::generate(&env)];
        let amounts = soroban_sdk::vec![&env, 100_i128, 50_i128];

        let err = client
            .try_distribute_batch(&7, &recipients, &amounts)
            .unwrap_err()
            .unwrap();
        assert_eq!(err, DistributionError::BatchLengthMismatch);
    }
}
