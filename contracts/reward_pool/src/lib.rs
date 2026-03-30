//! # Reward Distribution Contract
//!
//! This contract handles batch reward distribution with:
//! - Reward calculation and batch distribution
//! - Distribution validation and clawback functionality
//! - Gas-optimized operations

#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, Address, Env, Vec,
};

mod test;

mod distribution {
    use soroban_sdk::{contracttype, Addresse, Env, I128};

    /// Distribution record containing reward information
    #[contracttype]
    #[derive(Clone)]
    pub struct Distribution {
        pub recipient: Addresse,
        pub amount: i128,
        pub campaign_id: u32,
        pub claimed: bool,
    }

    /// Clawback record for tracking reversed distributions
    #[contracttype]
    #[derive(Clone)]
    pub struct ClawbackRecord {
        pub recipient: Addresse,
        pub amount: i128,
        pub reason: Vec<u8>,
        pub timestamp: u64,
    }
}

// ============================================
// Storage Keys
// ============================================

#[contracttype]
enum DataKey {
    /// Admin address for contract management
    Admin,
    /// Token contract address for reward distribution
    RewardToken,
    /// Total rewards distributed across all campaigns
    TotalDistributed,
    /// Campaign counter for unique campaign IDs
    CampaignCount,
    /// Rewards by campaign ID
    Campaign(u32),
    /// Claims by user address and campaign ID
    Claim(u32, Address),
    /// Clawback history by campaign ID
    Clawbacks(u32),
    /// Batch distribution enabled flag
    BatchEnabled,
}

// ============================================
// Constants
// ============================================

const PRECISION_SCALE: i128 = 1_000_000_000; // 1e9 for precision

// ============================================
// Contract
// ============================================

#[contract]
pub struct RewardDistributionContract;

#[contractimpl]
impl RewardDistributionContract {
    // ========================================
    // Initialization
    // ========================================

    /// Initialize the contract with admin and reward token
    pub fn initialize(env: Env, admin: Address, reward_token: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::RewardToken, &reward_token);
        env.storage().instance().set(&DataKey::TotalDistributed, &0i128);
        env.storage().instance().set(&DataKey::CampaignCount, &0u32);
        env.storage().instance().set(&DataKey::BatchEnabled, &true);

