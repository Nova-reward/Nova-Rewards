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

// ── Structs ──────────────────────────────────────────────────────────────────
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct TokenReward {
    pub token: Address,
    pub amount: i128,
}

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct CampaignData {
    pub owner: Address,
    pub rewards: Vec<TokenReward>,
    pub active: bool,
    pub completed: bool,
    pub max_participants: u32,
    pub current_participants: u32,
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
    /// Initialize the contract with an admin and upgrade multisig config.
    ///
    /// # Parameters
    /// - `admin` – Admin address for pause/unpause operations.
    /// - `signers` – Multisig signer set for upgrade authorization.
    /// - `threshold` – Minimum approvals required to execute an upgrade.
    pub fn initialize(env: Env, admin: Address, signers: Vec<Address>, threshold: u32) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
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

    fn get_admin(env: &Env) -> Address {
        env.storage().instance().get(&DataKey::Admin).expect("not initialized")
    }

    fn is_paused_internal(env: &Env) -> bool {
        env.storage().instance().get(&DataKey::Paused).unwrap_or(false)
    }

    fn require_not_paused(env: &Env) {
        if Self::is_paused_internal(env) {
            panic!("contract is paused");
        }
    }

    /// Create a new campaign with multiple token rewards (up to 5).
    ///
    /// # Events
    /// Emits `("camp", "created")` with `(schema_version, id, owner, reward_count, max_participants)`.
    pub fn create_campaign(
        env: Env,
        id: u64,
        owner: Address,
        rewards: Vec<TokenReward>,
        max_participants: u32,
    ) {
        Self::require_not_paused(&env);
        owner.require_auth();
        let key = DataKey::Campaign(id);
        if env.storage().persistent().has(&key) {
            panic!("campaign already exists");
        }

        if rewards.len() > MAX_TOKENS {
            panic!("too many tokens");
        }
        if rewards.len() == 0 {
            panic!("at least one token required");
        }

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

        env.storage().persistent().set(&key, &data);
        env.storage().persistent().set(&DataKey::Participants(id), &Vec::<Address>::new(&env));

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

        if !data.active {
            panic!("campaign is not active");
        }
        if data.completed {
            panic!("campaign is already completed");
        }
        if data.current_participants >= data.max_participants {
            panic!("campaign is full");
        }

        let joined_key = DataKey::Joined(id, participant.clone());
        if env.storage().persistent().has(&joined_key) {
            panic!("already joined");
        }

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
    use soroban_sdk::testutils::Address as _;

    fn setup(env: &Env) -> (Address, CampaignContractClient) {
        env.mock_all_auths();
        let admin = Address::generate(env);
        let contract_id = env.register(CampaignContract, ());
        let client = CampaignContractClient::new(env, &contract_id);
        client.initialize(&admin, &soroban_sdk::vec![env, admin.clone()], &1);
        (admin, client)
    }

    #[test]
    fn test_campaign_lifecycle() {
        let env = Env::default();
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

        let data = client.get_campaign(&id);
        assert_eq!(data.current_participants, 2);

        client.distribute_reward(&id, &alice);
    }

    #[test]
    fn test_multi_token_distribution() {
        let env = Env::default();
        let (_admin, client) = setup(&env);
        let owner = Address::generate(&env);
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
        let token = Address::generate(&env);
        let id = 1u64;

        let rewards = soroban_sdk::vec![&env, TokenReward { token: token.clone(), amount: 100 }];
        client.create_campaign(&id, &owner, &rewards, &1);
        client.set_active(&id, &true);

        let alice = Address::generate(&env);
        let bob = Address::generate(&env);
        client.join_campaign(&id, &alice);
        client.join_campaign(&id, &bob);
    }

    #[test]
    #[should_panic(expected = "campaign is not active")]
    fn test_join_inactive() {
        let env = Env::default();
        let (_admin, client) = setup(&env);
        let owner = Address::generate(&env);
        let token = Address::generate(&env);
        let id = 1u64;

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
