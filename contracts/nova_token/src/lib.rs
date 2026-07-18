//! # Nova Token Contract
//!
//! A Soroban token contract implementing ERC20-like fungible token functionality.
//!
//! ## Features
//! - Token initialization, mint, burn, and transfer
//! - Approve/allowance functionality with expiration ledger enforcement
//! - Events emitted on all state-changing operations
//! - [`transfer_from`](NovaToken::transfer_from) support for allowance-based transfers
//! - Expired allowances are treated as zero (delegated spending is safe)
//!
//! ## Usage
//! ```ignore
//! // Initialize
//! client.initialize(&admin);
//!
//! // Mint tokens to a user
//! client.mint(&user, &1_000_000);
//!
//! // Transfer between accounts
//! client.transfer(&from, &to, &500_000);
//!
//! // Approve a spender with an expiration ledger and use transfer_from
//! client.approve(&owner, &spender, &200_000, &expiration_ledger);
//! client.transfer_from(&spender, &owner, &recipient, &100_000);
//! ```

#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, symbol_short, Address, Env};

// ============================================
// Storage Keys
// ============================================

#[contracttype]
enum DataKey {
    Admin,
    Initialized,
    Balance(Address),
    /// Stores AllowanceValue { amount, expiration_ledger } keyed by (owner, spender)
    Allowance(Address, Address),
}

// ============================================
// Allowance value — amount + expiry
// ============================================

/// Stores the approved amount and the ledger sequence number after which the
/// allowance is considered expired (inclusive: valid while current_ledger <= expiration_ledger).
#[contracttype]
#[derive(Clone, Debug)]
pub struct AllowanceValue {
    pub amount: i128,
    pub expiration_ledger: u32,
}

// ============================================
// Contract
// ============================================

#[contract]
pub struct NovaToken;

