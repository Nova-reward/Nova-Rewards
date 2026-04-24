#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, Address, Env, Symbol, Vec,
};

// ── Storage Keys ─────────────────────────────────────────────────────────────
#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    Campaign(u64),            // id -> CampaignData
    Participants(u64),        // id -> Vec<Address>
    Joined(u64, Address),     // (id, address) -> bool
}

// ── Structs ──────────────────────────────────────────────────────────────────
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct CampaignData {
    pub owner: Address,
    pub reward_token: Address,
    pub reward_amount: i128,
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

    /// Create a new campaign.
    pub fn create_campaign(
        env: Env,
        id: u64,
        owner: Address,
        reward_token: Address,
        reward_amount: i128,
        max_participants: u32,
    ) {
        owner.require_auth();
        let key = DataKey::Campaign(id);
        if env.storage().persistent().has(&key) {
            panic!("campaign already exists");
        }

        let data = CampaignData {
            owner: owner.clone(),
            reward_token: reward_token.clone(),
            reward_amount,
            active: false,
            completed: false,
            max_participants,
            current_participants: 0,
        };

        env.storage().persistent().set(&key, &data);
        env.storage().persistent().set(&DataKey::Participants(id), &Vec::<Address>::new(&env));

        env.events().publish(
            (symbol_short!("camp"), symbol_short!("created")),
            (id, owner, reward_token, reward_amount),
        );
    }

    /// Activate or deactivate a campaign. Only owner can call.
    pub fn set_active(env: Env, id: u64, active: bool) {
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

    /// Distribute reward to a participant. Only owner can call.
    /// Note: In a real scenario, this would call the token contract's transfer function.
    pub fn distribute_reward(env: Env, id: u64, participant: Address) {
        let key = DataKey::Campaign(id);
        let data: CampaignData = env.storage().persistent().get(&key).expect("campaign not found");
        data.owner.require_auth();

        let joined_key = DataKey::Joined(id, participant.clone());
        if !env.storage().persistent().has(&joined_key) {
            panic!("participant not in campaign");
        }

        // Emit distribution event
        env.events().publish(
            (symbol_short!("camp"), symbol_short!("reward")),
            (id, participant, data.reward_amount),
        );
    }

    pub fn get_campaign(env: Env, id: u64) -> CampaignData {
        env.storage().persistent().get(&DataKey::Campaign(id)).expect("campaign not found")
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
        let token = Address::generate(&env);
        let id = 1u64;

        // 1. Create
        client.create_campaign(&id, &owner, &token, &100, &2);
        let data = client.get_campaign(&id);
        assert_eq!(data.owner, owner);
        assert_eq!(data.active, false);

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
    #[should_panic(expected = "campaign is full")]
    fn test_campaign_full() {
        let env = Env::default();
        let (_admin, client) = setup(&env);
        let owner = Address::generate(&env);
        let token = Address::generate(&env);
        let id = 1u64;

        client.create_campaign(&id, &owner, &token, &100, &1);
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

        client.create_campaign(&id, &owner, &token, &100, &10);
        let alice = Address::generate(&env);
        client.join_campaign(&id, &alice);
    }
}
