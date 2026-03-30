#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short,
    Address, Env,
};

const DAY_IN_SECONDS: u64 = 86_400;
const DAILY_USAGE_TTL: u32 = 2 * DAY_IN_SECONDS as u32;

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct DailyUsage {
    pub amount: i128,
    pub window_started_at: u64,
}

#[contracttype]
pub enum DataKey {
    Admin,
    Balance,
    DailyLimit,
    DailyUsage(Address),
}

#[contract]
pub struct RewardPoolContract;

#[contractimpl]
impl RewardPoolContract {
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Balance, &0_i128);
        env.storage()
            .instance()
            .set(&DataKey::DailyLimit, &i128::MAX);
    }

    pub fn deposit(env: Env, from: Address, amount: i128) {
        from.require_auth();
        assert_positive_amount(amount);

        let balance = Self::get_balance(env.clone());
        let updated_balance = balance
            .checked_add(amount)
            .expect("pool balance overflow");

        env.storage()
            .instance()
            .set(&DataKey::Balance, &updated_balance);

        env.events().publish(
            (symbol_short!("rwd_pool"), symbol_short!("deposited")),
            (from, amount),
        );
    }

    pub fn withdraw(env: Env, to: Address, amount: i128) {
        let admin = read_admin(&env);
        admin.require_auth();
        assert_positive_amount(amount);

        let balance = Self::get_balance(env.clone());
        if amount > balance {
            panic!("insufficient reward pool balance");
        }

        let now = env.ledger().timestamp();
        let daily_limit = Self::get_daily_limit(env.clone());
        let usage = read_daily_usage(&env, &to);
        let window_start = if usage.window_started_at == 0
            || now.saturating_sub(usage.window_started_at) >= DAY_IN_SECONDS
        {
            now
        } else {
            usage.window_started_at
        };
        let current_usage = if window_start == usage.window_started_at {
            usage.amount
        } else {
            0
        };
        let updated_usage = current_usage
            .checked_add(amount)
            .expect("daily usage overflow");

        if updated_usage > daily_limit {
            panic!("daily withdraw limit exceeded");
        }

        env.storage()
            .instance()
            .set(&DataKey::Balance, &(balance - amount));

        write_daily_usage(
            &env,
            &to,
            &DailyUsage {
                amount: updated_usage,
                window_started_at: window_start,
            },
        );

        env.events().publish(
            (symbol_short!("rwd_pool"), symbol_short!("withdrawn")),
            (to, amount),
        );
    }

    pub fn set_daily_limit(env: Env, limit: i128) {
        let admin = read_admin(&env);
        admin.require_auth();

        if limit <= 0 {
            panic!("daily limit must be positive");
        }

        env.storage().instance().set(&DataKey::DailyLimit, &limit);
    }

    pub fn get_balance(env: Env) -> i128 {
        env.storage().instance().get(&DataKey::Balance).unwrap_or(0)
    }

    pub fn get_daily_limit(env: Env) -> i128 {
        env.storage()
            .instance()
            .get(&DataKey::DailyLimit)
            .unwrap_or(i128::MAX)
    }

    pub fn get_daily_usage(env: Env, wallet: Address) -> DailyUsage {
        read_daily_usage(&env, &wallet)
    }
}

fn read_admin(env: &Env) -> Address {
    env.storage()
        .instance()
        .get(&DataKey::Admin)
        .expect("not initialized")
}

fn read_daily_usage(env: &Env, wallet: &Address) -> DailyUsage {
    let key = DataKey::DailyUsage(wallet.clone());
    if env.storage().persistent().has(&key) {
        let usage = env.storage().persistent().get(&key).unwrap();
        env.storage()
            .persistent()
            .extend_ttl(&key, DAILY_USAGE_TTL, DAILY_USAGE_TTL);
        usage
    } else {
        DailyUsage {
            amount: 0,
            window_started_at: 0,
        }
    }
}

fn write_daily_usage(env: &Env, wallet: &Address, usage: &DailyUsage) {
    let key = DataKey::DailyUsage(wallet.clone());
    env.storage().persistent().set(&key, usage);
    env.storage()
        .persistent()
        .extend_ttl(&key, DAILY_USAGE_TTL, DAILY_USAGE_TTL);
}

fn assert_positive_amount(amount: i128) {
    if amount <= 0 {
        panic!("amount must be positive");
    }
}

#[cfg(test)]
mod tests {
    extern crate std;

    use super::*;
    use soroban_sdk::testutils::{Address as _, Events, Ledger as _};
    use soroban_sdk::{Symbol, TryIntoVal};

    fn deploy(env: &Env) -> (RewardPoolContractClient<'_>, Address) {
        let admin = Address::generate(env);
        let contract_id = env.register(RewardPoolContract, ());
        let client = RewardPoolContractClient::new(env, &contract_id);
        client.initialize(&admin);
        (client, admin)
    }

    #[test]
    fn deposit_and_withdraw_update_balance() {
        let env = Env::default();
        env.mock_all_auths();

        let (client, admin) = deploy(&env);
        let depositor = Address::generate(&env);

        client.deposit(&depositor, &1_000);
        assert_eq!(client.get_balance(), 1_000);

        client.withdraw(&admin, &400);
        assert_eq!(client.get_balance(), 600);
        assert_eq!(client.get_daily_usage(&admin).amount, 400);
    }

    #[test]
    fn withdraw_respects_daily_limit() {
        let env = Env::default();
        env.mock_all_auths();

        let (client, admin) = deploy(&env);
        client.deposit(&Address::generate(&env), &1_000);
        client.set_daily_limit(&500);

        client.withdraw(&admin, &400);

        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            client.withdraw(&admin, &200);
        }));

        assert!(result.is_err());
        assert_eq!(client.get_balance(), 600);
    }

    #[test]
    fn daily_usage_resets_after_one_day() {
        let env = Env::default();
        env.mock_all_auths();

        let (client, admin) = deploy(&env);
        client.deposit(&Address::generate(&env), &1_000);
        client.set_daily_limit(&500);
        client.withdraw(&admin, &400);

        env.ledger().set_timestamp(DAY_IN_SECONDS + 1);
        client.withdraw(&admin, &400);

        assert_eq!(client.get_balance(), 200);
        assert_eq!(client.get_daily_usage(&admin).amount, 400);
    }

    #[test]
    fn emits_pool_events() {
        let env = Env::default();
        env.mock_all_auths();

        let (client, admin) = deploy(&env);
        let depositor = Address::generate(&env);

        client.deposit(&depositor, &250);
        client.withdraw(&admin, &100);

        let events = env.events().all();
        assert_eq!(events.len(), 1);
        let withdrawn = events.get(0).unwrap();
        let withdrawn_contract: Symbol = withdrawn.1.get(0).unwrap().try_into_val(&env).unwrap();
        let withdrawn_event: Symbol = withdrawn.1.get(1).unwrap().try_into_val(&env).unwrap();

        assert_eq!(withdrawn_contract, symbol_short!("rwd_pool"));
        assert_eq!(withdrawn_event, symbol_short!("withdrawn"));
    }
}
