//! # Treasury Contract
//!
//! Holds the platform's reserve of reward tokens and controls their release to
//! campaigns and staking pools. Enforces a per-period spending cap to prevent
//! draining attacks. All withdrawals require admin authorization.
//!
//! ## Lifecycle
//! 1. Admin calls [`initialize`](TreasuryContract::initialize) with the token address and
//!    initial period configuration.
//! 2. Tokens are deposited into the treasury by calling the token contract's `transfer`
//!    directly to this contract's address (no deposit entry-point needed — the treasury
//!    reads its live on-chain balance via the token contract).
//! 3. Admin calls [`withdraw`](TreasuryContract::withdraw) to release tokens to a recipient.
//!    Each withdrawal is checked against the per-period cap.
//! 4. Admin may call [`set_period_cap`](TreasuryContract::set_period_cap) to adjust the cap.
//!
//! ## Period cap mechanics
//! A "period" is a fixed window of `period_duration` seconds. The first withdrawal
//! in a new period resets the `period_start` timestamp and `withdrawn_this_period`
//! counter. Attempting to exceed `period_cap` within a single period reverts with
//! `PeriodLimitExceeded`.
//!
//! ## Usage
//! ```ignore
//! client.initialize(&admin, &token_address, &period_cap, &period_duration);
//!
//! // Withdraw tokens (admin only)
//! client.withdraw(&recipient, &amount);
//!
//! // Update the cap
//! client.set_period_cap(&new_cap);
//! ```

#![no_std]
use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, symbol_short, token, Address, Env,
};

// ── Errors ────────────────────────────────────────────────────────────────────

/// Errors returned by the treasury contract.
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum TreasuryError {
    /// The requested withdrawal would exceed the per-period spending cap.
    PeriodLimitExceeded = 1,
    /// The treasury does not hold enough tokens to fulfil the withdrawal.
    InsufficientBalance = 2,
}

// ── Storage keys ──────────────────────────────────────────────────────────────

#[contracttype]
pub enum DataKey {
    /// Contract administrator (`Address`, instance storage).
    Admin,
    /// Address of the Nova token contract (`Address`, instance storage).
    TokenId,
    /// Maximum tokens that may be withdrawn in a single period (`i128`, instance storage).
    PeriodCap,
    /// Duration of one period in seconds (`u64`, instance storage).
    PeriodDuration,
    /// Timestamp (seconds) when the current period started (`u64`, instance storage).
    PeriodStart,
    /// Tokens already withdrawn in the current period (`i128`, instance storage).
    WithdrawnThisPeriod,
    /// Cumulative tokens released since deployment (`i128`, instance storage).
    TotalReleased,
}

// ── Contract ──────────────────────────────────────────────────────────────────

#[contract]
pub struct TreasuryContract;

#[contractimpl]
impl TreasuryContract {
    // ── Initialisation ────────────────────────────────────────────────────────

