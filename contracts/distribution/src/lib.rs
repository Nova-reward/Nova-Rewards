#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, token, Address, Env, Vec,
};

// ── Storage keys ─────────────────────────────────────────────────────────────

#[contracttype]
pub enum DataKey {
    Admin,
    TokenId,
    /// Tracks clawback eligibility window end (ledger timestamp) per recipient
    ClawbackDeadline(Address),
    /// Amount originally distributed to a recipient (for clawback)
    Distributed(Address),
}

/// Seconds a distribution remains clawback-eligible (default: 30 days)
const CLAWBACK_WINDOW: u64 = 30 * 24 * 60 * 60;

// ── Contract ──────────────────────────────────────────────────────────────────

#[contract]
pub struct DistributionContract;

#[contractimpl]
impl DistributionContract {
    // ── Init ─────────────────────────────────────────────────────────────────

    /// One-time setup. `token_id` is the Nova token contract address.
    pub fn initialize(env: Env, admin: Address, token_id: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::TokenId, &token_id);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    fn require_admin(env: &Env) -> Address {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("not initialized");
        admin.require_auth();
        admin
    }

    fn token(env: &Env) -> token::Client {
        let id: Address = env
            .storage()
            .instance()
            .get(&DataKey::TokenId)
            .expect("not initialized");
        token::Client::new(env, &id)
    }

    // ── Reward calculation ────────────────────────────────────────────────────

    /// Calculate the reward for a given `base_amount` and `rate_bps`
    /// (rate in basis points, 10 000 = 100 %).
    ///
    /// Uses multiply-first fixed-point arithmetic to avoid precision loss.
    pub fn calculate_reward(base_amount: i128, rate_bps: i128) -> i128 {
        assert!(base_amount >= 0, "base_amount must be non-negative");
        assert!(
            rate_bps >= 0 && rate_bps <= 10_000,
            "rate_bps must be 0–10 000"
        );
        // (base_amount * rate_bps) / 10_000
        base_amount
            .checked_mul(rate_bps)
            .expect("overflow in base_amount * rate_bps")
            .checked_div(10_000)
            .expect("division error")
    }

    // ── Single distribution ───────────────────────────────────────────────────

    /// Distribute `amount` tokens to `recipient`.
    ///
    /// - Admin-gated.
    /// - Validates `amount > 0` and that the contract holds sufficient balance.
    /// - Records the distribution for clawback within `CLAWBACK_WINDOW` seconds.
    ///
    /// Emits `("dist", recipient)` with data `(amount, deadline)`.
    pub fn distribute(env: Env, recipient: Address, amount: i128) {
        Self::require_admin(&env);
        Self::_distribute(&env, &recipient, amount);
    }

    fn _distribute(env: &Env, recipient: &Address, amount: i128) {
        assert!(amount > 0, "amount must be positive");

        let tok = Self::token(env);
        let contract_addr = env.current_contract_address();

        // Validate sufficient balance
        let bal = tok.balance(&contract_addr);
        assert!(bal >= amount, "insufficient contract balance");

        // Transfer tokens to recipient
        tok.transfer(&contract_addr, recipient, &amount);

        // Record for clawback
        let deadline = env.ledger().timestamp() + CLAWBACK_WINDOW;
        env.storage()
            .persistent()
            .set(&DataKey::ClawbackDeadline(recipient.clone()), &deadline);
        env.storage()
            .persistent()
            .set(&DataKey::Distributed(recipient.clone()), &amount);

        env.events()
            .publish((symbol_short!("dist"), recipient.clone()), (amount, deadline));
    }

    // ── Batch distribution ────────────────────────────────────────────────────

