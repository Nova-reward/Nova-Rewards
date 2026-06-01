//! # Distribution Contract
//!
//! Admin-controlled token distribution with batch support and a 30-day clawback window.
//!
//! ## Features
//! - Single and batch token distribution (up to 50 recipients per call)
//! - Fixed-point reward calculation via [`calculate_reward`](DistributionContract::calculate_reward)
//! - 30-day clawback window per distribution
//! - M-of-N multisig upgrade mechanism
//!
//! ## Event Schema (v1)
//! All events include a `schema_version` field as the first data element.
//!
//! | topics                          | data                                                    |
//! |---------------------------------|---------------------------------------------------------|
//! | `("dist", "distributed")`       | `(v, recipient, amount, deadline)`                      |
//! | `("dist", "batch_dist")`        | `(v, count, total_amount)`                              |
//! | `("dist", "clawback")`          | `(v, recipient, amount)`                                |
//! | `("dist", "upgraded")`          | `(v, new_wasm_hash)`                                    |
#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, token, Address, BytesN, Env, Vec,
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
    /// Multisig signers for upgrade authorization
    Signers,
    /// Minimum approvals required for upgrade
    Threshold,
    /// Pending upgrade approvals: wasm_hash -> Vec<Address>
    UpgradeApprovals(BytesN<32>),
}

/// Seconds a distribution remains clawback-eligible (default: 30 days)
const CLAWBACK_WINDOW: u64 = 30 * 24 * 60 * 60;

/// Schema version for all events emitted by this contract.
pub const EVENT_SCHEMA_VERSION: u32 = 1;

// ── Event helpers ─────────────────────────────────────────────────────────────

fn emit_distributed(env: &Env, recipient: &Address, amount: i128, deadline: u64) {
    env.events().publish(
        (symbol_short!("dist"), symbol_short!("distributed")),
        (EVENT_SCHEMA_VERSION, recipient.clone(), amount, deadline),
    );
}

fn emit_batch_distributed(env: &Env, count: u32, total_amount: i128) {
    env.events().publish(
        (symbol_short!("dist"), symbol_short!("batch_dist")),
        (EVENT_SCHEMA_VERSION, count, total_amount),
    );
}

fn emit_clawback(env: &Env, recipient: &Address, amount: i128) {
    env.events().publish(
        (symbol_short!("dist"), symbol_short!("clawback")),
        (EVENT_SCHEMA_VERSION, recipient.clone(), amount),
    );
}

fn emit_contract_upgraded(env: &Env, new_wasm_hash: &BytesN<32>) {
    env.events().publish(
        (symbol_short!("dist"), symbol_short!("upgraded")),
        (EVENT_SCHEMA_VERSION, new_wasm_hash.clone()),
    );
}

// ── Contract ──────────────────────────────────────────────────────────────────

#[contract]
pub struct DistributionContract;

#[contractimpl]
impl DistributionContract {
    // ── Init ─────────────────────────────────────────────────────────────────

