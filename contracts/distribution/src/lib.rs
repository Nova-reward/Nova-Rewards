//! # Distribution Contract
//!
//! Merchant-controlled reward distribution with campaign registration,
//! batch support (up to 50 recipients), and per-distribution events.
//!
//! ## Features
//! - Single and batch token distribution (up to 50 recipients per call)
//! - Fixed-point reward calculation via [`calculate_reward`](DistributionContract::calculate_reward)
//! - 30-day clawback window per distribution
//! - M-of-N multisig upgrade mechanism
//!
//! ## Event Schema (v1)
//! All events include a `schema_version` field as the first data element.
//!
//! | topics                          | data                                                    |
//! |---------------------------------|---------------------------------------------------------|
//! | `("dist", "distributed")`       | `(v, recipient, amount, deadline)`                      |
//! | `("dist", "batch_dist")`        | `(v, count, total_amount)`                              |
//! | `("dist", "clawback")`          | `(v, recipient, amount)`                                |
//! | `("dist", "upgraded")`          | `(v, new_wasm_hash)`                                    |
#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, token, Address, BytesN, Env, Vec,
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
    /// Tracks clawback eligibility window end (ledger timestamp) per recipient
    ClawbackDeadline(Address),
    /// Amount originally distributed to a recipient (for clawback)
    Distributed(Address),
    /// Multisig signers for upgrade authorization
    Signers,
    /// Minimum approvals required for upgrade
    Threshold,
    /// Pending upgrade approvals: wasm_hash -> Vec<Address>
    UpgradeApprovals(BytesN<32>),
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

/// Schema version for all events emitted by this contract.
pub const EVENT_SCHEMA_VERSION: u32 = 1;

// ── Event helpers ─────────────────────────────────────────────────────────────

fn emit_distributed(env: &Env, recipient: &Address, amount: i128, deadline: u64) {
    env.events().publish(
        (symbol_short!("dist"), symbol_short!("distributed")),
        (EVENT_SCHEMA_VERSION, recipient.clone(), amount, deadline),
    );
}

fn emit_batch_distributed(env: &Env, count: u32, total_amount: i128) {
    env.events().publish(
        (symbol_short!("dist"), symbol_short!("batch_dist")),
        (EVENT_SCHEMA_VERSION, count, total_amount),
    );
}

fn emit_clawback(env: &Env, recipient: &Address, amount: i128) {
    env.events().publish(
        (symbol_short!("dist"), symbol_short!("clawback")),
        (EVENT_SCHEMA_VERSION, recipient.clone(), amount),
    );
}

fn emit_contract_upgraded(env: &Env, new_wasm_hash: &BytesN<32>) {
    env.events().publish(
        (symbol_short!("dist"), symbol_short!("upgraded")),
        (EVENT_SCHEMA_VERSION, new_wasm_hash.clone()),
    );
}

// ── Contract ──────────────────────────────────────────────────────────────────

#[contract]
pub struct DistributionContract;

#[contractimpl]
impl DistributionContract {
    // ── Init ──────────────────────────────────────────────────────────────────