    /// Distribute rewards to multiple recipients in a single call.
    ///
    /// `recipients` and `amounts` must be the same length (max 50 entries).
    /// The entire batch is validated before any transfer is executed.
    ///
    /// Emits one `("dist", recipient)` event per entry.
    pub fn distribute_batch(
        env: Env,
        recipients: Vec<Address>,
        amounts: Vec<i128>,
    ) {
        Self::require_admin(&env);

        let n = recipients.len();
        assert!(n == amounts.len(), "recipients and amounts length mismatch");
        assert!(n > 0, "empty batch");
        assert!(n <= 50, "batch exceeds maximum of 50");

        // Pre-validate: all amounts positive and total fits contract balance
        let tok = Self::token(&env);
        let contract_addr = env.current_contract_address();
        let mut total: i128 = 0;
        for i in 0..n {
            let amt = amounts.get(i).unwrap();
            assert!(amt > 0, "amount must be positive");
            total = total.checked_add(amt).expect("total overflow");
        }
        assert!(
            tok.balance(&contract_addr) >= total,
            "insufficient contract balance for batch"
        );

        // Execute transfers
        for i in 0..n {
            let recipient = recipients.get(i).unwrap();
            let amount = amounts.get(i).unwrap();
            Self::_distribute(&env, &recipient, amount);
        }
    }

    // ── Clawback ──────────────────────────────────────────────────────────────

    /// Reclaim tokens from `recipient` back to the contract.
    ///
    /// Only callable by admin within `CLAWBACK_WINDOW` seconds of distribution.
    /// Requires the recipient to have approved the contract as a spender
    /// (standard token allowance flow).
    ///
    /// Emits `("clawback", recipient)` with data `amount`.
    pub fn clawback(env: Env, recipient: Address) {
        Self::require_admin(&env);

        let deadline: u64 = env
            .storage()
            .persistent()
            .get(&DataKey::ClawbackDeadline(recipient.clone()))
            .expect("no clawback record for recipient");

        assert!(
            env.ledger().timestamp() <= deadline,
            "clawback window has expired"
        );

        let amount: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::Distributed(recipient.clone()))
            .expect("no distribution record");

        assert!(amount > 0, "nothing to clawback");

        // Pull tokens back (recipient must have approved the contract)
        let tok = Self::token(&env);
        tok.transfer_from(
            &env.current_contract_address(),
            &recipient,
            &env.current_contract_address(),
            &amount,
        );

        // Clear records
        env.storage()
            .persistent()
            .remove(&DataKey::ClawbackDeadline(recipient.clone()));
        env.storage()
            .persistent()
            .remove(&DataKey::Distributed(recipient.clone()));

