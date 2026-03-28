#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, symbol_short, Address, Env};

#[contracttype]
pub enum DataKey {
    Admin,
    Balance,
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
        let bal: i128 = env.storage().instance().get(&DataKey::Balance).unwrap_or(0);
        assert!(bal >= amount, "insufficient pool balance");
        env.storage().instance().set(&DataKey::Balance, &(bal - amount));

        env.events().publish(
            (symbol_short!("rwd_pool"), symbol_short!("withdrawn")),
            (to, amount),
        );
    }

    pub fn balance(env: Env) -> i128 {
        env.storage().instance().get(&DataKey::Balance).unwrap_or(0)
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