    /// One-time setup. `token_id` is the Nova token contract address.
    ///
    /// # Parameters
    /// - `admin` – Address authorized to call distribution and clawback functions.
    /// - `token_id` – Address of the Nova token contract used for transfers.
    /// - `signers` – Multisig signer set for upgrade authorization.
    /// - `threshold` – Minimum approvals required to execute an upgrade.
    ///
    /// # Panics
    /// - `"already initialized"` if called more than once.
    pub fn initialize(
        env: Env,
        admin: Address,
        token_id: Address,
        signers: Vec<Address>,
        threshold: u32,
    ) {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(DistributionError::AlreadyInitialized);
        }
        assert!(threshold >= 1, "threshold must be at least 1");
        assert!(
            signers.len() >= threshold,
            "signers count must be >= threshold"
        );
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::TokenId, &token_id);
        env.storage().instance().set(&DataKey::Signers, &signers);
        env.storage().instance().set(&DataKey::Threshold, &threshold);
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
    /// Calculate the reward for a given `base_amount` and `rate_bps`
    /// (rate in basis points, 10 000 = 100 %).
    pub fn calculate_reward(base_amount: i128, rate_bps: i128) -> i128 {
        assert!(base_amount >= 0, "base_amount must be non-negative");
        assert!(
            rate_bps >= 0 && rate_bps <= 10_000,
            "rate_bps must be 0–10 000"
        );
        base_amount
            .checked_mul(rate_bps)
            .expect("overflow in base_amount * rate_bps")
            .checked_div(10_000)
            .expect("division error")
    }

    // ── Single distribution ───────────────────────────────────────────────────

    /// Distribute `amount` tokens to `recipient`.
    ///
    /// # Events
    /// Emits `("dist", "distributed")` with `(schema_version, recipient, amount, deadline)`.
    pub fn distribute(env: Env, recipient: Address, amount: i128) {
        Self::require_admin(&env);
        Self::_distribute(&env, &recipient, amount);
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
        let tok = Self::token(env);
        let contract_addr = env.current_contract_address();

        let bal = tok.balance(&contract_addr);
        assert!(bal >= amount, "insufficient contract balance");

        tok.transfer(&contract_addr, recipient, &amount);

        let deadline = env.ledger().timestamp() + CLAWBACK_WINDOW;
        env.storage()
            .persistent()
            .extend_ttl(&key, CAMPAIGN_TTL, CAMPAIGN_TTL);
        Ok(())
    }

    /// Returns the qualifying action count for `user` in `campaign_id`.
    pub fn get_user_actions(env: Env, campaign_id: u64, user: Address) -> u32 {
        env.storage()
            .persistent()
            .set(&DataKey::Distributed(recipient.clone()), &amount);

        emit_distributed(env, recipient, amount, deadline);
    }

    // ── Distribution ──────────────────────────────────────────────────────────

    /// Distribute a reward to a single user.
    ///
    /// # Events
    /// Emits one `("dist", "distributed")` event per entry, plus a
    /// `("dist", "batch_dist")` summary event with total count and amount.
    pub fn distribute_batch(env: Env, recipients: Vec<Address>, amounts: Vec<i128>) {
        Self::require_admin(&env);

        let n = recipients.len();
        if n == 0 || n > 50 {
            return Err(DistributionError::InvalidBatchSize);
        }
        if n != amounts.len() {
            return Err(DistributionError::BatchLengthMismatch);
        }

        let tok = Self::token(&env);
        let contract_addr = env.current_contract_address();
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

        for i in 0..n {
            let recipient = recipients.get(i).unwrap();
            let amount = amounts.get(i).unwrap();
            Self::do_transfer(&env, &recipient, amount)?;
            Self::emit_reward_issued(&env, campaign_id, &recipient, amount);
        }

        emit_batch_distributed(&env, n, total);
    }

    // ── View ──────────────────────────────────────────────────────────────────

    /// Reclaim tokens from `recipient` back to the contract.
    ///
    /// # Events
    /// Emits `("dist", "clawback")` with `(schema_version, recipient, amount)`.
    pub fn clawback(env: Env, recipient: Address) {
        Self::require_admin(&env);

        let deadline: u64 = env
            .storage()
            .persistent()
            .get(&DataKey::ClawbackDeadline(recipient.clone()))
            .expect("no clawback record for recipient");

    /// Returns the Nova token balance held by this contract.
    pub fn contract_balance(env: Env) -> Result<i128, DistributionError> {
        Ok(Self::token_client(&env)?.balance(&env.current_contract_address()))
    }

    // ── Internal helpers ──────────────────────────────────────────────────────

    fn require_admin(env: &Env) -> Result<Address, DistributionError> {
        let admin: Address = env
            .storage()
            .persistent()
            .get(&DataKey::Distributed(recipient.clone()))
            .expect("no distribution record");

        assert!(amount > 0, "nothing to clawback");

        let tok = Self::token(&env);
        tok.transfer_from(
            &env.current_contract_address(),
            &recipient,
            &env.current_contract_address(),
            &amount,
        );

        env.storage()
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
            .remove(&DataKey::Distributed(recipient.clone()));

        emit_clawback(&env, &recipient, amount);
    }

    // ── View helpers ──────────────────────────────────────────────────────────

    pub fn get_distributed(env: Env, recipient: Address) -> i128 {
        env.storage()
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
    pub fn get_clawback_deadline(env: Env, recipient: Address) -> u64 {
        env.storage()
            .persistent()
            .get(&DataKey::ClawbackDeadline(recipient))
            .unwrap_or(0)
    }

    pub fn contract_balance(env: Env) -> i128 {
        Self::token(&env).balance(&env.current_contract_address())
    }

    // ── Upgrade (M-of-N multisig) ─────────────────────────────────────────────

    /// Approve a pending WASM upgrade. Executes when threshold is reached.
    ///
    /// # Events
    /// Emits `("dist", "upgraded")` with `(schema_version, new_wasm_hash)` when threshold is met.
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
    use soroban_sdk::{
        testutils::{Address as _, Ledger},
        vec, BytesN, Env,
    };

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
        client.initialize(&admin, &token_id, &vec![&env, admin.clone()], &1);

        let tok = mock_token::MockTokenClient::new(&env, &token_id);
        tok.mint(&contract_id, &100_000);

        (env, admin, client, token_id)
    }

    #[test]
    fn test_calculate_reward() {
        assert_eq!(DistributionContract::calculate_reward(1_000, 500), 50);
        assert_eq!(DistributionContract::calculate_reward(1_000, 10_000), 1_000);
        assert_eq!(DistributionContract::calculate_reward(1_000, 0), 0);
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
        env.ledger().with_mut(|l| {
            l.timestamp += CLAWBACK_WINDOW + 1;
        });

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

    // ── Upgrade tests ─────────────────────────────────────────────────────────

    #[test]
    fn test_upgrade_approval_accumulates() {
        let env = Env::default();
        env.mock_all_auths();
        let token_id = env.register(mock_token::MockToken, ());
        let contract_id = env.register(DistributionContract, ());
        let s1 = Address::generate(&env);
        let s2 = Address::generate(&env);
        let client = DistributionContractClient::new(&env, &contract_id);
        client.initialize(&s1, &token_id, &vec![&env, s1.clone(), s2.clone()], &2);

        let fake_hash = BytesN::from_array(&env, &[0u8; 32]);
        client.approve_upgrade(&s1, &fake_hash);
        assert_eq!(client.get_upgrade_approvals(&fake_hash), 1);
    }

    #[test]
    #[should_panic(expected = "not an authorized signer")]
    fn test_unauthorized_upgrade_rejected() {
        let (env, _admin, client, _) = setup();
        let outsider = Address::generate(&env);
        let fake_hash = BytesN::from_array(&env, &[1u8; 32]);
        client.approve_upgrade(&outsider, &fake_hash);
    }

    #[test]
    #[should_panic(expected = "already approved")]
    fn test_duplicate_approval_rejected() {
        let env = Env::default();
        env.mock_all_auths();
        let token_id = env.register(mock_token::MockToken, ());
        let contract_id = env.register(DistributionContract, ());
        let s1 = Address::generate(&env);
        let s2 = Address::generate(&env);
        let client = DistributionContractClient::new(&env, &contract_id);
        client.initialize(&s1, &token_id, &vec![&env, s1.clone(), s2.clone()], &2);

        let fake_hash = BytesN::from_array(&env, &[2u8; 32]);
        client.approve_upgrade(&s1, &fake_hash);
        client.approve_upgrade(&s1, &fake_hash); // should panic
    }
}
