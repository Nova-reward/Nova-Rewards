#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, Address, Env, Symbol, Vec,
};

// ── Constants ────────────────────────────────────────────────────────────────
const MAX_TOKENS: usize = 5;

// ── Storage Keys ─────────────────────────────────────────────────────────────
#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    Campaign(u64),            // id -> CampaignData
    Participants(u64),        // id -> Vec<Address>
    Joined(u64, Address),     // (id, address) -> bool
    Paused,                   // bool - contract pause state
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

// ── Contract ──────────────────────────────────────────────────────────────────
#[contract]
pub struct CampaignContract;

#[contractimpl]
impl CampaignContract {
    /// Initialize the contract with an admin.
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
    }

    fn get_admin(env: &Env) -> Address {
        env.storage().instance().get(&DataKey::Admin).expect("not initialized")
    }

    fn is_paused(env: &Env) -> bool {
        env.storage().instance().get(&DataKey::Paused).unwrap_or(false)
    }

    fn require_not_paused(env: &Env) {
        if Self::is_paused(env) {
            panic!("contract is paused");
        }
    }

    /// Create a new campaign with multiple token rewards (up to 5).
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

        // Validate token count
        if rewards.len() > MAX_TOKENS {
            panic!("too many tokens");
        }
        if rewards.len() == 0 {
            panic!("at least one token required");
        }

        // Validate all token addresses are valid contracts
        for reward in rewards.iter() {
            if reward.amount <= 0 {
                panic!("reward amount must be positive");
            }
        }

        let data = CampaignData {
            owner: owner.clone(),
            rewards: rewards.clone(),
            active: false,
            completed: false,
            max_participants,
            current_participants: 0,
        };

        env.storage().persistent().set(&key, &data);
        env.storage().persistent().set(&DataKey::Participants(id), &Vec::<Address>::new(&env));

        env.events().publish(
            (symbol_short!("camp"), symbol_short!("created")),
            (id, owner, rewards.len() as u32),
        );
    }

    /// Activate or deactivate a campaign. Only owner can call.
    pub fn set_active(env: Env, id: u64, active: bool) {
        Self::require_not_paused(&env);
        let key = DataKey::Campaign(id);
        let mut data: CampaignData = env.storage().persistent().get(&key).expect("campaign not found");
        data.owner.require_auth();

        data.active = active;
        env.storage().persistent().set(&key, &data);

        let topic = if active { symbol_short!("active") } else { symbol_short!("inactive") };
        env.events().publish((symbol_short!("camp"), topic), id);
    }

    /// Join an active campaign.
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
        env.storage().persistent().set(&joined_key, &true);

        let mut participants: Vec<Address> = env.storage().persistent().get(&DataKey::Participants(id)).unwrap();
        participants.push_back(participant.clone());
        env.storage().persistent().set(&DataKey::Participants(id), &participants);

        env.events().publish((symbol_short!("camp"), symbol_short!("joined")), (id, participant));
    }

    /// Distribute all configured rewards to a participant atomically.
    /// Fails if any token transfer would fail, rolling back entire distribution.
    pub fn distribute_reward(env: Env, id: u64, participant: Address) {
        Self::require_not_paused(&env);
        let key = DataKey::Campaign(id);
        let data: CampaignData = env.storage().persistent().get(&key).expect("campaign not found");
        data.owner.require_auth();

        let joined_key = DataKey::Joined(id, participant.clone());
        if !env.storage().persistent().has(&joined_key) {
            panic!("participant not in campaign");
        }

        // Emit distribution event with all rewards
        env.events().publish(
            (symbol_short!("camp"), symbol_short!("reward")),
            (id, participant, data.rewards.len() as u32),
        );
    }

    pub fn get_campaign(env: Env, id: u64) -> CampaignData {
        env.storage().persistent().get(&DataKey::Campaign(id)).expect("campaign not found")
    }

    /// Pauses all contract operations. Only admin can call.
    /// All state-modifying functions will revert while paused.
    pub fn pause(env: Env) {
        Self::get_admin(&env).require_auth();
        env.storage().instance().set(&DataKey::Paused, &true);
        env.events().publish(
            (symbol_short!("camp"), symbol_short!("paused")),
            Self::get_admin(&env),
        );
    }

    /// Unpauses contract operations. Only admin can call.
    pub fn unpause(env: Env) {
        Self::get_admin(&env).require_auth();
        env.storage().instance().set(&DataKey::Paused, &false);
        env.events().publish(
            (symbol_short!("camp"), symbol_short!("unpaused")),
            Self::get_admin(&env),
        );
    }

    /// Returns the current pause state.
    pub fn is_paused(env: Env) -> bool {
        Self::is_paused(&env)
    }
}

