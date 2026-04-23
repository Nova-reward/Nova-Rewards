//! # Reward Pool Contract
//!
//! A shared liquidity pool that merchants deposit into and users withdraw from,
//! subject to a configurable per-wallet daily withdrawal cap.
//!
//! ## Usage
//! ```ignore
//! // Admin initializes
//! client.initialize(&admin);
//!
//! // Merchant deposits
//! client.deposit(&merchant, &50_000);
//!
//! // Set a daily limit of 1 000 tokens per wallet
//! client.set_daily_limit(&1_000);
//!
//! // User withdraws
//! client.withdraw(&user, &500);
//! ```
#![no_std]
use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, symbol_short, Address, Bytes, BytesN,
    Env, IntoVal, Vec,
};

const DAY_IN_SECONDS: u64 = 86_400;
const DAILY_USAGE_TTL: u32 = 172_800;
/// Persistent TTL for claimed flags: ~1 year in ledgers (5 s/ledger).
const CLAIMED_TTL: u32 = 6_307_200;

// ---------------------------------------------------------------------------
// Error types
// ---------------------------------------------------------------------------

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum ClaimError {
    AlreadyClaimed = 1,
    InvalidProof = 2,
    InsufficientPoolBalance = 3,
}

// ---------------------------------------------------------------------------
// Data structures
// ---------------------------------------------------------------------------

/// Tracks how much a wallet has withdrawn within the current 24-hour window.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct DailyUsage {
    pub amount: i128,
    pub window_start: u64,
}

#[contracttype]
pub enum DataKey {
    Admin,
    /// Internal accounting balance of the pool (not tied to a real token).
    Balance,
    DailyLimit,
    DailyUsage(Address),
    /// Merkle root for the token-claim airdrop.
    MerkleRoot,
    /// Address of the Nova token contract used for claim transfers.
    NovaToken,
    /// Persistent flag: true once an address has successfully claimed.
    Claimed(Address),
}

// ---------------------------------------------------------------------------
// Contract
// ---------------------------------------------------------------------------

#[contract]
pub struct RewardPoolContract;