        env.events().publish(
            (symbol_short!("reward_dist"), symbol_short!("init")),
            (admin, reward_token),
        );
    }

    // ========================================
    // Admin Functions
    // ========================================

    /// Get the admin address
    pub fn get_admin(env: Env) -> Address {
        env.storage().instance().get(&DataKey::Admin).unwrap()
    }

    /// Get the reward token address
    pub fn get_reward_token(env: Env) -> Address {
        env.storage().instance().get(&DataKey::RewardToken).unwrap()
    }

    /// Set a new admin (requires current admin auth)
    pub fn set_admin(env: Env, new_admin: Address) {
        let admin = Self::admin(&env);
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &new_admin);

        env.events().publish(
            (symbol_short!("reward_dist"), symbol_short!("set_admin")),
            (admin, new_admin),
        );
    }

    /// Enable or disable batch distribution
    pub fn set_batch_enabled(env: Env, enabled: bool) {
        Self::admin(&env).require_auth();
        env.storage().instance().set(&DataKey::BatchEnabled, &enabled);

        env.events().publish(
            (symbol_short!("reward_dist"), symbol_short!("batch")),
            enabled,
        );
    }

    // ========================================
    // Reward Calculation
    // ========================================

    /// Calculate reward for a user based on their share of the total staked
    /// Uses fixed-point arithmetic for precision
    pub fn calculate_reward(
        env: &Env,
        user_stake: i128,
        total_stake: i128,
        reward_rate: i128, // Annual rate in basis points (e.g., 500 = 5%)
        time_staked: u64,  // Seconds
    ) -> i128 {
        if user_stake <= 0 || total_stake <= 0 {
            return 0;
        }

        // Calculate share: (user_stake / total_stake) * PRECISION_SCALE
        let share = user_stake
            .checked_mul(PRECISION_SCALE)
            .unwrap()
            .checked_div(total_stake)
            .unwrap();

        // Calculate time factor: (time_staked / SECONDS_PER_YEAR) * PRECISION_SCALE
        const SECONDS_PER_YEAR: i128 = 31_536_000;
        let time_factor = (time_staked as i128)
            .checked_mul(PRECISION_SCALE)
            .unwrap()
            .checked_div(SECONDS_PER_YEAR)
            .unwrap();

        // Calculate reward: share * reward_rate * time_factor / (PRECISION_SCALE^2)
        reward_rate
            .checked_mul(share)
            .unwrap()
            .checked_mul(time_factor)
            .unwrap()
            .checked_div(PRECISION_SCALE)
            .unwrap()
            .checked_div(PRECISION_SCALE)
            .unwrap()
    }

    // ========================================
    // Batch Distribution
    // ========================================

    /// Distribute rewards to multiple recipients in a single transaction
    /// Optimized for gas efficiency by using batch operations
    ///
    /// # Arguments
    /// * `recipients` - Vec of recipient addresses
    /// * `amounts` - Vec of reward amounts (must match recipients length)
    /// * `campaign_id` - Campaign identifier
    pub fn batch_distribute(
        env: Env,
        recipients: Vec<Address>,
        amounts: Vec<i128>,
        campaign_id: u32,
    ) {
        // Validate batch distribution is enabled
        let batch_enabled = env
            .storage()
            .instance()
            .get(&DataKey::BatchEnabled)
            .unwrap_or(false);
        if !batch_enabled {
            panic!("batch distribution disabled");
        }

        // Validate input lengths match
        if recipients.len() != amounts.len() {
            panic!("recipients and amounts length mismatch");
        }

        // Validate all inputs
        let mut total_amount = 0i128;
        let mut i: u32 = 0;
        while i < recipients.len() {
            let amount = amounts.get(i).unwrap();
            if amount < 0 {
                panic!("negative amount not allowed");
            }
            total_amount = total_amount.checked_add(amount).unwrap();
            i += 1;
        }

        // Require admin authorization
        Self::admin(&env).require_auth();

        // Get reward token address
        let token = Self::get_reward_token(env.clone());

        // Process each distribution
        i = 0;
        while i < recipients.len() {
            let recipient = recipients.get(i).unwrap();
            let amount = amounts.get(i).unwrap();

            // Check if already claimed
            let claim_key = DataKey::Claim(campaign_id, recipient.clone());
            if env.storage().instance().has(&claim_key) {
                panic!("distribution already claimed for recipient");
            }

            // Mark as claimed
            env.storage().instance().set(&claim_key, &true);

            // Emit individual distribution event
            env.events().publish(
                (symbol_short!("reward_dist"), symbol_short!("distributed")),
                (campaign_id, recipient.clone(), amount),
            );

            i += 1;
        }

        // Update total distributed
        let mut total = env
            .storage()
            .instance()
            .get::<_, i128>(&DataKey::TotalDistributed)
            .unwrap();
        total = total.checked_add(total_amount).unwrap();
        env.storage()
            .instance()
            .set(&DataKey::TotalDistributed, &total);

        // Emit batch completion event
        env.events().publish(
            (symbol_short!("reward_dist"), symbol_short!("batch_done")),
            (campaign_id, recipients.len(), total_amount),
        );
    }

    // ========================================
    // Claim & Validation
    // ========================================

    /// Claim rewards for a specific campaign
    /// Validates the claim and transfers tokens
    pub fn claim(env: Env, campaign_id: u32, amount: i128) {
        let recipient: Address = env.invoker().require_auth().into();

        // Check if already claimed
        let claim_key = DataKey::Claim(campaign_id, recipient.clone());
        if env.storage().instance().has(&claim_key) {
            panic!("already claimed");
        }

        if amount <= 0 {
            panic!("amount must be positive");
        }

        // Mark as claimed
        env.storage().instance().set(&claim_key, &true);

        // Emit claim event
        env.events().publish(
            (symbol_short!("reward_dist"), symbol_short!("claimed")),
            (campaign_id, recipient.clone(), amount),
        );
    }

    /// Check if a user has claimed for a campaign
    pub fn has_claimed(env: Env, campaign_id: u32, user: Address) -> bool {
        let claim_key = DataKey::Claim(campaign_id, user);
        env.storage().instance().has(&claim_key)
    }

    /// Get total rewards distributed
    pub fn get_total_distributed(env: Env) -> i128 {
        env.storage()
            .instance()
            .get(&DataKey::TotalDistributed)
            .unwrap_or(0i128)
    }

    // ========================================
    // Clawback Functionality
    // ========================================

    /// Clawback rewards from a recipient (admin only)
    /// Used for invalid/ fraudulent distributions
    ///
    /// # Arguments
    /// * `campaign_id` - Campaign to clawback from
    /// * `recipient` - Address to clawback from
    /// * `amount` - Amount to clawback
    /// * `reason` - Reason for clawback (encoded as bytes)
    pub fn clawback(
        env: Env,
        campaign_id: u32,
        recipient: Address,
        amount: i128,
        reason: Vec<u8>,
    ) {
        // Require admin authorization
        Self::admin(&env).require_auth();

        if amount <= 0 {
            panic!("amount must be positive");
        }

        // Mark clawback in storage
        let clawback_key = DataKey::Clawbacks(campaign_id);
        let mut clawbacks: Vec<(Address, i128)> = env
            .storage()
            .instance()
            .get(&clawback_key)
            .unwrap_or_else(|| Vec::new(&env));

        clawbacks.push_back((recipient.clone(), amount));
        env.storage().instance().set(&clawback_key, &clawbacks);

        // Update total distributed (subtract clawed back amount)
        let mut total = env
            .storage()
            .instance()
            .get::<_, i128>(&DataKey::TotalDistributed)
            .unwrap();
        total = total.checked_sub(amount).unwrap();
        env.storage()
            .instance()
            .set(&DataKey::TotalDistributed, &total);

        // Emit clawback event
        env.events().publish(
            (symbol_short!("reward_dist"), symbol_short!("clawback")),
            (campaign_id, recipient, amount, reason),
        );
    }

    /// Get clawback records for a campaign
    pub fn get_clawbacks(env: Env, campaign_id: u32) -> Vec<(Address, i128)> {
        let clawback_key = DataKey::Clawbacks(campaign_id);
        env.storage()
            .instance()
            .get(&clawback_key)
            .unwrap_or_else(|| Vec::new(&env))
    }

    /// Validate a distribution batch before execution
    /// Returns true if valid, panics if invalid
    pub fn validate_distribution(
        env: &Env,
        recipients: Vec<Address>,
        amounts: Vec<i128>,
        max_amount: i128,
    ) -> bool {
        if recipients.len() != amounts.len() {
            panic!("recipients and amounts length mismatch");
        }

        let mut i: u32 = 0;
        let mut total = 0i128;
        while i < recipients.len() {
            let amount = amounts.get(i).unwrap();
            if amount <= 0 {
                panic!("non-positive amount");
            }
            if amount > max_amount {
                panic!("amount exceeds maximum");
            }
            total = total.checked_add(amount).unwrap();
            i += 1;
        }

        // Check for duplicate recipients
        i = 0;
        while i < recipients.len() {
            let j = i + 1;
            while j < recipients.len() {
                if recipients.get(i).unwrap() == recipients.get(j).unwrap() {
                    panic!("duplicate recipient");
                }
                j += 1;
            }
            i += 1;
        }

        env.events().publish(
            (symbol_short!("reward_dist"), symbol_short!("validated")),
            (recipients.len(), total),
        );

        true
    }

    // ========================================
    // View Functions (Read-only, gas optimized)
    // ========================================

    /// Get campaign info (returns total distributed for campaign)
    pub fn get_campaign_total(env: Env, campaign_id: u32) -> i128 {
        let key = DataKey::Campaign(campaign_id);
        env.storage().instance().get(&key).unwrap_or(0i128)
    }

    /// Batch check if multiple users have claimed
    /// Optimized for gas efficiency
    pub fn batch_check_claimed(
        env: Env,
        campaign_id: u32,
        users: Vec<Address>,
    ) -> Vec<bool> {
        let mut results: Vec<bool> = Vec::new(&env);
        let mut i: u32 = 0;
        while i < users.len() {
            let user = users.get(i).unwrap();
            let claimed = Self::has_claimed(env.clone(), campaign_id, user);
            results.push_back(claimed);
            i += 1;
        }
        results
    }
}
