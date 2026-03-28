#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, symbol_short, Address, Env};

#[contracttype]
#[derive(Clone)]
pub struct DailyUsage {
    pub amount_used: i128,
    pub window_start: u64,
}

#[contracttype]
pub enum DataKey {
    Admin,
    Balance,
    DailyLimit,
    DailyUsage(Address),
}

#[contract]
pub struct RewardPool;

#[contractimpl]
impl RewardPool {
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialised");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Balance, &0_i128);
    }

    fn admin(env: &Env) -> Address {
        env.storage().instance().get(&DataKey::Admin).unwrap()
    }

    fn daily_limit(env: &Env) -> i128 {
        env.storage()
            .instance()
            .get(&DataKey::DailyLimit)
            .unwrap_or(i128::MAX)
    }

    pub fn set_daily_limit(env: Env, limit: i128) {
        Self::admin(&env).require_auth();
        assert!(limit >= 0, "daily_limit must be non-negative");
        env.storage().instance().set(&DataKey::DailyLimit, &limit);
        env.events().publish(
            (symbol_short!("rwd_pool"), symbol_short!("daily_limit_updated")),
            (limit,),
        );
    }

    pub fn deposit(env: Env, from: Address, amount: i128) {
        from.require_auth();
        assert!(amount > 0, "amount must be positive");
        let bal: i128 = env.storage().instance().get(&DataKey::Balance).unwrap_or(0);
        env.storage().instance().set(&DataKey::Balance, &(bal + amount));

        env.events().publish(
            (symbol_short!("rwd_pool"), symbol_short!("deposited")),
            (from, amount),
        );
    }

    pub fn withdraw(env: Env, to: Address, amount: i128) {
        Self::admin(&env).require_auth();
        assert!(amount > 0, "amount must be positive");

        let now = env.ledger().timestamp();
        let key = DataKey::DailyUsage(to.clone());
        let mut usage: DailyUsage = env
            .storage()
            .persistent()
            .get(&key)
            .unwrap_or(DailyUsage {
                amount_used: 0,
                window_start: now,
            });

        if now.saturating_sub(usage.window_start) >= 86_400 {
            usage.amount_used = 0;
            usage.window_start = now;
        }

        let limit = Self::daily_limit(&env);
        assert!(usage.amount_used + amount <= limit, "DailyLimitExceeded");

        usage.amount_used += amount;
        env.storage().persistent().set(&key, &usage);
        env.storage()
            .persistent()
            .extend_ttl(&key, 172_800, 172_800);

        let bal: i128 = env.storage().instance().get(&DataKey::Balance).unwrap_or(0);
        assert!(bal >= amount, "insufficient pool balance");
        env.storage().instance().set(&DataKey::Balance, &(bal - amount));

        env.events().publish(
            (symbol_short!("rwd_pool"), symbol_short!("withdrawn")),
            (to, amount),
        );
    }

    pub fn get_daily_limit(env: Env) -> i128 {
        env.storage()
            .instance()
            .get(&DataKey::DailyLimit)
            .unwrap_or(i128::MAX)
    }

    pub fn get_daily_usage(env: Env, address: Address) -> DailyUsage {
        let key = DataKey::DailyUsage(address);
        let usage: DailyUsage = env
            .storage()
            .persistent()
            .get(&key)
            .unwrap_or(DailyUsage {
                amount_used: 0,
                window_start: env.ledger().timestamp(),
            });
        env.storage()
            .persistent()
            .extend_ttl(&key, 172_800, 172_800);
        usage
    }

    pub fn balance(env: Env) -> i128 {
        env.storage().instance().get(&DataKey::Balance).unwrap_or(0)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{testutils::{Address as _, Events, Ledger}, Env};

    fn setup() -> (Env, Address, RewardPoolClient<'static>) {
        let env = Env::default();
        env.mock_all_auths();
        let id = env.register(RewardPool, ());
        let client = RewardPoolClient::new(&env, &id);
        let admin = Address::generate(&env);
        client.initialize(&admin);
        (env, admin, client)
    }

    #[test]
    fn test_deposit_withdraw_events() {
        let (env, admin, client) = setup();
        let user = Address::generate(&env);
        client.deposit(&user, &1000);
        assert_eq!(client.balance(), 1000);
        let _ = env.events().all();
        client.withdraw(&admin, &400);
        assert_eq!(client.balance(), 600);
        let _ = env.events().all();
    }

    #[test]
    #[should_panic(expected = "insufficient pool balance")]
    fn test_withdraw_overdraft() {
        let (_env, admin, client) = setup();
        client.withdraw(&admin, &1);
    }

    #[test]
    fn test_withdraw_within_daily_limit() {
        let (env, admin, client) = setup();
        let wallet = Address::generate(&env);
        client.deposit(&admin, &1000);
        client.set_daily_limit(&50);
        client.withdraw(&wallet, &40);
        assert_eq!(client.balance(), 960);
        let usage = client.get_daily_usage(&wallet);
        assert_eq!(usage.amount_used, 40);
    }

    #[test]
    fn test_withdraw_hits_exact_daily_limit() {
        let (env, admin, client) = setup();
        let wallet = Address::generate(&env);
        client.deposit(&admin, &1000);
        client.set_daily_limit(&100);
        client.withdraw(&wallet, &100);
        assert_eq!(client.balance(), 900);
        let usage = client.get_daily_usage(&wallet);
        assert_eq!(usage.amount_used, 100);
    }

    #[test]
    #[should_panic(expected = "DailyLimitExceeded")]
    fn test_withdraw_exceeds_daily_limit() {
        let (env, admin, client) = setup();
        let wallet = Address::generate(&env);
        client.deposit(&admin, &1000);
        client.set_daily_limit(&100);
        client.withdraw(&wallet, &100);
        env.ledger().set_timestamp(1);
        client.withdraw(&wallet, &1);
    }

    #[test]
    fn test_daily_window_resets_after_24_hours() {
        let (env, admin, client) = setup();
        let wallet = Address::generate(&env);
        client.deposit(&admin, &1000);
        client.set_daily_limit(&200);
        client.withdraw(&wallet, &200);
        assert_eq!(client.balance(), 800);
        env.ledger().set_timestamp(86_400);
        client.withdraw(&wallet, &200);
        assert_eq!(client.balance(), 600);
    }
}
