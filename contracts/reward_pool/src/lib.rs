#![no_std]
use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, symbol_short, Address, Env, IntoVal,
    Symbol,
};

// ---------------------------------------------------------------------------
// Error types
// ---------------------------------------------------------------------------

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum PoolError {
    PoolLocked = 1,
    InsufficientBalance = 2,
    Unauthorized = 3,
}

// ---------------------------------------------------------------------------
// Data structures
// ---------------------------------------------------------------------------

#[contracttype]
pub enum DataKey {
    Admin,
    /// Address of the Nova token contract.
    NovaToken,
    /// Timestamp before which withdrawals are blocked.
    LockedUntil,
}

// ---------------------------------------------------------------------------
// Contract
// ---------------------------------------------------------------------------

#[contract]
pub struct RewardPoolContract;

#[contractimpl]
impl RewardPoolContract {
    // -----------------------------------------------------------------------
    // Initialization
    // -----------------------------------------------------------------------

    /// Initializes the reward pool with an admin and Nova token address.
    ///
    /// # Parameters
    /// * `admin` – privileged operator address authorized to withdraw funds.
    /// * `nova_token_address` – address of the Nova token contract.
    ///
    /// # Panics
    /// Panics if the contract has already been initialized.
    pub fn initialize(env: Env, admin: Address, nova_token_address: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage()
            .instance()
            .set(&DataKey::NovaToken, &nova_token_address);
        env.storage().instance().set(&DataKey::LockedUntil, &0u64);
    }

    // -----------------------------------------------------------------------
    // Deposit
    // -----------------------------------------------------------------------

    /// Deposits Nova tokens from the caller into the reward pool.
    ///
    /// # Parameters
    /// * `from` – address transferring tokens into the pool.
    /// * `amount` – number of Nova tokens to deposit.
    ///
    /// # Events
    /// Emits `("rwd_pool", "deposited")` with data `(from, amount)`.
    ///
    /// # Panics
    /// Panics if amount is not positive or if the token transfer fails.
    pub fn deposit(env: Env, from: Address, amount: i128) {
        from.require_auth();
        assert!(amount > 0, "amount must be positive");

        let nova_token: Address = env
            .storage()
            .instance()
            .get(&DataKey::NovaToken)
            .expect("nova token not set");

        // Transfer Nova tokens from caller to this contract
        let _: () = env.invoke_contract(
            &nova_token,
            &Symbol::new(&env, "transfer"),
            soroban_sdk::vec![
                &env,
                from.clone().to_val(),
                env.current_contract_address().to_val(),
                amount.into_val(&env),
            ],
        );

        env.events().publish(
            (symbol_short!("rwd_pool"), symbol_short!("deposited")),
            (from, amount),
        );
    }

    // -----------------------------------------------------------------------
    // Withdraw
    // -----------------------------------------------------------------------

    /// Withdraws Nova tokens from the pool to a recipient. Admin only.
    ///
    /// # Parameters
    /// * `to` – address receiving the tokens.
    /// * `amount` – number of Nova tokens to withdraw.
    ///
    /// # Events
    /// Emits `("rwd_pool", "withdrawn")` with data `(to, amount)`.
    ///
    /// # Errors
    /// Returns `PoolError::PoolLocked` if current time is before `locked_until`.
    /// Returns `PoolError::InsufficientBalance` if pool balance is too low.
    ///
    /// # Panics
    /// Panics if caller is not the admin or if amount is not positive.
    pub fn withdraw(env: Env, to: Address, amount: i128) -> Result<(), PoolError> {
        Self::require_admin(&env);
        assert!(amount > 0, "amount must be positive");

        // Check if pool is locked
        let locked_until: u64 = env
            .storage()
            .instance()
            .get(&DataKey::LockedUntil)
            .unwrap_or(0);
        let now = env.ledger().timestamp();

        if now < locked_until {
            return Err(PoolError::PoolLocked);
        }

        // Check pool balance
        let nova_token: Address = env
            .storage()
            .instance()
            .get(&DataKey::NovaToken)
            .expect("nova token not set");

        let pool_balance: i128 = env.invoke_contract(
            &nova_token,
            &Symbol::new(&env, "balance"),
            soroban_sdk::vec![&env, env.current_contract_address().to_val()],
        );

        if pool_balance < amount {
            return Err(PoolError::InsufficientBalance);
        }

        // Transfer Nova tokens from pool to recipient
        let _: () = env.invoke_contract(
            &nova_token,
            &Symbol::new(&env, "transfer"),
            soroban_sdk::vec![
                &env,
                env.current_contract_address().to_val(),
                to.clone().to_val(),
                amount.into_val(&env),
            ],
        );

        env.events().publish(
            (symbol_short!("rwd_pool"), symbol_short!("withdrawn")),
            (to, amount),
        );

        Ok(())
    }

    // -----------------------------------------------------------------------
    // Balance Query
    // -----------------------------------------------------------------------

    /// Returns the contract's current Nova token balance.
    ///
    /// # Returns
    /// The number of Nova tokens held by this contract.
    pub fn get_balance(env: Env) -> i128 {
        let nova_token: Address = env
            .storage()
            .instance()
            .get(&DataKey::NovaToken)
            .expect("nova token not set");

        env.invoke_contract(
            &nova_token,
            &Symbol::new(&env, "balance"),
            soroban_sdk::vec![&env, env.current_contract_address().to_val()],
        )
    }

    // -----------------------------------------------------------------------
    // Lock Management
    // -----------------------------------------------------------------------

    /// Sets the unlock timestamp. Withdrawals are blocked until this time.
    ///
    /// # Parameters
    /// * `unlock_time` – Unix timestamp (seconds) when withdrawals become allowed.
    ///
    /// # Panics
    /// Panics if caller is not the admin.
    pub fn set_locked_until(env: Env, unlock_time: u64) {
        Self::require_admin(&env);
        env.storage()
            .instance()
            .set(&DataKey::LockedUntil, &unlock_time);
    }

    /// Returns the current unlock timestamp.
    ///
    /// # Returns
    /// Unix timestamp (seconds) before which withdrawals are blocked.
    pub fn get_locked_until(env: Env) -> u64 {
        env.storage()
            .instance()
            .get(&DataKey::LockedUntil)
            .unwrap_or(0)
    }

    // -----------------------------------------------------------------------
    // Private Helpers
    // -----------------------------------------------------------------------

    fn require_admin(env: &Env) {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("admin not set");
        admin.require_auth();
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Env};

    #[test]
    fn test_initialize() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let token = Address::generate(&env);

        let id = env.register(RewardPoolContract, ());
        let client = RewardPoolContractClient::new(&env, &id);

        client.initialize(&admin, &token);

        assert_eq!(client.get_locked_until(), 0);
    }

    #[test]
    #[should_panic(expected = "already initialized")]
    fn test_double_initialize() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let token = Address::generate(&env);

        let id = env.register(RewardPoolContract, ());
        let client = RewardPoolContractClient::new(&env, &id);

        client.initialize(&admin, &token);
        client.initialize(&admin, &token); // Should panic
    }
}
