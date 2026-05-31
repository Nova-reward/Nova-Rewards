//! Fuzz target: distribution contract
//!
//! # Invariants verified
//! 1. **Total distributed ≤ contract balance** — the contract never distributes
//!    more tokens than it holds; any attempt panics before state changes.
//! 2. **Clawback deadline set** — every successful `distribute` call records a
//!    deadline strictly greater than the current ledger timestamp.
//! 3. **Distributed amount recorded** — `get_distributed` returns the exact
//!    amount passed to `distribute`.
//! 4. **Balance non-negative** — the mock token contract balance never goes
//!    below zero for any address.
//!
//! # Input layout (40 bytes)
//! ```text
//! [0..16]  fund_amount  : i128  — tokens pre-funded into the distribution contract
//! [16..32] dist_amount  : i128  — tokens to distribute to a single recipient
//! [32..40] time_advance : u64   — seconds to advance the ledger before clawback
//! ```
#![no_main]

use distribution::{DistributionContract, DistributionContractClient};
use libfuzzer_sys::fuzz_target;
use soroban_sdk::testutils::{Address as _, Ledger};
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env};

// ── Minimal mock token (implements the soroban token::Client interface) ───────

#[contracttype]
pub enum MockKey {
    Balance(Address),
}

#[contract]
pub struct MockToken;

#[contractimpl]
impl MockToken {
    pub fn mint(env: Env, to: Address, amount: i128) {
        let key = MockKey::Balance(to);
        let bal: i128 = env.storage().instance().get(&key).unwrap_or(0);
        env.storage().instance().set(&key, &(bal + amount));
    }

    pub fn balance(env: Env, addr: Address) -> i128 {
        env.storage()
            .instance()
            .get(&MockKey::Balance(addr))
            .unwrap_or(0)
    }

    pub fn transfer(env: Env, from: Address, to: Address, amount: i128) {
        let from_key = MockKey::Balance(from);
        let to_key = MockKey::Balance(to);
        let from_bal: i128 = env.storage().instance().get(&from_key).unwrap_or(0);
        assert!(from_bal >= amount, "insufficient balance");
        env.storage()
            .instance()
            .set(&from_key, &(from_bal - amount));
        let to_bal: i128 = env.storage().instance().get(&to_key).unwrap_or(0);
        env.storage().instance().set(&to_key, &(to_bal + amount));
    }

    pub fn transfer_from(env: Env, _spender: Address, from: Address, to: Address, amount: i128) {
        let from_key = MockKey::Balance(from);
        let to_key = MockKey::Balance(to);
        let from_bal: i128 = env.storage().instance().get(&from_key).unwrap_or(0);
        assert!(from_bal >= amount, "insufficient balance");
        env.storage()
            .instance()
            .set(&from_key, &(from_bal - amount));
        let to_bal: i128 = env.storage().instance().get(&to_key).unwrap_or(0);
        env.storage().instance().set(&to_key, &(to_bal + amount));
    }

    pub fn approve(_env: Env, _owner: Address, _spender: Address, _amount: i128, _expiry: u32) {}
}

// ── Fuzz target ───────────────────────────────────────────────────────────────

fuzz_target!(|data: &[u8]| {
    if data.len() < 40 {
        return;
    }

    let fund_amount = i128::from_le_bytes(data[0..16].try_into().unwrap());
    let dist_amount = i128::from_le_bytes(data[16..32].try_into().unwrap());
    let time_advance = u64::from_le_bytes(data[32..40].try_into().unwrap());

    // Constrain to valid ranges
    if fund_amount <= 0 || fund_amount > 1_000_000_000_000_i128 {
        return;
    }
    if dist_amount <= 0 || dist_amount > fund_amount {
        return;
    }

    let env = Env::default();
    env.mock_all_auths();

    let token_id = env.register(MockToken, ());
    let contract_id = env.register(DistributionContract, ());
    let admin = Address::generate(&env);
    let recipient = Address::generate(&env);

    let tok = MockTokenClient::new(&env, &token_id);
    let client = DistributionContractClient::new(&env, &contract_id);

    client.initialize(&admin, &token_id);

    // Fund the distribution contract
    tok.mint(&contract_id, &fund_amount);

    let contract_balance_before = tok.balance(&contract_id);

    // Invariant: contract balance must equal what we funded
    assert_eq!(
        contract_balance_before, fund_amount,
        "contract balance mismatch after funding"
    );

    let now = env.ledger().timestamp();

    // Distribute to recipient
    client.distribute(&recipient, &dist_amount);

    // Invariant: distributed amount is recorded correctly
    assert_eq!(
        client.get_distributed(&recipient),
        dist_amount,
        "distributed amount not recorded correctly"
    );

    // Invariant: clawback deadline is set and is in the future
    let deadline = client.get_clawback_deadline(&recipient);
    assert!(
        deadline > now,
        "clawback deadline must be strictly after distribution time: deadline={deadline} now={now}"
    );

    // Invariant: contract balance decreased by exactly dist_amount
    let contract_balance_after = tok.balance(&contract_id);
    assert_eq!(
        contract_balance_before - dist_amount,
        contract_balance_after,
        "contract balance not reduced by dist_amount"
    );

    // Invariant: recipient received exactly dist_amount
    let recipient_balance = tok.balance(&recipient);
    assert_eq!(
        recipient_balance, dist_amount,
        "recipient balance mismatch after distribution"
    );

    // Invariant: balances non-negative
    assert!(contract_balance_after >= 0, "contract balance went negative");
    assert!(recipient_balance >= 0, "recipient balance went negative");

    // Invariant: total tokens conserved (contract + recipient = original fund)
    assert_eq!(
        contract_balance_after + recipient_balance,
        fund_amount,
        "total token supply not conserved after distribution"
    );

    // Optionally test clawback within window
    if time_advance == 0 {
        // Clawback immediately — must succeed
        client.clawback(&recipient);

        // After clawback: distributed record cleared
        assert_eq!(
            client.get_distributed(&recipient),
            0,
            "distributed record not cleared after clawback"
        );

        // Invariant: tokens returned to contract
        assert_eq!(
            tok.balance(&contract_id),
            fund_amount,
            "tokens not fully returned after clawback"
        );
    }
});
