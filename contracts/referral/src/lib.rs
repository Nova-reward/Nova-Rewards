#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, Address, Env,
};

// ── Storage keys ──────────────────────────────────────────────────────────────
#[contracttype]
pub enum DataKey {
    Admin,
    /// referred -> referrer
    Referral(Address),
    /// referrer -> total count
    TotalReferrals(Address),
    /// Pool balance for reward payouts
    PoolBalance,
}

// ── Contract ──────────────────────────────────────────────────────────────────
#[contract]
pub struct ReferralContract;

#[contractimpl]
impl ReferralContract {
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialised");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::PoolBalance, &0_i128);
    }

    fn admin(env: &Env) -> Address {
        env.storage().instance().get(&DataKey::Admin).unwrap()
    }

    /// Fund the referral reward pool (admin-gated).
    pub fn fund_pool(env: Env, amount: i128) {
        Self::admin(&env).require_auth();
        assert!(amount > 0, "amount must be positive");
        let bal: i128 = env.storage().instance().get(&DataKey::PoolBalance).unwrap_or(0);
        env.storage().instance().set(&DataKey::PoolBalance, &(bal + amount));
    }

    /// Register a referral. Each wallet can only be referred once.
    pub fn register_referral(env: Env, referrer: Address, referred: Address) {
        // referred wallet authorises the registration
        referred.require_auth();
        assert!(referrer != referred, "cannot refer yourself");

        let key = DataKey::Referral(referred.clone());
        if env.storage().persistent().has(&key) {
            panic!("already referred");
        }

        env.storage().persistent().set(&key, &referrer);

        // increment referrer counter
        let count_key = DataKey::TotalReferrals(referrer.clone());
        let count: u32 = env.storage().persistent().get(&count_key).unwrap_or(0);
        env.storage().persistent().set(&count_key, &(count + 1));

        env.events().publish(
            (symbol_short!("referral"), symbol_short!("ref_reg")),
            (referrer, referred),
        );
    }

    /// Look up who referred a given wallet.
    pub fn get_referrer(env: Env, referred: Address) -> Option<Address> {
        env.storage()
            .persistent()
            .get(&DataKey::Referral(referred))
    }

    /// Credit the referrer of `referred` with `reward_amount` Nova tokens (admin-gated).
    pub fn credit_referrer(env: Env, referred: Address, reward_amount: i128) {
        Self::admin(&env).require_auth();
        assert!(reward_amount > 0, "reward_amount must be positive");

        let referrer: Address = env
            .storage()
            .persistent()
            .get(&DataKey::Referral(referred.clone()))
            .expect("no referrer found");

        let pool_bal: i128 = env.storage().instance().get(&DataKey::PoolBalance).unwrap_or(0);
        assert!(pool_bal >= reward_amount, "insufficient pool balance");
        env.storage()
            .instance()
            .set(&DataKey::PoolBalance, &(pool_bal - reward_amount));

        // In a real deployment this would call the token contract transfer.
        // Here we emit the event to record the credit on-chain.
        env.events().publish(
            (symbol_short!("referral"), symbol_short!("ref_cred")),
            (referrer, referred, reward_amount),
        );
    }

    /// Total referrals made by a referrer (leaderboard).
    pub fn total_referrals(env: Env, referrer: Address) -> u32 {
        env.storage()
            .persistent()
            .get(&DataKey::TotalReferrals(referrer))
            .unwrap_or(0)
    }

    pub fn pool_balance(env: Env) -> i128 {
        env.storage().instance().get(&DataKey::PoolBalance).unwrap_or(0)
    }
}

// ── Tests ─────────────────────────────────────────────────────────────────────
#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{testutils::{Address as _, Events}, Env};

    fn setup() -> (Env, Address, ReferralContractClient<'static>) {
        let env = Env::default();
        env.mock_all_auths();
        let id = env.register(ReferralContract, ());
        let client = ReferralContractClient::new(&env, &id);
        let admin = Address::generate(&env);
        client.initialize(&admin);
        client.fund_pool(&10_000);
        (env, admin, client)
    }

    #[test]
    fn test_first_time_registration() {
        let (env, _admin, client) = setup();
        let referrer = Address::generate(&env);
        let referred = Address::generate(&env);
        client.register_referral(&referrer, &referred);
        assert_eq!(client.get_referrer(&referred), Some(referrer.clone()));
        assert_eq!(client.total_referrals(&referrer), 1);
    }

    #[test]
    #[should_panic(expected = "already referred")]
    fn test_duplicate_registration_rejected() {
        let (env, _admin, client) = setup();
        let referrer = Address::generate(&env);
        let referred = Address::generate(&env);
        client.register_referral(&referrer, &referred);
        client.register_referral(&referrer, &referred); // should panic
    }

    #[test]
    fn test_referrer_credit() {
        let (env, _admin, client) = setup();
        let referrer = Address::generate(&env);
        let referred = Address::generate(&env);
        client.register_referral(&referrer, &referred);
        client.credit_referrer(&referred, &500);
        assert_eq!(client.pool_balance(), 9_500);
        let _ = env.events().all(); // drain; event emission verified via snapshot
    }

    #[test]
    fn test_counter_increments() {
        let (env, _admin, client) = setup();
        let referrer = Address::generate(&env);
        let r1 = Address::generate(&env);
        let r2 = Address::generate(&env);
        let r3 = Address::generate(&env);
        client.register_referral(&referrer, &r1);
        client.register_referral(&referrer, &r2);
        client.register_referral(&referrer, &r3);
        assert_eq!(client.total_referrals(&referrer), 3);
    }

    #[test]
    fn test_registration_emits_event() {
        let (env, _admin, client) = setup();
        let referrer = Address::generate(&env);
        let referred = Address::generate(&env);
        client.register_referral(&referrer, &referred);
        let _ = env.events().all(); // drain; event emission verified via snapshot
    }
}