#[contractimpl]
impl RewardPoolContract {
    /// Initializes the reward pool and stores the admin address.
    ///
    /// Sets the initial pool balance to `0` and the daily limit to `i128::MAX` (unlimited).
    ///
    /// # Parameters
    /// - `admin` – Address authorized to call [`set_daily_limit`](RewardPoolContract::set_daily_limit).
    ///
    /// # Panics
    /// - `"already initialised"` if called more than once.
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialised");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Balance, &0_i128);
        env.storage()
            .instance()
            .set(&DataKey::DailyLimit, &i128::MAX);
        env.storage()
            .instance()
            .set(&DataKey::NovaToken, &nova_token);
        env.storage()
            .instance()
            .set(&DataKey::MerkleRoot, &merkle_root);
    }

    // -----------------------------------------------------------------------
    // Merkle claim
    // -----------------------------------------------------------------------

    /// Verifies a Merkle proof and transfers `amount` Nova tokens to `claimer`.
    ///
    /// # Leaf encoding
    /// `leaf = SHA-256(claimer_address_bytes ++ amount_le_bytes)`
    ///
    /// # Proof format
    /// Standard binary Merkle proof: each element is the sibling hash at that
    /// level.  Hashing is always `SHA-256(left ++ right)` where the smaller
    /// hash is placed on the left (sorted-pair / "OpenZeppelin" style).
    ///
    /// # Errors
    /// * `AlreadyClaimed`          – wallet has already claimed.
    /// * `InvalidProof`            – computed root does not match stored root.
    /// * `InsufficientPoolBalance` – pool's Nova token balance is too low.
    pub fn claim(
        env: Env,
        claimer: Address,
        amount: i128,
        proof: Vec<BytesN<32>>,
    ) -> Result<(), ClaimError> {
        claimer.require_auth();

        // --- 1. One-claim-per-wallet guard ---
        let claimed_key = DataKey::Claimed(claimer.clone());
        if env
            .storage()
            .persistent()
            .get::<_, bool>(&claimed_key)
            .unwrap_or(false)
        {
            return Err(ClaimError::AlreadyClaimed);
        }

        // --- 2. Verify Merkle proof ---
        let root: BytesN<32> = env
            .storage()
            .instance()
            .get(&DataKey::MerkleRoot)
            .expect("merkle root not set");

        let leaf = Self::compute_leaf(&env, &claimer, amount);
        if !Self::verify_proof(&env, leaf, &proof, &root) {
            return Err(ClaimError::InvalidProof);
        }

        // --- 3. Check pool balance on the Nova token contract ---
        let nova_token: Address = env
            .storage()
            .instance()
            .get(&DataKey::NovaToken)
            .expect("nova token not set");

        let pool_balance: i128 = env.invoke_contract(
            &nova_token,
            &soroban_sdk::Symbol::new(&env, "balance"),
            soroban_sdk::vec![&env, env.current_contract_address().to_val()],
        );

        if pool_balance < amount {
            return Err(ClaimError::InsufficientPoolBalance);
        }

        // --- 4. Mark claimed (before external call — checks-effects-interactions) ---
        env.storage().persistent().set(&claimed_key, &true);
        env.storage()
            .persistent()
            .extend_ttl(&claimed_key, CLAIMED_TTL, CLAIMED_TTL);

        // --- 5. Transfer Nova tokens from pool to claimer ---
        let _: () = env.invoke_contract(
            &nova_token,
            &soroban_sdk::Symbol::new(&env, "transfer"),
            soroban_sdk::vec![
                &env,
                env.current_contract_address().to_val(),
                claimer.clone().to_val(),
                amount.into_val(&env),
            ],
        );

        // --- 6. Emit claimed event ---
        env.events().publish(
            (symbol_short!("rwd_pool"), symbol_short!("claimed")),
            (claimer, amount),
        );

        Ok(())
    }

    /// Returns `true` if the given address has already claimed.
    pub fn is_claimed(env: Env, claimer: Address) -> bool {
        env.storage()
            .persistent()
            .get::<_, bool>(&DataKey::Claimed(claimer))
            .unwrap_or(false)
    }

    /// Returns the stored Merkle root.
    pub fn get_merkle_root(env: Env) -> BytesN<32> {
        env.storage()
            .instance()
            .get(&DataKey::MerkleRoot)
            .expect("merkle root not set")
    }

    /// Deposits funds into the shared reward pool.
    ///
    /// # Parameters
    /// - `from` – Address making the deposit (must authorize).
    /// - `amount` – Amount to deposit (must be > 0).
    ///
    /// # Authorization
    /// Requires `from` authorization.
    ///
    /// # Events
    /// Emits `("rwd_pool", "deposited")` with data `(from: Address, amount: i128)`.
    ///
    /// # Panics
    /// - `"amount must be positive"` if `amount <= 0`.
    pub fn deposit(env: Env, from: Address, amount: i128) {
        from.require_auth();
        assert!(amount > 0, "amount must be positive");

        let balance: i128 = env.storage().instance().get(&DataKey::Balance).unwrap_or(0);
        env.storage()
            .instance()
            .set(&DataKey::Balance, &(balance + amount));

        env.events().publish(
            (symbol_short!("rwd_pool"), symbol_short!("deposited")),
            (from, amount),
        );
    }

    /// Withdraws funds from the shared reward pool subject to the daily wallet limit.
    ///
    /// The 24-hour window resets automatically when 86 400 seconds have elapsed
    /// since the wallet's last window start.
    ///
    /// # Parameters
    /// - `to` – Recipient address (must authorize).
    /// - `amount` – Amount to withdraw (must be > 0).
    ///
    /// # Authorization
    /// Requires `to` authorization.
    ///
    /// # Events
    /// Emits `("rwd_pool", "withdrawn")` with data `(to: Address, amount: i128)`.
    ///
    /// # Panics
    /// - `"amount must be positive"` if `amount <= 0`.
    /// - `"insufficient pool balance"` if the pool holds fewer tokens than `amount`.
    /// - `"daily withdrawal limit exceeded"` if the wallet's 24-hour usage would exceed the limit.
    pub fn withdraw(env: Env, to: Address, amount: i128) {
        to.require_auth();
        assert!(amount > 0, "amount must be positive");

        let balance: i128 = env.storage().instance().get(&DataKey::Balance).unwrap_or(0);
        assert!(balance >= amount, "insufficient pool balance");

        let limit: i128 = env
            .storage()
            .instance()
            .get(&DataKey::DailyLimit)
            .unwrap_or(i128::MAX);
        let mut usage = Self::current_usage(&env, &to);
        assert!(
            usage.amount + amount <= limit,
            "daily withdrawal limit exceeded"
        );

        usage.amount += amount;
        Self::set_usage(&env, &to, &usage);
        env.storage()
            .instance()
            .set(&DataKey::Balance, &(balance - amount));

        env.events().publish(
            (symbol_short!("rwd_pool"), symbol_short!("withdrawn")),
            (to, amount),
        );
    }

    /// Updates the per-wallet daily withdrawal cap. Admin only.
    ///
    /// # Parameters
    /// - `limit` – New daily cap in base units (must be > 0).
    ///
    /// # Authorization
    /// Requires admin authorization.
    ///
    /// # Panics
    /// - `"limit must be positive"` if `limit <= 0`.
    pub fn set_daily_limit(env: Env, limit: i128) {
        Self::admin(&env).require_auth();
        assert!(limit > 0, "limit must be positive");
        env.storage().instance().set(&DataKey::DailyLimit, &limit);
    }

    /// Returns the total funds currently held by the reward pool (internal accounting).
    pub fn get_balance(env: Env) -> i128 {
        env.storage().instance().get(&DataKey::Balance).unwrap_or(0)
    }

    /// Returns the configured per-wallet daily withdrawal cap.
    pub fn get_daily_limit(env: Env) -> i128 {
        env.storage()
            .instance()
            .get(&DataKey::DailyLimit)
            .unwrap_or(i128::MAX)
    }

    /// Returns the tracked 24-hour withdrawal usage for a wallet.
    pub fn get_daily_usage(env: Env, wallet: Address) -> DailyUsage {
        Self::current_usage(&env, &wallet)
    }

    // -----------------------------------------------------------------------
    // Private helpers
    // -----------------------------------------------------------------------

    fn admin(env: &Env) -> Address {
        env.storage().instance().get(&DataKey::Admin).unwrap()
    }

    fn current_usage(env: &Env, wallet: &Address) -> DailyUsage {
        let key = DataKey::DailyUsage(wallet.clone());
        let now = env.ledger().timestamp();
        let usage = env.storage().persistent().get(&key).unwrap_or(DailyUsage {
            amount: 0,
            window_start: now,
        });

        if now.saturating_sub(usage.window_start) >= DAY_IN_SECONDS {
            DailyUsage {
                amount: 0,
                window_start: now,
            }
        } else {
            env.storage()
                .persistent()
                .extend_ttl(&key, DAILY_USAGE_TTL, DAILY_USAGE_TTL);
            usage
        }
    }

    fn set_usage(env: &Env, wallet: &Address, usage: &DailyUsage) {
        let key = DataKey::DailyUsage(wallet.clone());
        env.storage().persistent().set(&key, usage);
        env.storage()
            .persistent()
            .extend_ttl(&key, DAILY_USAGE_TTL, DAILY_USAGE_TTL);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{
        testutils::{Address as _, Events},
        Env,
    };

    fn dummy_root(env: &Env) -> BytesN<32> {
        BytesN::from_array(env, &[0u8; 32])
    }

    fn dummy_token(env: &Env) -> Address {
        Address::generate(env)
    }

    fn setup(env: &Env) -> (Address, RewardPoolContractClient) {
        env.mock_all_auths();
        let id = env.register(RewardPoolContract, ());
        let client = RewardPoolContractClient::new(env, &id);
        let admin = Address::generate(env);
        client.initialize(&admin, &dummy_token(env), &dummy_root(env));
        (admin, client)
    }

    #[test]
    fn test_deposit_withdraw_events() {
        let env = Env::default();
        let (_admin, client) = setup(&env);
        let depositor = Address::generate(&env);
        let recipient = Address::generate(&env);

        client.deposit(&depositor, &1_000);
        client.withdraw(&recipient, &400);

        assert_eq!(client.get_balance(), 600);
        let _ = env.events().all();
    }

    #[test]
    #[should_panic(expected = "insufficient pool balance")]
    fn test_withdraw_overdraft() {
        let env = Env::default();
        let (_admin, client) = setup(&env);
        let recipient = Address::generate(&env);

        client.withdraw(&recipient, &1);
    }
}