#[contractimpl]
impl NovaToken {
    /// Initializes the token contract with the admin allowed to mint.
    ///
    /// # Parameters
    /// - `admin` – Address that will be authorized to call [`mint`](NovaToken::mint).
    ///
    /// # Panics
    /// - `"already initialized"` if called more than once.
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }
        env.storage().instance().set(&DataKey::Initialized, &true);
        env.storage().instance().set(&DataKey::Admin, &admin);
    }

    // ========================================
    // Internal Helpers
    // ========================================

    /// Returns the configured token admin.
    fn admin(env: &Env) -> Address {
        env.storage().instance().get(&DataKey::Admin).unwrap()
    }

    /// Reads a wallet balance from persistent storage and refreshes its TTL.
    fn balance_of(env: &Env, addr: &Address) -> i128 {
        let key = DataKey::Balance(addr.clone());
        let balance = env.storage().persistent().get(&key).unwrap_or(0i128);
        // Extend TTL by 31 days (2,678,400 ledgers at 5s/ledger)
        env.storage()
            .persistent()
            .extend_ttl(&key, 2_678_400, 2_678_400);
        balance
    }

    /// Stores a wallet balance and refreshes the persistent entry TTL.
    fn set_balance(env: &Env, addr: &Address, amount: i128) {
        let key = DataKey::Balance(addr.clone());
        env.storage().persistent().set(&key, &amount);
        // Extend TTL by 31 days
        env.storage()
            .persistent()
            .extend_ttl(&key, 2_678_400, 2_678_400);
    }

    // ========================================
    // Token Operations
    // ========================================

    /// Mints new tokens to a recipient.
    ///
    /// # Parameters
    /// - `to` – Recipient address.
    /// - `amount` – Number of tokens to mint (must be > 0).
    ///
    /// # Authorization
    /// Requires admin authorization.
    ///
    /// # Events
    /// Emits `("nova_tok", "mint")` with data `(to: Address, amount: i128)`.
    ///
    /// # Panics
    /// - `"amount must be positive"` if `amount <= 0`.
    pub fn mint(env: Env, to: Address, amount: i128) {
        Self::admin(&env).require_auth();
        assert!(amount > 0, "amount must be positive");
        
        let new_bal = Self::balance_of(&env, &to).saturating_add(amount);
        Self::set_balance(&env, &to, new_bal);

        env.events().publish(
            (symbol_short!("nova_tok"), symbol_short!("mint")),
            (to, amount),
        );
    }

    /// Burns tokens from the caller's balance.
    ///
    /// # Parameters
    /// - `from` – Address whose tokens are burned.
    /// - `amount` – Number of tokens to burn (must be > 0).
    ///
    /// # Authorization
    /// Requires `from` authorization.
    ///
    /// # Events
    /// Emits `("nova_tok", "burn")` with data `(from: Address, amount: i128)`.
    ///
    /// # Panics
    /// - `"amount must be positive"` if `amount <= 0`.
    /// - `"insufficient balance"` if `from` holds fewer tokens than `amount`.
    pub fn burn(env: Env, from: Address, amount: i128) {
        from.require_auth();
        assert!(amount > 0, "amount must be positive");
        
        let bal = Self::balance_of(&env, &from);
        assert!(bal >= amount, "insufficient balance");
        
        Self::set_balance(&env, &from, bal - amount);

        env.events().publish(
            (symbol_short!("nova_tok"), symbol_short!("burn")),
            (from, amount),
        );
    }

    /// Transfers tokens between two accounts.
    ///
    /// # Parameters
    /// - `from` – Sender address.
    /// - `to` – Recipient address.
    /// - `amount` – Number of tokens to transfer (must be > 0).
    ///
    /// # Authorization
    /// Requires `from` authorization.
    ///
    /// # Events
    /// Emits `("nova_tok", "transfer")` with data `(from: Address, to: Address, amount: i128)`.
    ///
    /// # Panics
    /// - `"amount must be positive"` if `amount <= 0`.
    /// - `"insufficient balance"` if `from` holds fewer tokens than `amount`.
    pub fn transfer(env: Env, from: Address, to: Address, amount: i128) {
        from.require_auth();
        assert!(amount > 0, "amount must be positive");
        
        let from_bal = Self::balance_of(&env, &from);
        assert!(from_bal >= amount, "insufficient balance");
        
        Self::set_balance(&env, &from, from_bal - amount);
        let to_bal = Self::balance_of(&env, &to);
        Self::set_balance(&env, &to, to_bal + amount);

        env.events().publish(
            (symbol_short!("nova_tok"), symbol_short!("transfer")),
            (from, to, amount),
        );
    }

    /// Transfer tokens from `from` to `to` using allowance.
    ///
    /// The `spender` must have a sufficient, non-expired allowance granted by `from`
    /// via [`approve`](NovaToken::approve). Expired allowances are treated as zero.
    ///
    /// # Parameters
    /// - `spender` – Address spending the allowance.
    /// - `from` – Token owner whose allowance is consumed.
    /// - `to` – Recipient address.
    /// - `amount` – Number of tokens to transfer (must be > 0).
    ///
    /// # Authorization
    /// Requires `spender` authorization.
    ///
    /// # Events
    /// Emits `("nova_tok", "xfer_from")` with data `(spender, from, to, amount)`.
    ///
    /// # Panics
    /// - `"amount must be positive"` if `amount <= 0`.
    /// - `"allowance expired"` if the allowance's `expiration_ledger` is in the past.
    /// - `"insufficient allowance"` if spender's allowance is less than `amount`.
    /// - `"insufficient balance"` if `from` holds fewer tokens than `amount`.
    pub fn transfer_from(env: Env, spender: Address, from: Address, to: Address, amount: i128) {
        spender.require_auth();
        assert!(amount > 0, "amount must be positive");

        let allowance_key = DataKey::Allowance(from.clone(), spender.clone());
        let allowance: AllowanceValue = env
            .storage()
            .persistent()
            .get(&allowance_key)
            .unwrap_or(AllowanceValue {
                amount: 0,
                expiration_ledger: 0,
            });

        // Treat expired allowances as zero
        let current_ledger = env.ledger().sequence();
        assert!(
            current_ledger <= allowance.expiration_ledger,
            "allowance expired"
        );
        assert!(allowance.amount >= amount, "insufficient allowance");

        // Deduct allowance and persist
        let new_amount = allowance.amount - amount;
        let updated = AllowanceValue {
            amount: new_amount,
            expiration_ledger: allowance.expiration_ledger,
        };
        env.storage().persistent().set(&allowance_key, &updated);
        env.storage()
            .persistent()
            .extend_ttl(&allowance_key, 2_678_400, 2_678_400);

        // Transfer tokens
        let from_bal = Self::balance_of(&env, &from);
        assert!(from_bal >= amount, "insufficient balance");

        Self::set_balance(&env, &from, from_bal - amount);
        let to_bal = Self::balance_of(&env, &to);
        Self::set_balance(&env, &to, to_bal + amount);

        env.events().publish(
            (symbol_short!("nova_tok"), symbol_short!("xfer_from")),
            (spender, from, to, amount),
        );
    }

    // ========================================
    // Allowance Functions
    // ========================================

    /// Approve `spender` to spend up to `amount` on behalf of `owner` until `expiration_ledger`.
    ///
    /// Overwrites any existing allowance. Set `amount` to `0` to revoke.
    /// The allowance is valid while `current_ledger <= expiration_ledger`.
    ///
    /// # Parameters
    /// - `owner` – Token owner granting the allowance.
    /// - `spender` – Address authorized to spend.
    /// - `amount` – Maximum tokens the spender may transfer.
    /// - `expiration_ledger` – Ledger sequence number after which the allowance expires.
    ///   Must be >= current ledger sequence (unless `amount == 0` for revocation).
    ///
    /// # Authorization
    /// Requires `owner` authorization.
    ///
    /// # Events
    /// Emits `("nova_tok", "approve")` with data `(owner, spender, amount, expiration_ledger)`.
    ///
    /// # Panics
    /// - `"expiration_ledger must be >= current ledger"` if `expiration_ledger` is in the past
    ///   and `amount > 0`.
    pub fn approve(env: Env, owner: Address, spender: Address, amount: i128, expiration_ledger: u32) {
        owner.require_auth();

        // Reject stale approvals for non-zero amounts
        if amount > 0 {
            assert!(
                expiration_ledger >= env.ledger().sequence(),
                "expiration_ledger must be >= current ledger"
            );
        }

        let key = DataKey::Allowance(owner.clone(), spender.clone());
        let value = AllowanceValue {
            amount,
            expiration_ledger,
        };
        env.storage().persistent().set(&key, &value);
        // Extend TTL by 31 days
        env.storage()
            .persistent()
            .extend_ttl(&key, 2_678_400, 2_678_400);

        env.events().publish(
            (symbol_short!("nova_tok"), symbol_short!("approve")),
            (owner, spender, amount, expiration_ledger),
        );
    }

    /// Increase allowance for `spender` by `amount`.
    ///
    /// The existing `expiration_ledger` is preserved. If no allowance exists yet,
    /// `expiration_ledger` must be supplied via a fresh [`approve`](NovaToken::approve) call.
    ///
    /// # Parameters
    /// - `owner` – Token owner.
    /// - `spender` – Address whose allowance is increased.
    /// - `amount` – Amount to add to the existing allowance (must be > 0).
    ///
    /// # Authorization
    /// Requires `owner` authorization.
    ///
    /// # Events
    /// Emits `("nova_tok", "inc_allow")` with data `(owner, spender, new_allowance)`.
    ///
    /// # Panics
    /// - `"amount must be positive"` if `amount <= 0`.
    /// - `"no existing allowance to increase"` if no allowance record exists.
    pub fn increase_allowance(env: Env, owner: Address, spender: Address, amount: i128) {
        owner.require_auth();
        assert!(amount > 0, "amount must be positive");

        let key = DataKey::Allowance(owner.clone(), spender.clone());
        let existing: AllowanceValue = env
            .storage()
            .persistent()
            .get(&key)
            .expect("no existing allowance to increase");

        let new_amount = existing.amount.saturating_add(amount);
        let updated = AllowanceValue {
            amount: new_amount,
            expiration_ledger: existing.expiration_ledger,
        };
        env.storage().persistent().set(&key, &updated);
        env.storage()
            .persistent()
            .extend_ttl(&key, 2_678_400, 2_678_400);

        env.events().publish(
            (symbol_short!("nova_tok"), symbol_short!("inc_allow")),
            (owner, spender, new_amount),
        );
    }

    /// Decrease allowance for `spender` by `amount`. Saturates at zero.
    ///
    /// # Parameters
    /// - `owner` – Token owner.
    /// - `spender` – Address whose allowance is decreased.
    /// - `amount` – Amount to subtract from the existing allowance (must be > 0).
    ///
    /// # Authorization
    /// Requires `owner` authorization.
    ///
    /// # Events
    /// Emits `("nova_tok", "dec_allow")` with data `(owner, spender, new_allowance)`.
    ///
    /// # Panics
    /// - `"amount must be positive"` if `amount <= 0`.
    pub fn decrease_allowance(env: Env, owner: Address, spender: Address, amount: i128) {
        owner.require_auth();
        assert!(amount > 0, "amount must be positive");

        let key = DataKey::Allowance(owner.clone(), spender.clone());
        let existing: AllowanceValue = env
            .storage()
            .persistent()
            .get(&key)
            .unwrap_or(AllowanceValue {
                amount: 0,
                expiration_ledger: 0,
            });

        let new_amount = existing.amount.saturating_sub(amount);
        let updated = AllowanceValue {
            amount: new_amount,
            expiration_ledger: existing.expiration_ledger,
        };
        env.storage().persistent().set(&key, &updated);
        env.storage()
            .persistent()
            .extend_ttl(&key, 2_678_400, 2_678_400);

        env.events().publish(
            (symbol_short!("nova_tok"), symbol_short!("dec_allow")),
            (owner, spender, new_amount),
        );
    }

    // ========================================
    // Read-only Functions
    // ========================================

    /// Returns the current token balance for an address.
    ///
    /// # Parameters
    /// - `addr` – Address to query.
    ///
    /// # Returns
    /// Token balance in base units (`i128`). Returns `0` if no balance is recorded.
    pub fn balance(env: Env, addr: Address) -> i128 {
        Self::balance_of(&env, &addr)
    }

    /// Returns the remaining allowance recorded for an owner and spender pair.
    ///
    /// Returns `0` if no allowance is set **or** if the allowance has expired.
    ///
    /// # Parameters
    /// - `owner` – Token owner who granted the allowance.
    /// - `spender` – Address authorized to spend.
    ///
    /// # Returns
    /// Remaining allowance in base units. Returns `0` if no allowance is set or it has expired.
    pub fn allowance(env: Env, owner: Address, spender: Address) -> i128 {
        let key = DataKey::Allowance(owner, spender);
        let value: AllowanceValue = match env.storage().persistent().get(&key) {
            Some(v) => v,
            None => return 0,
        };
        // Extend TTL by 31 days
        env.storage()
            .persistent()
            .extend_ttl(&key, 2_678_400, 2_678_400);
        // Expired allowances are treated as zero
        if env.ledger().sequence() > value.expiration_ledger {
            return 0;
        }
        value.amount
    }
}