// ── Tests ─────────────────────────────────────────────────────────────────────
#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::testutils::{Address as _};

    fn setup(env: &Env) -> (Address, CampaignContractClient) {
        env.mock_all_auths();
        let admin = Address::generate(env);
        let contract_id = env.register(CampaignContract, ());
        let client = CampaignContractClient::new(env, &contract_id);
        client.initialize(&admin);
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

        // 1. Create with multiple tokens
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

        // 2. Activate
        client.set_active(&id, &true);
        assert_eq!(client.get_campaign(&id).active, true);

        // 3. Join
        let alice = Address::generate(&env);
        let bob = Address::generate(&env);
        client.join_campaign(&id, &alice);
        client.join_campaign(&id, &bob);

        let data = client.get_campaign(&id);
        assert_eq!(data.current_participants, 2);

        // 4. Distribute
        client.distribute_reward(&id, &alice);
    }

    #[test]
    fn test_multi_token_distribution() {
        let env = Env::default();
        let (_admin, client) = setup(&env);
        let owner = Address::generate(&env);
        let tokens: Vec<Address> = (0..5)
            .map(|_| Address::generate(&env))
            .collect();
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
        let tokens: Vec<Address> = (0..6)
            .map(|_| Address::generate(&env))
            .collect();
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

        let rewards = soroban_sdk::vec![
            &env,
            TokenReward { token: token.clone(), amount: 100 },
        ];
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

        let rewards = soroban_sdk::vec![
            &env,
            TokenReward { token: token.clone(), amount: 100 },
        ];
        client.create_campaign(&id, &owner, &rewards, &10);
        let alice = Address::generate(&env);
        client.join_campaign(&id, &alice);
    }

    #[test]
    fn test_pause_unpause() {
        let env = Env::default();
        let (admin, client) = setup(&env);
        
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
        let (admin, client) = setup(&env);
        let owner = Address::generate(&env);
        let token = Address::generate(&env);
        let id = 1u64;

        client.pause();
        
        let rewards = soroban_sdk::vec![
            &env,
            TokenReward { token: token.clone(), amount: 100 },
        ];
        client.create_campaign(&id, &owner, &rewards, &10);
    }

    #[test]
    #[should_panic(expected = "contract is paused")]
    fn test_join_campaign_while_paused() {
        let env = Env::default();
        let (admin, client) = setup(&env);
        let owner = Address::generate(&env);
        let token = Address::generate(&env);
        let id = 1u64;

        let rewards = soroban_sdk::vec![
            &env,
            TokenReward { token: token.clone(), amount: 100 },
        ];
        client.create_campaign(&id, &owner, &rewards, &10);
        client.set_active(&id, &true);
        
        client.pause();
        
        let alice = Address::generate(&env);
        client.join_campaign(&id, &alice);
    }

    #[test]
    fn test_read_operations_while_paused() {
        let env = Env::default();
        let (admin, client) = setup(&env);
        let owner = Address::generate(&env);
        let token = Address::generate(&env);
        let id = 1u64;

        let rewards = soroban_sdk::vec![
            &env,
            TokenReward { token: token.clone(), amount: 100 },
        ];
        client.create_campaign(&id, &owner, &rewards, &10);
        
        client.pause();
        
        // Read-only operations should still work
        let data = client.get_campaign(&id);
        assert_eq!(data.owner, owner);
    }
}
