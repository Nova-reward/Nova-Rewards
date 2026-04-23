#![cfg(test)]

//! Tests for the Merkle-based Nova token claim feature.
//!
//! Tree construction (2-leaf example used in most tests):
//!
//!   leaf_a = SHA-256(addr_a_bytes ++ amount_a_le)
//!   leaf_b = SHA-256(addr_b_bytes ++ amount_b_le)
//!   root   = SHA-256(min(leaf_a, leaf_b) ++ max(leaf_a, leaf_b))
//!
//! The proof for leaf_a is [leaf_b], and vice-versa.

use soroban_sdk::{
    contract, contractimpl,
    testutils::{Address as _, Events},
    Address, Bytes, BytesN, Env, IntoVal, Symbol, TryIntoVal, Vec,
};

use reward_pool::{ClaimError, RewardPoolContract, RewardPoolContractClient};

// ---------------------------------------------------------------------------
// Minimal Nova token mock
// ---------------------------------------------------------------------------
// We need a real contract so cross-contract calls work in the test env.

#[contract]
pub struct MockNovaToken;

#[contractimpl]
impl MockNovaToken {
    pub fn initialize(env: Env, admin: Address) {
        env.storage().instance().set(&Symbol::new(&env, "admin"), &admin);
    }

    pub fn mint(env: Env, to: Address, amount: i128) {
        let bal = Self::balance(env.clone(), to.clone());
        env.storage()
            .instance()
            .set(&to.clone().to_xdr(&env), &(bal + amount));
    }

    pub fn balance(env: Env, addr: Address) -> i128 {
        env.storage()
            .instance()
            .get::<_, i128>(&addr.clone().to_xdr(&env))
            .unwrap_or(0)
    }

    pub fn transfer(env: Env, from: Address, to: Address, amount: i128) {
        let from_bal = Self::balance(env.clone(), from.clone());
        assert!(from_bal >= amount, "insufficient balance");
        env.storage()
            .instance()
            .set(&from.clone().to_xdr(&env), &(from_bal - amount));
        let to_bal = Self::balance(env.clone(), to.clone());
        env.storage()
            .instance()
            .set(&to.clone().to_xdr(&env), &(to_bal + amount));
    }
}

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/// Computes the leaf hash the same way the contract does:
/// `SHA-256(address_xdr_bytes ++ amount_le_16_bytes)`
fn compute_leaf(env: &Env, claimer: &Address, amount: i128) -> BytesN<32> {
    let mut preimage = Bytes::new(env);
    preimage.append(&claimer.clone().to_xdr(env));
    preimage.append(&Bytes::from_slice(env, &amount.to_le_bytes()));
    env.crypto().sha256(&preimage)
}

/// Hashes two nodes in sorted order (mirrors `hash_pair` in the contract).
fn hash_pair(env: &Env, a: BytesN<32>, b: BytesN<32>) -> BytesN<32> {
    let mut buf = Bytes::new(env);
    if a.as_ref() <= b.as_ref() {
        buf.append(&a.into());
        buf.append(&b.into());
    } else {
        buf.append(&b.into());
        buf.append(&a.into());
    }
    env.crypto().sha256(&buf)
}

struct TestSetup {
    env: Env,
    pool: RewardPoolContractClient<'static>,
    token_id: Address,
    /// Address entitled to claim `amount_a` tokens.
    claimer_a: Address,
    amount_a: i128,
    /// Proof for claimer_a (= [leaf_b]).
    proof_a: Vec<BytesN<32>>,
    /// Address entitled to claim `amount_b` tokens.
    claimer_b: Address,
    amount_b: i128,
    /// Proof for claimer_b (= [leaf_a]).
    proof_b: Vec<BytesN<32>>,
}