    /// One-time setup. `token_id` is the Nova token contract address.
    ///
    /// # Parameters
    /// - `admin` – Address authorized to call distribution and clawback functions.
    /// - `token_id` – Address of the Nova token contract used for transfers.
    /// - `signers` – Multisig signer set for upgrade authorization.
    /// - `threshold` – Minimum approvals required to execute an upgrade.
    ///
    /// # Panics
    /// - `"already initialized"` if called more than once.
    pub fn initialize(
        env: Env,
        admin: Address,
        token_id: Address,
        signers: Vec<Address>,
        threshold: u32,
    ) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }
        assert!(threshold >= 1, "threshold must be at least 1");
        assert!(
            signers.len() >= threshold,
            "signers count must be >= threshold"
        );
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::TokenId, &token_id);
        env.storage().instance().set(&DataKey::Signers, &signers);
        env.storage().instance().set(&DataKey::Threshold, &threshold);
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
    pub fn calculate_reward(base_amount: i128, rate_bps: i128) -> i128 {
        assert!(base_amount >= 0, "base_amount must be non-negative");
        assert!(
            rate_bps >= 0 && rate_bps <= 10_000,
            "rate_bps must be 0–10 000"
        );
        base_amount
            .checked_mul(rate_bps)
            .expect("overflow in base_amount * rate_bps")
            .checked_div(10_000)
            .expect("division error")
    }

    // ── Single distribution ───────────────────────────────────────────────────

    /// Distribute `amount` tokens to `recipient`.
    ///
    /// # Events
    /// Emits `("dist", "distributed")` with `(schema_version, recipient, amount, deadline)`.
    pub fn distribute(env: Env, recipient: Address, amount: i128) {
        Self::require_admin(&env);
        Self::_distribute(&env, &recipient, amount);
    }

    fn _distribute(env: &Env, recipient: &Address, amount: i128) {
        assert!(amount > 0, "amount must be positive");

        let tok = Self::token(env);
        let contract_addr = env.current_contract_address();

        let bal = tok.balance(&contract_addr);
        assert!(bal >= amount, "insufficient contract balance");

        tok.transfer(&contract_addr, recipient, &amount);

        let deadline = env.ledger().timestamp() + CLAWBACK_WINDOW;
        env.storage()
            .persistent()
            .set(&DataKey::ClawbackDeadline(recipient.clone()), &deadline);
        env.storage()
            .persistent()
            .set(&DataKey::Distributed(recipient.clone()), &amount);

        emit_distributed(env, recipient, amount, deadline);
    }

    // ── Batch distribution ────────────────────────────────────────────────────

    /// Distribute rewards to multiple recipients in a single call.
    ///
    /// # Events
    /// Emits one `("dist", "distributed")` event per entry, plus a
    /// `("dist", "batch_dist")` summary event with total count and amount.
    pub fn distribute_batch(env: Env, recipients: Vec<Address>, amounts: Vec<i128>) {
        Self::require_admin(&env);

        let n = recipients.len();
        assert!(n == amounts.len(), "recipients and amounts length mismatch");
        assert!(n > 0, "empty batch");
        assert!(n <= 50, "batch exceeds maximum of 50");

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

        for i in 0..n {
            let recipient = recipients.get(i).unwrap();
            let amount = amounts.get(i).unwrap();
            Self::_distribute(&env, &recipient, amount);
        }

        emit_batch_distributed(&env, n, total);
    }

    // ── Clawback ──────────────────────────────────────────────────────────────

    /// Reclaim tokens from `recipient` back to the contract.
    ///
    /// # Events
    /// Emits `("dist", "clawback")` with `(schema_version, recipient, amount)`.
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

        let tok = Self::token(&env);
        tok.transfer_from(
            &env.current_contract_address(),
            &recipient,
            &env.current_contract_address(),
            &amount,
        );

        env.storage()
            .persistent()
            .remove(&DataKey::ClawbackDeadline(recipient.clone()));
        env.storage()
            .persistent()
            .remove(&DataKey::Distributed(recipient.clone()));

        emit_clawback(&env, &recipient, amount);
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

    // ── Upgrade (M-of-N multisig) ─────────────────────────────────────────────

    /// Approve a pending WASM upgrade. Executes when threshold is reached.
    ///
    /// # Events
    /// Emits `("dist", "upgraded")` with `(schema_version, new_wasm_hash)` when threshold is met.
    ///
    /// # Panics
    /// - `"not an authorized signer"` if `signer` is not in the signer set.
    /// - `"already approved"` if `signer` has already approved this hash.
    pub fn approve_upgrade(env: Env, signer: Address, new_wasm_hash: BytesN<32>) {
        signer.require_auth();

        let signers: Vec<Address> = env
            .storage()
            .instance()
            .get(&DataKey::Signers)
            .expect("not initialized");
        let is_authorized = signers.iter().any(|s| s == signer);
        assert!(is_authorized, "not an authorized signer");

        let approval_key = DataKey::UpgradeApprovals(new_wasm_hash.clone());
        let mut approvals: Vec<Address> = env
            .storage()
            .instance()
            .get(&approval_key)
            .unwrap_or(Vec::new(&env));

        let already_approved = approvals.iter().any(|a| a == signer);
        assert!(!already_approved, "already approved");

        approvals.push_back(signer);
        env.storage().instance().set(&approval_key, &approvals);

        let threshold: u32 = env
            .storage()
            .instance()
            .get(&DataKey::Threshold)
            .unwrap_or(1);

        if approvals.len() >= threshold {
            env.storage().instance().remove(&approval_key);
            emit_contract_upgraded(&env, &new_wasm_hash);
            env.deployer().update_current_contract_wasm(new_wasm_hash);
        }
    }

    pub fn get_upgrade_approvals(env: Env, new_wasm_hash: BytesN<32>) -> u32 {
        let approval_key = DataKey::UpgradeApprovals(new_wasm_hash);
        let approvals: Vec<Address> = env
            .storage()
            .instance()
            .get(&approval_key)
            .unwrap_or(Vec::new(&env));
        approvals.len()
    }

    pub fn get_threshold(env: Env) -> u32 {
        env.storage()
            .instance()
            .get(&DataKey::Threshold)
            .unwrap_or(1)
    }

    pub fn get_signers(env: Env) -> Vec<Address> {
        env.storage()
            .instance()
            .get(&DataKey::Signers)
            .unwrap_or(Vec::new(&env))
    }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{
        testutils::{Address as _, Ledger},
        vec, BytesN, Env,
    };

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
        client.initialize(&admin, &token_id, &vec![&env, admin.clone()], &1);

        let tok = mock_token::MockTokenClient::new(&env, &token_id);
        tok.mint(&contract_id, &10_000);

        (env, admin, client, token_id)
    }

    #[test]
    fn test_calculate_reward() {
        assert_eq!(DistributionContract::calculate_reward(1_000, 500), 50);
        assert_eq!(DistributionContract::calculate_reward(1_000, 10_000), 1_000);
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

    // ── Upgrade tests ─────────────────────────────────────────────────────────

    #[test]
    fn test_upgrade_approval_accumulates() {
        let env = Env::default();
        env.mock_all_auths();
        let token_id = env.register(mock_token::MockToken, ());
        let contract_id = env.register(DistributionContract, ());
        let s1 = Address::generate(&env);
        let s2 = Address::generate(&env);
        let client = DistributionContractClient::new(&env, &contract_id);
        client.initialize(&s1, &token_id, &vec![&env, s1.clone(), s2.clone()], &2);

        let fake_hash = BytesN::from_array(&env, &[0u8; 32]);
        client.approve_upgrade(&s1, &fake_hash);
        assert_eq!(client.get_upgrade_approvals(&fake_hash), 1);
    }

    #[test]
    #[should_panic(expected = "not an authorized signer")]
    fn test_unauthorized_upgrade_rejected() {
        let (env, _admin, client, _) = setup();
        let outsider = Address::generate(&env);
        let fake_hash = BytesN::from_array(&env, &[1u8; 32]);
        client.approve_upgrade(&outsider, &fake_hash);
    }

    #[test]
    #[should_panic(expected = "already approved")]
    fn test_duplicate_approval_rejected() {
        let env = Env::default();
        env.mock_all_auths();
        let token_id = env.register(mock_token::MockToken, ());
        let contract_id = env.register(DistributionContract, ());
        let s1 = Address::generate(&env);
        let s2 = Address::generate(&env);
        let client = DistributionContractClient::new(&env, &contract_id);
        client.initialize(&s1, &token_id, &vec![&env, s1.clone(), s2.clone()], &2);

        let fake_hash = BytesN::from_array(&env, &[2u8; 32]);
        client.approve_upgrade(&s1, &fake_hash);
        client.approve_upgrade(&s1, &fake_hash); // should panic
    }
}
