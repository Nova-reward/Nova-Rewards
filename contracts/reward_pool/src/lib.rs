#![no_std]
use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, symbol_short, Address, Env,
};

pub const SECONDS_PER_DAY: u64 = 24 * 60 * 60;
pub const DAILY_WITHDRAWAL_CAP: i128 = 1_000;

#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum PoolState {
    Active,
    PoolLocked,
}

#[contracterror]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum PoolError {
    PoolLocked = 1,
    DailyWithdrawalCapExceeded = 2,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct WithdrawalHistory {
    pub daily_withdrawn: i128,
    pub period_started_at: u64,
}

#[contracttype]
pub enum DataKey {
    Admin,
    Balance,
    PoolState,
    WithdrawalHistory(Address),
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
        env.storage().instance().set(&DataKey::PoolState, &PoolState::Active);
    }

    fn admin(env: &Env) -> Address {
        env.storage().instance().get(&DataKey::Admin).unwrap()
    }

    fn current_history(env: &Env, to: &Address) -> WithdrawalHistory {
        let now = env.ledger().timestamp();
        let history = env
            .storage()
            .instance()
            .get(&DataKey::WithdrawalHistory(to.clone()))
            .unwrap_or(WithdrawalHistory {
                daily_withdrawn: 0,
                period_started_at: now,
            });

        if now.saturating_sub(history.period_started_at) >= SECONDS_PER_DAY {
            WithdrawalHistory {
                daily_withdrawn: 0,
                period_started_at: now,
            }
        } else {
            history
        }
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

    pub fn withdraw(env: Env, to: Address, amount: i128) -> Result<(), PoolError> {
        Self::admin(&env).require_auth();
        if Self::pool_state(env.clone()) == PoolState::PoolLocked {
            return Err(PoolError::PoolLocked);
        }
        assert!(amount > 0, "amount must be positive");
        let bal: i128 = env.storage().instance().get(&DataKey::Balance).unwrap_or(0);
        assert!(bal >= amount, "insufficient pool balance");

        let mut history = Self::current_history(&env, &to);
        if history.daily_withdrawn + amount > DAILY_WITHDRAWAL_CAP {
            return Err(PoolError::DailyWithdrawalCapExceeded);
        }

        env.storage().instance().set(&DataKey::Balance, &(bal - amount));
        history.daily_withdrawn += amount;
        env.storage()
            .instance()
            .set(&DataKey::WithdrawalHistory(to.clone()), &history);

        env.events().publish(
            (symbol_short!("rwd_pool"), symbol_short!("withdrawn")),
            (to, amount),
        );

        Ok(())
    }

    pub fn balance(env: Env) -> i128 {
        env.storage().instance().get(&DataKey::Balance).unwrap_or(0)
    }

    pub fn set_pool_state(env: Env, state: PoolState) {
        Self::admin(&env).require_auth();
        env.storage().instance().set(&DataKey::PoolState, &state);
    }

    pub fn pool_state(env: Env) -> PoolState {
        env.storage()
            .instance()
            .get(&DataKey::PoolState)
            .unwrap_or(PoolState::Active)
    }

    pub fn withdrawal_history(env: Env, to: Address) -> WithdrawalHistory {
        Self::current_history(&env, &to)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{testutils::{Address as _, Events}, Env};

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
}