fn setup() -> TestSetup {
    let env = Env::default();
    env.mock_all_auths();

    // Deploy mock Nova token
    let token_id = env.register_contract(None, MockNovaToken);
    let admin = Address::generate(&env);
    let _: () = env.invoke_contract(
        &token_id,
        &Symbol::new(&env, "initialize"),
        soroban_sdk::vec![&env, admin.to_val()],
    );

    // Generate two claimers with fixed amounts
    let claimer_a = Address::generate(&env);
    let amount_a: i128 = 1_000;
    let claimer_b = Address::generate(&env);
    let amount_b: i128 = 2_500;

    // Build 2-leaf Merkle tree
    let leaf_a = compute_leaf(&env, &claimer_a, amount_a);
    let leaf_b = compute_leaf(&env, &claimer_b, amount_b);
    let root = hash_pair(&env, leaf_a.clone(), leaf_b.clone());

    // Proofs
    let mut proof_a: Vec<BytesN<32>> = Vec::new(&env);
    proof_a.push_back(leaf_b.clone());

    let mut proof_b: Vec<BytesN<32>> = Vec::new(&env);
    proof_b.push_back(leaf_a.clone());

    // Deploy reward pool
    let pool_id = env.register_contract(None, RewardPoolContract);
    let pool = RewardPoolContractClient::new(&env, &pool_id);
    pool.initialize(&admin, &token_id, &root);

    // Fund the pool with enough Nova tokens
    let _: () = env.invoke_contract(
        &token_id,
        &Symbol::new(&env, "mint"),
        soroban_sdk::vec![&env, pool_id.to_val(), 100_000_i128.into_val(&env)],
    );

    TestSetup {
        env,
        pool,
        token_id,
        claimer_a,
        amount_a,
        proof_a,
        claimer_b,
        amount_b,
        proof_b,
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

/// Happy path: valid proof → tokens transferred, event emitted, flag set.
#[test]
fn test_valid_claim_transfers_tokens_and_emits_event() {
    let TestSetup {
        env,
        pool,
        token_id,
        claimer_a,
        amount_a,
        proof_a,
        ..
    } = setup();

    // Pre-conditions
    assert!(!pool.is_claimed(&claimer_a));

    // Execute claim
    pool.claim(&claimer_a, &amount_a, &proof_a);

    // Claimer received tokens
    let claimer_balance: i128 = env.invoke_contract(
        &token_id,
        &Symbol::new(&env, "balance"),
        soroban_sdk::vec![&env, claimer_a.to_val()],
    );
    assert_eq!(claimer_balance, amount_a);

    // Claimed flag is set
    assert!(pool.is_claimed(&claimer_a));

    // Event was emitted
    let events = env.events().all();
    let claim_event = events.iter().find(|(_, topics, _)| {
        topics
            .first()
            .and_then(|v| v.clone().try_into_val::<_, Symbol>(&env).ok())
            .map(|s| s == Symbol::new(&env, "rwd_pool"))
            .unwrap_or(false)
            && topics
                .get(1)
                .and_then(|v| v.clone().try_into_val::<_, Symbol>(&env).ok())
                .map(|s| s == Symbol::new(&env, "claimed"))
                .unwrap_or(false)
    });
    assert!(claim_event.is_some(), "claimed event not emitted");

    // Event data: (claimer, amount)
    let (_, _, data) = claim_event.unwrap();
    let (emitted_claimer, emitted_amount): (Address, i128) = data.into_val(&env);
    assert_eq!(emitted_claimer, claimer_a);
    assert_eq!(emitted_amount, amount_a);
}

/// Second claim by the same wallet must return `AlreadyClaimed`.
#[test]
fn test_duplicate_claim_returns_already_claimed() {
    let TestSetup {
        env: _,
        pool,
        claimer_a,
        amount_a,
        proof_a,
        ..
    } = setup();

    // First claim succeeds
    pool.claim(&claimer_a, &amount_a, &proof_a);
    assert!(pool.is_claimed(&claimer_a));

    // Second claim must fail with AlreadyClaimed
    let result = pool.try_claim(&claimer_a, &amount_a, &proof_a);
    assert_eq!(result, Err(Ok(ClaimError::AlreadyClaimed)));
}

/// A proof built for a different leaf must return `InvalidProof`.
#[test]
fn test_invalid_proof_returns_invalid_proof() {
    let TestSetup {
        env: _,
        pool,
        claimer_a,
        amount_a,
        proof_b, // wrong proof — belongs to claimer_b
        ..
    } = setup();

    let result = pool.try_claim(&claimer_a, &amount_a, &proof_b);
    assert_eq!(result, Err(Ok(ClaimError::InvalidProof)));

    // Claimed flag must NOT be set after a failed attempt
    assert!(!pool.is_claimed(&claimer_a));
}

/// Tampered amount (correct address, wrong amount) must return `InvalidProof`.
#[test]
fn test_tampered_amount_returns_invalid_proof() {
    let TestSetup {
        env: _,
        pool,
        claimer_a,
        amount_a,
        proof_a,
        ..
    } = setup();

    // Use a different amount than what was committed in the tree
    let wrong_amount = amount_a + 1;
    let result = pool.try_claim(&claimer_a, &wrong_amount, &proof_a);
    assert_eq!(result, Err(Ok(ClaimError::InvalidProof)));
}

/// Pool with zero Nova token balance must return `InsufficientPoolBalance`.
#[test]
fn test_insufficient_pool_balance_returns_error() {
    let env = Env::default();
    env.mock_all_auths();

    // Deploy token but do NOT mint anything to the pool
    let token_id = env.register_contract(None, MockNovaToken);
    let admin = Address::generate(&env);
    let _: () = env.invoke_contract(
        &token_id,
        &Symbol::new(&env, "initialize"),
        soroban_sdk::vec![&env, admin.to_val()],
    );

    let claimer = Address::generate(&env);
    let amount: i128 = 500;

    let leaf = compute_leaf(&env, &claimer, amount);
    // Single-leaf tree: root == leaf, empty proof
    let root = leaf.clone();
    let proof: Vec<BytesN<32>> = Vec::new(&env);

    let pool_id = env.register_contract(None, RewardPoolContract);
    let pool = RewardPoolContractClient::new(&env, &pool_id);
    pool.initialize(&admin, &token_id, &root);

    // Pool has 0 balance — claim must fail
    let result = pool.try_claim(&claimer, &amount, &proof);
    assert_eq!(result, Err(Ok(ClaimError::InsufficientPoolBalance)));
}

/// Both claimers in the tree can each claim exactly once.
#[test]
fn test_both_claimers_can_claim_independently() {
    let TestSetup {
        env,
        pool,
        token_id,
        claimer_a,
        amount_a,
        proof_a,
        claimer_b,
        amount_b,
        proof_b,
    } = setup();

    pool.claim(&claimer_a, &amount_a, &proof_a);
    pool.claim(&claimer_b, &amount_b, &proof_b);

    let bal_a: i128 = env.invoke_contract(
        &token_id,
        &Symbol::new(&env, "balance"),
        soroban_sdk::vec![&env, claimer_a.to_val()],
    );
    let bal_b: i128 = env.invoke_contract(
        &token_id,
        &Symbol::new(&env, "balance"),
        soroban_sdk::vec![&env, claimer_b.to_val()],
    );

    assert_eq!(bal_a, amount_a);
    assert_eq!(bal_b, amount_b);
    assert!(pool.is_claimed(&claimer_a));
    assert!(pool.is_claimed(&claimer_b));
}