    /// One-time setup. Stores the admin, token address, and period configuration.
    ///
    /// # Parameters
    /// - `admin` – Address authorized to call [`withdraw`](TreasuryContract::withdraw)
    ///   and [`set_period_cap`](TreasuryContract::set_period_cap).
    /// - `token_id` – Address of the Nova token contract.
    /// - `period_cap` – Maximum tokens that may be withdrawn per period (must be > 0).
    /// - `period_duration` – Length of one period in seconds (must be > 0).
    ///
    /// # Panics
    /// - `"already initialized"` if called more than once.
    /// - `"period_cap must be positive"` if `period_cap <= 0`.
    /// - `"period_duration must be positive"` if `period_duration == 0`.
    pub fn initialize(
        env: Env,
        admin: Address,
        token_id: Address,
        period_cap: i128,
        period_duration: u64,
    ) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }
        assert!(period_cap > 0, "period_cap must be positive");
        assert!(period_duration > 0, "period_duration must be positive");

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::TokenId, &token_id);
        env.storage().instance().set(&DataKey::PeriodCap, &period_cap);
        env.storage()
            .instance()
            .set(&DataKey::PeriodDuration, &period_duration);
        env.storage()
            .instance()
            .set(&DataKey::PeriodStart, &env.ledger().timestamp());
        env.storage()
            .instance()
            .set(&DataKey::WithdrawnThisPeriod, &0_i128);
        env.storage()
            .instance()
            .set(&DataKey::TotalReleased, &0_i128);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    fn admin(env: &Env) -> Address {
        env.storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("not initialized")
    }

    fn token(env: &Env) -> token::Client {
        let id: Address = env
            .storage()
            .instance()
            .get(&DataKey::TokenId)
            .expect("not initialized");
        token::Client::new(env, &id)
    }

    /// Rolls the period window forward if `period_duration` seconds have elapsed
    /// since `period_start`. Returns the (possibly reset) `withdrawn_this_period`.
    fn refresh_period(env: &Env) -> i128 {
        let now = env.ledger().timestamp();
        let period_start: u64 = env
            .storage()
            .instance()
            .get(&DataKey::PeriodStart)
            .unwrap_or(now);
        let period_duration: u64 = env
            .storage()
            .instance()
            .get(&DataKey::PeriodDuration)
            .unwrap_or(u64::MAX);

        if now >= period_start + period_duration {
            // New period — reset counters
            env.storage()
                .instance()
                .set(&DataKey::PeriodStart, &now);
            env.storage()
                .instance()
                .set(&DataKey::WithdrawnThisPeriod, &0_i128);
            0
        } else {
            env.storage()
                .instance()
                .get(&DataKey::WithdrawnThisPeriod)
                .unwrap_or(0)
        }
    }

    // ── Admin operations ──────────────────────────────────────────────────────

    /// Withdraw `amount` tokens from the treasury to `recipient`.
    ///
    /// Checks:
    /// 1. Caller is the admin.
    /// 2. The treasury holds at least `amount` tokens.
    /// 3. `withdrawn_this_period + amount <= period_cap` (after rolling the window if needed).
    ///
    /// # Parameters
    /// - `recipient` – Address that will receive the tokens.
    /// - `amount` – Number of tokens to release (must be > 0).
    ///
    /// # Authorization
    /// Requires admin authorization.
    ///
    /// # Events
    /// Emits `("treasury", "withdraw")` with data `(recipient: Address, amount: i128)`.
    ///
    /// # Errors
    /// - [`TreasuryError::PeriodLimitExceeded`] if the withdrawal would exceed the period cap.
    /// - [`TreasuryError::InsufficientBalance`] if the treasury holds fewer tokens than `amount`.
    ///
    /// # Panics
    /// - `"amount must be positive"` if `amount <= 0`.
    pub fn withdraw(
        env: Env,
        recipient: Address,
        amount: i128,
    ) -> Result<(), TreasuryError> {
        Self::admin(&env).require_auth();
        assert!(amount > 0, "amount must be positive");

        // Check on-chain token balance
        let tok = Self::token(&env);
        let treasury_balance = tok.balance(&env.current_contract_address());
        if treasury_balance < amount {
            return Err(TreasuryError::InsufficientBalance);
        }

        // Roll period window if needed and check cap
        let withdrawn = Self::refresh_period(&env);
        let period_cap: i128 = env
            .storage()
            .instance()
            .get(&DataKey::PeriodCap)
            .expect("not initialized");

        if withdrawn + amount > period_cap {
            return Err(TreasuryError::PeriodLimitExceeded);
        }

        // Update accounting
        env.storage()
            .instance()
            .set(&DataKey::WithdrawnThisPeriod, &(withdrawn + amount));

        let total_released: i128 = env
            .storage()
            .instance()
            .get(&DataKey::TotalReleased)
            .unwrap_or(0);
        env.storage()
            .instance()
            .set(&DataKey::TotalReleased, &(total_released + amount));

        // Execute token transfer
        tok.transfer(&env.current_contract_address(), &recipient, &amount);

        env.events().publish(
            (symbol_short!("treasury"), symbol_short!("withdraw")),
            (recipient, amount),
        );

        Ok(())
    }

    /// Update the per-period withdrawal cap. Admin only.
    ///
    /// # Parameters
    /// - `new_cap` – New maximum tokens per period (must be > 0).
    ///
    /// # Authorization
    /// Requires admin authorization.
    ///
    /// # Events
    /// Emits `("treasury", "cap_set")` with data `new_cap: i128`.
    ///
    /// # Panics
    /// - `"period_cap must be positive"` if `new_cap <= 0`.
    pub fn set_period_cap(env: Env, new_cap: i128) {
        Self::admin(&env).require_auth();
        assert!(new_cap > 0, "period_cap must be positive");
        env.storage().instance().set(&DataKey::PeriodCap, &new_cap);

        env.events().publish(
            (symbol_short!("treasury"), symbol_short!("cap_set")),
            new_cap,
        );
    }

    /// Update the period duration. Admin only.
    ///
    /// The current period is NOT reset — the new duration takes effect at the
    /// next period rollover.
    ///
    /// # Parameters
    /// - `new_duration` – New period length in seconds (must be > 0).
    ///
    /// # Authorization
    /// Requires admin authorization.
    ///
    /// # Panics
    /// - `"period_duration must be positive"` if `new_duration == 0`.
    pub fn set_period_duration(env: Env, new_duration: u64) {
        Self::admin(&env).require_auth();
        assert!(new_duration > 0, "period_duration must be positive");
        env.storage()
            .instance()
            .set(&DataKey::PeriodDuration, &new_duration);
    }

    // ── Read-only ─────────────────────────────────────────────────────────────

    /// Returns the live token balance held by the treasury (on-chain query).
    pub fn balance(env: Env) -> i128 {
        Self::token(&env).balance(&env.current_contract_address())
    }

    /// Returns the cumulative tokens released since deployment.
    pub fn total_released(env: Env) -> i128 {
        env.storage()
            .instance()
            .get(&DataKey::TotalReleased)
            .unwrap_or(0)
    }

    /// Returns the configured per-period withdrawal cap.
    pub fn period_cap(env: Env) -> i128 {
        env.storage()
            .instance()
            .get(&DataKey::PeriodCap)
            .expect("not initialized")
    }

    /// Returns the configured period duration in seconds.
    pub fn period_duration(env: Env) -> u64 {
        env.storage()
            .instance()
            .get(&DataKey::PeriodDuration)
            .expect("not initialized")
    }

    /// Returns the amount already withdrawn in the current period.
    ///
    /// Note: this does NOT roll the period window — call [`withdraw`](TreasuryContract::withdraw)
    /// to trigger a rollover.
    pub fn withdrawn_this_period(env: Env) -> i128 {
        env.storage()
            .instance()
            .get(&DataKey::WithdrawnThisPeriod)
            .unwrap_or(0)
    }

    /// Returns the admin address.
    pub fn get_admin(env: Env) -> Address {
        Self::admin(&env)
    }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{
        testutils::{Address as _, Ledger},
        Env,
    };

    // ── Minimal mock token ────────────────────────────────────────────────────

    mod mock_token {
        use soroban_sdk::{contract, contractimpl, contracttype, Address, Env};

        #[contracttype]
        pub enum Key {
            Balance(Address),
        }

        #[contract]
        pub struct MockToken;

        #[contractimpl]
        impl MockToken {
            pub fn mint(env: Env, to: Address, amount: i128) {
                let key = Key::Balance(to.clone());
                let bal: i128 = env.storage().instance().get(&key).unwrap_or(0);
                env.storage().instance().set(&key, &(bal + amount));
            }

            pub fn balance(env: Env, addr: Address) -> i128 {
                env.storage()
                    .instance()
                    .get(&Key::Balance(addr))
                    .unwrap_or(0)
            }

            pub fn transfer(env: Env, from: Address, to: Address, amount: i128) {
                let from_key = Key::Balance(from.clone());
                let to_key = Key::Balance(to.clone());
                let from_bal: i128 = env.storage().instance().get(&from_key).unwrap_or(0);
                assert!(from_bal >= amount, "insufficient balance");
                env.storage()
                    .instance()
                    .set(&from_key, &(from_bal - amount));
                let to_bal: i128 = env.storage().instance().get(&to_key).unwrap_or(0);
                env.storage().instance().set(&to_key, &(to_bal + amount));
            }
        }
    }

    // ── Setup helper ──────────────────────────────────────────────────────────

    /// Returns (env, admin, treasury_client, token_id, treasury_contract_id).
    /// The treasury is pre-funded with `initial_balance` tokens.
    fn setup(
        period_cap: i128,
        period_duration: u64,
        initial_balance: i128,
    ) -> (
        Env,
        Address,
        TreasuryContractClient<'static>,
        Address,
        Address,
    ) {
        let env = Env::default();
        env.mock_all_auths();

        let token_id = env.register(mock_token::MockToken, ());
        let treasury_id = env.register(TreasuryContract, ());
        let admin = Address::generate(&env);

        let client = TreasuryContractClient::new(&env, &treasury_id);
        client.initialize(&admin, &token_id, &period_cap, &period_duration);

        // Fund the treasury
        let tok = mock_token::MockTokenClient::new(&env, &token_id);
        tok.mint(&treasury_id, &initial_balance);

        (env, admin, client, token_id, treasury_id)
    }

    // ── Initialization ────────────────────────────────────────────────────────

    #[test]
    fn test_initialize_stores_config() {
        let (_, _, client, _, _) = setup(1_000, 86_400, 10_000);
        assert_eq!(client.period_cap(), 1_000);
        assert_eq!(client.period_duration(), 86_400);
        assert_eq!(client.total_released(), 0);
        assert_eq!(client.withdrawn_this_period(), 0);
    }

    #[test]
    #[should_panic(expected = "already initialized")]
    fn test_double_initialize_panics() {
        let (env, admin, client, token_id, _) = setup(1_000, 86_400, 0);
        client.initialize(&admin, &token_id, &1_000, &86_400);
    }

    #[test]
    #[should_panic(expected = "period_cap must be positive")]
    fn test_initialize_zero_cap_panics() {
        let env = Env::default();
        env.mock_all_auths();
        let token_id = env.register(mock_token::MockToken, ());
        let treasury_id = env.register(TreasuryContract, ());
        let admin = Address::generate(&env);
        let client = TreasuryContractClient::new(&env, &treasury_id);
        client.initialize(&admin, &token_id, &0, &86_400);
    }

    // ── Withdraw ──────────────────────────────────────────────────────────────

    #[test]
    fn test_withdraw_transfers_tokens() {
        let (env, _, client, token_id, treasury_id) = setup(5_000, 86_400, 10_000);
        let recipient = Address::generate(&env);

        client.withdraw(&recipient, &1_000).unwrap();

        let tok = mock_token::MockTokenClient::new(&env, &token_id);
        assert_eq!(tok.balance(&recipient), 1_000);
        assert_eq!(tok.balance(&treasury_id), 9_000);
        assert_eq!(client.total_released(), 1_000);
        assert_eq!(client.withdrawn_this_period(), 1_000);
    }

    #[test]
    fn test_withdraw_emits_event() {
        let (env, _, client, _, _) = setup(5_000, 86_400, 10_000);
        let recipient = Address::generate(&env);
        client.withdraw(&recipient, &500).unwrap();
        // Event emission verified — at least one event published
        assert!(!env.events().all().is_empty());
    }

    #[test]
    fn test_multiple_withdrawals_accumulate_within_period() {
        let (env, _, client, _, _) = setup(5_000, 86_400, 10_000);
        let r1 = Address::generate(&env);
        let r2 = Address::generate(&env);

        client.withdraw(&r1, &2_000).unwrap();
        client.withdraw(&r2, &2_000).unwrap();

        assert_eq!(client.withdrawn_this_period(), 4_000);
        assert_eq!(client.total_released(), 4_000);
    }

    // ── Period cap enforcement ────────────────────────────────────────────────

    #[test]
    fn test_period_limit_exceeded_error() {
        let (env, _, client, _, _) = setup(1_000, 86_400, 10_000);
        let recipient = Address::generate(&env);

        // First withdrawal is fine
        client.withdraw(&recipient, &800).unwrap();

        // Second withdrawal would exceed cap (800 + 300 = 1100 > 1000)
        let result = client.withdraw(&recipient, &300);
        assert_eq!(result, Err(TreasuryError::PeriodLimitExceeded));
    }

    #[test]
    fn test_period_cap_exactly_reached_is_ok() {
        let (env, _, client, _, _) = setup(1_000, 86_400, 10_000);
        let recipient = Address::generate(&env);

        client.withdraw(&recipient, &1_000).unwrap();
        assert_eq!(client.withdrawn_this_period(), 1_000);
    }

    #[test]
    fn test_period_resets_after_duration() {
        let (env, _, client, _, _) = setup(1_000, 86_400, 10_000);
        let recipient = Address::generate(&env);

        // Exhaust the cap in period 1
        client.withdraw(&recipient, &1_000).unwrap();
        assert_eq!(
            client.withdraw(&recipient, &1),
            Err(TreasuryError::PeriodLimitExceeded)
        );

        // Advance time past the period duration
        env.ledger().with_mut(|l| l.timestamp += 86_400 + 1);

        // New period — cap resets
        client.withdraw(&recipient, &1_000).unwrap();
        assert_eq!(client.withdrawn_this_period(), 1_000);
        // Total released accumulates across periods
        assert_eq!(client.total_released(), 2_000);
    }

    // ── Insufficient balance ──────────────────────────────────────────────────

    #[test]
    fn test_insufficient_balance_error() {
        let (env, _, client, _, _) = setup(100_000, 86_400, 500);
        let recipient = Address::generate(&env);

        let result = client.withdraw(&recipient, &1_000);
        assert_eq!(result, Err(TreasuryError::InsufficientBalance));
    }

    // ── set_period_cap ────────────────────────────────────────────────────────

    #[test]
    fn test_set_period_cap_updates_cap() {
        let (_, _, client, _, _) = setup(1_000, 86_400, 10_000);
        client.set_period_cap(&5_000);
        assert_eq!(client.period_cap(), 5_000);
    }

    #[test]
    #[should_panic(expected = "period_cap must be positive")]
    fn test_set_period_cap_zero_panics() {
        let (_, _, client, _, _) = setup(1_000, 86_400, 10_000);
        client.set_period_cap(&0);
    }

    #[test]
    fn test_set_period_cap_emits_event() {
        let (env, _, client, _, _) = setup(1_000, 86_400, 10_000);
        client.set_period_cap(&2_000);
        assert!(!env.events().all().is_empty());
    }

    // ── total_released tracking ───────────────────────────────────────────────

    #[test]
    fn test_total_released_tracks_across_periods() {
        let (env, _, client, _, _) = setup(1_000, 86_400, 10_000);
        let recipient = Address::generate(&env);

        client.withdraw(&recipient, &500).unwrap();
        env.ledger().with_mut(|l| l.timestamp += 86_400 + 1);
        client.withdraw(&recipient, &700).unwrap();

        assert_eq!(client.total_released(), 1_200);
    }

    // ── balance read ──────────────────────────────────────────────────────────

    #[test]
    fn test_balance_reflects_token_contract() {
        let (env, _, client, token_id, treasury_id) = setup(5_000, 86_400, 3_000);
        assert_eq!(client.balance(), 3_000);

        let recipient = Address::generate(&env);
        client.withdraw(&recipient, &1_000).unwrap();
        assert_eq!(client.balance(), 2_000);
    }
}