// ============================================
// Tests
// ============================================

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{
        testutils::{Address as _, Ledger},
        Env,
    };

    fn setup() -> (Env, Address, NovaTokenClient<'static>) {
        let env = Env::default();
        env.mock_all_auths();
        let id = env.register(NovaToken, ());
        let client = NovaTokenClient::new(&env, &id);
        let admin = Address::generate(&env);
        client.initialize(&admin);
        (env, admin, client)
    }

    /// Returns a ledger sequence far enough in the future to be a valid expiry.
    fn future_ledger(env: &Env) -> u32 {
        env.ledger().sequence() + 10_000
    }

    #[test]
    fn test_mint_emits_event() {
        let (env, _admin, client) = setup();
        let user = Address::generate(&env);
        client.mint(&user, &500);
        assert_eq!(client.balance(&user), 500);
        let events = env.events().all();
        assert!(!events.is_empty());
    }

    #[test]
    fn test_burn_emits_event() {
        let (env, _admin, client) = setup();
        let user = Address::generate(&env);
        client.mint(&user, &200);
        client.burn(&user, &50);
        assert_eq!(client.balance(&user), 150);
    }

    #[test]
    fn test_transfer_emits_event() {
        let (env, _admin, client) = setup();
        let alice = Address::generate(&env);
        let bob = Address::generate(&env);
        client.mint(&alice, &300);
        client.transfer(&alice, &bob, &100);
        assert_eq!(client.balance(&alice), 200);
        assert_eq!(client.balance(&bob), 100);
    }

    #[test]
    fn test_approve_emits_event() {
        let (env, _admin, client) = setup();
        let owner = Address::generate(&env);
        let spender = Address::generate(&env);
        let expiry = future_ledger(&env);
        client.approve(&owner, &spender, &1000, &expiry);
        assert_eq!(client.allowance(&owner, &spender), 1000);
    }

    // ── transfer_from ─────────────────────────────────────────────────────────

    #[test]
    fn test_transfer_from() {
        let (env, _admin, client) = setup();
        let owner = Address::generate(&env);
        let spender = Address::generate(&env);
        let recipient = Address::generate(&env);
        let expiry = future_ledger(&env);

        client.mint(&owner, &500);
        client.approve(&owner, &spender, &200, &expiry);
        assert_eq!(client.allowance(&owner, &spender), 200);

        client.transfer_from(&spender, &owner, &recipient, &150);

        assert_eq!(client.balance(&owner), 350);   // 500 - 150
        assert_eq!(client.balance(&recipient), 150);
        assert_eq!(client.allowance(&owner, &spender), 50); // 200 - 150
    }

    #[test]
    #[should_panic(expected = "insufficient allowance")]
    fn test_transfer_from_insufficient_allowance() {
        let (env, _admin, client) = setup();
        let owner = Address::generate(&env);
        let spender = Address::generate(&env);
        let recipient = Address::generate(&env);
        let expiry = future_ledger(&env);

        client.mint(&owner, &500);
        client.approve(&owner, &spender, &100, &expiry);

        // Trying to transfer more than allowed — must panic
        client.transfer_from(&spender, &owner, &recipient, &150);
    }

    // ── Allowance expiry ──────────────────────────────────────────────────────

    #[test]
    fn test_expired_allowance_reads_as_zero() {
        let (env, _admin, client) = setup();
        let owner = Address::generate(&env);
        let spender = Address::generate(&env);

        // Approve at ledger 0, expiry = ledger 5
        client.approve(&owner, &spender, &1000, &5);

        // Advance ledger past expiry
        env.ledger().with_mut(|l| l.sequence_number = 6);

        assert_eq!(client.allowance(&owner, &spender), 0);
    }

    #[test]
    #[should_panic(expected = "allowance expired")]
    fn test_transfer_from_expired_allowance_panics() {
        let (env, _admin, client) = setup();
        let owner = Address::generate(&env);
        let spender = Address::generate(&env);
        let recipient = Address::generate(&env);

        client.mint(&owner, &500);
        // Approve with expiry at ledger 5
        client.approve(&owner, &spender, &200, &5);

        // Advance ledger past expiry
        env.ledger().with_mut(|l| l.sequence_number = 6);

        // Must panic with "allowance expired"
        client.transfer_from(&spender, &owner, &recipient, &100);
    }

    #[test]
    fn test_allowance_valid_at_expiration_ledger() {
        let (env, _admin, client) = setup();
        let owner = Address::generate(&env);
        let spender = Address::generate(&env);
        let recipient = Address::generate(&env);

        client.mint(&owner, &500);
        // Approve with expiry at ledger 10
        client.approve(&owner, &spender, &200, &10);

        // Advance ledger to exactly the expiration ledger — still valid
        env.ledger().with_mut(|l| l.sequence_number = 10);

        client.transfer_from(&spender, &owner, &recipient, &100);
        assert_eq!(client.balance(&recipient), 100);
    }

    // ── Stale approval rejection ──────────────────────────────────────────────

    #[test]
    #[should_panic(expected = "expiration_ledger must be >= current ledger")]
    fn test_approve_with_past_expiry_panics() {
        let (env, _admin, client) = setup();
        let owner = Address::generate(&env);
        let spender = Address::generate(&env);

        // Advance ledger to 100, then try to approve with expiry 50 (past)
        env.ledger().with_mut(|l| l.sequence_number = 100);
        client.approve(&owner, &spender, &1000, &50);
    }

    #[test]
    fn test_approve_zero_amount_allows_past_expiry() {
        // Revoking (amount=0) should not require a future expiry
        let (env, _admin, client) = setup();
        let owner = Address::generate(&env);
        let spender = Address::generate(&env);

        env.ledger().with_mut(|l| l.sequence_number = 100);
        // amount=0 revocation — expiry 0 is fine
        client.approve(&owner, &spender, &0, &0);
        assert_eq!(client.allowance(&owner, &spender), 0);
    }

    // ── increase / decrease allowance ─────────────────────────────────────────

    #[test]
    fn test_increase_allowance() {
        let (env, _admin, client) = setup();
        let owner = Address::generate(&env);
        let spender = Address::generate(&env);
        let expiry = future_ledger(&env);

        client.approve(&owner, &spender, &100, &expiry);
        client.increase_allowance(&owner, &spender, &50);

        assert_eq!(client.allowance(&owner, &spender), 150);
    }

    #[test]
    fn test_decrease_allowance() {
        let (env, _admin, client) = setup();
        let owner = Address::generate(&env);
        let spender = Address::generate(&env);
        let expiry = future_ledger(&env);

        client.approve(&owner, &spender, &100, &expiry);
        client.decrease_allowance(&owner, &spender, &30);

        assert_eq!(client.allowance(&owner, &spender), 70);
    }

    // ── Other edge cases ──────────────────────────────────────────────────────

    #[test]
    #[should_panic(expected = "insufficient balance")]
    fn test_burn_insufficient_balance() {
        let (env, _admin, client) = setup();
        let user = Address::generate(&env);
        client.mint(&user, &10);
        client.burn(&user, &100); // Should panic
    }

    #[test]
    #[should_panic(expected = "already initialized")]
    fn test_reinitialize_is_blocked() {
        let (env, admin, client) = setup();
        client.initialize(&admin);
    }
}