        env.events()
            .publish((symbol_short!("clawback"), recipient), amount);
    }

    // ── View helpers ──────────────────────────────────────────────────────────

    pub fn get_distributed(env: Env, recipient: Address) -> i128 {
        env.storage()
            .persistent()
            .get(&DataKey::Distributed(recipient))
            .unwrap_or(0)
    }

    pub fn get_clawback_deadline(env: Env, recipient: Address) -> u64 {
        env.storage()
            .persistent()
            .get(&DataKey::ClawbackDeadline(recipient))
            .unwrap_or(0)
    }

    pub fn contract_balance(env: Env) -> i128 {
        Self::token(&env).balance(&env.current_contract_address())
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

    // Minimal mock token for testing
    mod mock_token {
        use soroban_sdk::{contract, contractimpl, contracttype, Address, Env};

        #[contracttype]
        pub enum Key {
            Balance(Address),
            Allowance(Address, Address),
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
                env.storage().instance().set(&from_key, &(from_bal - amount));
                let to_bal: i128 = env.storage().instance().get(&to_key).unwrap_or(0);
                env.storage().instance().set(&to_key, &(to_bal + amount));
            }

            pub fn transfer_from(
                env: Env,
                _spender: Address,
                from: Address,
                to: Address,
                amount: i128,
            ) {
                let from_key = Key::Balance(from.clone());
                let to_key = Key::Balance(to.clone());
                let from_bal: i128 = env.storage().instance().get(&from_key).unwrap_or(0);
                assert!(from_bal >= amount, "insufficient balance");
                env.storage().instance().set(&from_key, &(from_bal - amount));
                let to_bal: i128 = env.storage().instance().get(&to_key).unwrap_or(0);
                env.storage().instance().set(&to_key, &(to_bal + amount));
            }

            pub fn approve(env: Env, owner: Address, spender: Address, amount: i128, _expiry: u32) {
                env.storage()
                    .instance()
                    .set(&Key::Allowance(owner, spender), &amount);
            }
        }
    }

    fn setup() -> (Env, Address, DistributionContractClient<'static>, Address) {
        let env = Env::default();
        env.mock_all_auths();

        let token_id = env.register(mock_token::MockToken, ());
        let contract_id = env.register(DistributionContract, ());
        let admin = Address::generate(&env);

        let client = DistributionContractClient::new(&env, &contract_id);
        client.initialize(&admin, &token_id);

        // Fund the distribution contract
        let tok = mock_token::MockTokenClient::new(&env, &token_id);
        tok.mint(&contract_id, &10_000);

        (env, admin, client, token_id)
    }

    #[test]
    fn test_calculate_reward() {
        assert_eq!(DistributionContract::calculate_reward(1_000, 500), 50); // 5%
        assert_eq!(DistributionContract::calculate_reward(1_000, 10_000), 1_000); // 100%
        assert_eq!(DistributionContract::calculate_reward(1_000, 0), 0);
    }

    #[test]
    fn test_distribute_single() {
        let (env, _admin, client, token_id) = setup();
        let recipient = Address::generate(&env);

        client.distribute(&recipient, &500);

        let tok = mock_token::MockTokenClient::new(&env, &token_id);
        assert_eq!(tok.balance(&recipient), 500);
        assert_eq!(client.get_distributed(&recipient), 500);
    }

    #[test]
    fn test_distribute_batch() {
        let (env, _admin, client, token_id) = setup();
        let r1 = Address::generate(&env);
        let r2 = Address::generate(&env);

        let recipients = soroban_sdk::vec![&env, r1.clone(), r2.clone()];
        let amounts = soroban_sdk::vec![&env, 300_i128, 200_i128];
        client.distribute_batch(&recipients, &amounts);

        let tok = mock_token::MockTokenClient::new(&env, &token_id);
        assert_eq!(tok.balance(&r1), 300);
        assert_eq!(tok.balance(&r2), 200);
    }

    #[test]
    fn test_clawback_within_window() {
        let (env, _admin, client, token_id) = setup();
        let recipient = Address::generate(&env);

        client.distribute(&recipient, &400);
        client.clawback(&recipient);

        let tok = mock_token::MockTokenClient::new(&env, &token_id);
        assert_eq!(tok.balance(&recipient), 0);
        assert_eq!(client.get_distributed(&recipient), 0);
    }

    #[test]
    #[should_panic(expected = "clawback window has expired")]
    fn test_clawback_after_window_fails() {
        let (env, _admin, client, _token_id) = setup();
        let recipient = Address::generate(&env);

        client.distribute(&recipient, &400);

        // Advance time past the clawback window
        env.ledger().with_mut(|l| {
            l.timestamp += CLAWBACK_WINDOW + 1;
        });

        client.clawback(&recipient);
    }

    #[test]
    #[should_panic(expected = "insufficient contract balance")]
    fn test_distribute_exceeds_balance_fails() {
        let (env, _admin, client, _token_id) = setup();
        let recipient = Address::generate(&env);
        client.distribute(&recipient, &999_999);
    }

    #[test]
    #[should_panic(expected = "recipients and amounts length mismatch")]
    fn test_batch_length_mismatch_fails() {
        let (env, _admin, client, _token_id) = setup();
        let r1 = Address::generate(&env);
        let recipients = soroban_sdk::vec![&env, r1];
        let amounts = soroban_sdk::vec![&env, 100_i128, 200_i128];
        client.distribute_batch(&recipients, &amounts);
    }
}
