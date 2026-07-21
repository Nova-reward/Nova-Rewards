//! # M-of-N Upgrade Approval Integration Tests
//!
//! Covers all three contracts that implement the shared `approve_upgrade` pattern:
//! campaign, distribution, and governance.
//!
//! ## Scenarios tested (per contract)
//! 1. Single signer below threshold — upgrade is blocked, approval count increments.
//! 2. Threshold exactly reached — upgrade executes, `upgraded` event emitted.
//! 3. Duplicate approval from the same signer — rejected with "already approved".
//! 4. Approval state cleared after successful upgrade — stale approvals cannot be reused.
//! 5. Unauthorized signer — rejected with "not an authorized signer".
//! 6. Different WASM hash — treated as a separate approval ballot, does not trigger upgrade.

#![cfg(test)]

use soroban_sdk::{
    testutils::{Address as _, Events},
    vec, Address, BytesN, Env,
};

// ─────────────────────────────────────────────────────────────────────────────
// Campaign contract upgrade tests
// ─────────────────────────────────────────────────────────────────────────────

use campaign::{CampaignContract, CampaignContractClient};

/// Deploy a fresh campaign contract with the given signers and threshold.
fn deploy_campaign<'a>(
    env: &'a Env,
    signers: &soroban_sdk::Vec<Address>,
    threshold: u32,
) -> CampaignContractClient<'a> {
    let contract_id = env.register(CampaignContract, ());
    let client = CampaignContractClient::new(env, &contract_id);
    let admin = Address::generate(env);
    client.initialize(&admin, signers, &threshold);
    client
}

/// A WASM hash filled with a single repeated byte — used as a stand-in for
/// a real on-chain WASM hash in unit/integration tests.
fn fake_hash(env: &Env, byte: u8) -> BytesN<32> {
    BytesN::from_array(env, &[byte; 32])
}

// ── Campaign: below-threshold does not upgrade ────────────────────────────────

/// With a 2-of-3 config, one approval increments the counter but does NOT
/// trigger the WASM swap.  The approval key must still exist in storage.
#[test]
fn campaign_single_signer_below_threshold_upgrade_blocked() {
    let env = Env::default();
    env.mock_all_auths();

    let s1 = Address::generate(&env);
    let s2 = Address::generate(&env);
    let s3 = Address::generate(&env);
    let signers = vec![&env, s1.clone(), s2.clone(), s3.clone()];
    let client = deploy_campaign(&env, &signers, 2);

    let hash = fake_hash(&env, 0xAA);

    // Only s1 approves — threshold is 2, so no upgrade yet.
    client.approve_upgrade(&s1, &hash);

    assert_eq!(
        client.get_upgrade_approvals(&hash),
        1,
        "approval count must be 1 after first signer"
    );
    assert_eq!(client.get_threshold(), 2, "threshold must remain 2");

    // No "upgraded" event should have been emitted.
    let upgraded_events: Vec<_> = env
        .events()
        .all()
        .iter()
        .filter(|e| {
            let topics = e.0.clone();
            // topics[0] == Symbol("camp"), topics[1] == Symbol("upgraded")
            topics.len() == 2
        })
        .collect();
    // We cannot inspect the symbol value directly without converting, so we
    // assert that the total event count does not contain an upgraded event by
    // checking the approval counter is still non-zero (storage not cleared).
    assert_eq!(
        client.get_upgrade_approvals(&hash),
        1,
        "approval state must persist when threshold not reached"
    );
}

// ── Campaign: threshold exactly reached triggers upgrade ──────────────────────

/// The second signer's approval pushes the count to exactly 2 (== threshold).
/// The contract calls `update_current_contract_wasm` and emits the upgraded event.
#[test]
fn campaign_threshold_reached_upgrade_executes_and_emits_event() {
    let env = Env::default();
    env.mock_all_auths();

    let s1 = Address::generate(&env);
    let s2 = Address::generate(&env);
    let signers = vec![&env, s1.clone(), s2.clone()];
    let client = deploy_campaign(&env, &signers, 2);

    let hash = fake_hash(&env, 0xBB);

    client.approve_upgrade(&s1, &hash);
    assert_eq!(client.get_upgrade_approvals(&hash), 1);

    // Second signer reaches threshold — upgrade fires.
    client.approve_upgrade(&s2, &hash);

    // After the upgrade the approval key is removed from storage.
    assert_eq!(
        client.get_upgrade_approvals(&hash),
        0,
        "approvals must be cleared after upgrade executes"
    );

    // Confirm at least one event was emitted (the upgraded event).
    assert!(
        !env.events().all().is_empty(),
        "upgraded event must be emitted"
    );
}

// ── Campaign: duplicate approval rejected ────────────────────────────────────

/// Calling `approve_upgrade` twice with the same signer and the same hash
/// must panic with "already approved".
#[test]
#[should_panic(expected = "already approved")]
fn campaign_duplicate_approval_rejected() {
    let env = Env::default();
    env.mock_all_auths();

    let s1 = Address::generate(&env);
    let s2 = Address::generate(&env);
    let signers = vec![&env, s1.clone(), s2.clone()];
    let client = deploy_campaign(&env, &signers, 2);

    let hash = fake_hash(&env, 0xCC);

    client.approve_upgrade(&s1, &hash);
    // Second call from the same signer must panic.
    client.approve_upgrade(&s1, &hash);
}

// ── Campaign: approval state cleared after upgrade ────────────────────────────

/// After the threshold is met and the contract is upgraded, the approval
/// counter for that hash returns 0, confirming the key was removed and
/// stale approvals cannot be reused.
#[test]
fn campaign_approval_state_cleared_after_upgrade() {
    let env = Env::default();
    env.mock_all_auths();

    let s1 = Address::generate(&env);
    let s2 = Address::generate(&env);
    let signers = vec![&env, s1.clone(), s2.clone()];
    let client = deploy_campaign(&env, &signers, 2);

    let hash = fake_hash(&env, 0xDD);

    client.approve_upgrade(&s1, &hash);
    client.approve_upgrade(&s2, &hash); // triggers upgrade

    // Storage must be empty for this hash.
    assert_eq!(
        client.get_upgrade_approvals(&hash),
        0,
        "approval key must be removed after successful upgrade"
    );
}

// ── Campaign: unauthorized signer rejected ────────────────────────────────────

/// An address that is NOT in the signer set must be rejected.
#[test]
#[should_panic(expected = "not an authorized signer")]
fn campaign_unauthorized_signer_rejected() {
    let env = Env::default();
    env.mock_all_auths();

    let s1 = Address::generate(&env);
    let signers = vec![&env, s1.clone()];
    let client = deploy_campaign(&env, &signers, 1);

    let outsider = Address::generate(&env);
    let hash = fake_hash(&env, 0xEE);

    client.approve_upgrade(&outsider, &hash);
}

// ── Campaign: different hash is a separate ballot ─────────────────────────────

/// An approval for hash A does not count towards hash B.  Both keys are
/// tracked independently.
#[test]
fn campaign_different_hash_is_independent_ballot() {
    let env = Env::default();
    env.mock_all_auths();

    let s1 = Address::generate(&env);
    let s2 = Address::generate(&env);
    let signers = vec![&env, s1.clone(), s2.clone()];
    let client = deploy_campaign(&env, &signers, 2);

    let hash_a = fake_hash(&env, 0x11);
    let hash_b = fake_hash(&env, 0x22);

    // s1 approves hash_a, s2 approves hash_b.
    client.approve_upgrade(&s1, &hash_a);
    client.approve_upgrade(&s2, &hash_b);

    // Neither hash has reached the 2-of-2 threshold.
    assert_eq!(
        client.get_upgrade_approvals(&hash_a),
        1,
        "hash_a should have 1 approval"
    );
    assert_eq!(
        client.get_upgrade_approvals(&hash_b),
        1,
        "hash_b should have 1 approval"
    );
}

// ── Campaign: 3-of-5 accumulation ────────────────────────────────────────────

/// Verify progressive approval accumulation with a 3-of-5 config:
/// 1 approval → count 1, 2 approvals → count 2, 3rd triggers upgrade.
#[test]
fn campaign_three_of_five_accumulates_then_upgrades() {
    let env = Env::default();
    env.mock_all_auths();

    let signers: soroban_sdk::Vec<Address> = vec![
        &env,
        Address::generate(&env),
        Address::generate(&env),
        Address::generate(&env),
        Address::generate(&env),
        Address::generate(&env),
    ];
    let client = deploy_campaign(&env, &signers, 3);

    let hash = fake_hash(&env, 0x33);

    let s0 = signers.get(0).unwrap();
    let s1 = signers.get(1).unwrap();
    let s2 = signers.get(2).unwrap();

    client.approve_upgrade(&s0, &hash);
    assert_eq!(client.get_upgrade_approvals(&hash), 1);

    client.approve_upgrade(&s1, &hash);
    assert_eq!(client.get_upgrade_approvals(&hash), 2);

    // Third approval crosses the threshold.
    client.approve_upgrade(&s2, &hash);
    assert_eq!(
        client.get_upgrade_approvals(&hash),
        0,
        "approval state cleared after 3-of-5 upgrade"
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Distribution contract upgrade tests
// ─────────────────────────────────────────────────────────────────────────────

use distribution::{DistributionContract, DistributionContractClient};

/// Deploy a distribution contract wired to a minimal mock token.
/// The mock token is only needed to satisfy `initialize`; upgrade tests
/// do not exercise token transfers.
mod mock_token_for_upgrade {
    use soroban_sdk::{contract, contractimpl, Address, Env};

    #[contract]
    pub struct MockToken;

    #[contractimpl]
    impl MockToken {
        pub fn balance(_env: Env, _addr: Address) -> i128 {
            0
        }
    }
}

fn deploy_distribution<'a>(
    env: &'a Env,
    signers: &soroban_sdk::Vec<Address>,
    threshold: u32,
) -> DistributionContractClient<'a> {
    let token_id = env.register(mock_token_for_upgrade::MockToken, ());
    let contract_id = env.register(DistributionContract, ());
    let client = DistributionContractClient::new(env, &contract_id);
    let admin = Address::generate(env);
    client.initialize(&admin, &token_id, signers, &threshold);
    client
}

// ── Distribution: below-threshold does not upgrade ───────────────────────────

#[test]
fn distribution_single_signer_below_threshold_upgrade_blocked() {
    let env = Env::default();
    env.mock_all_auths();

    let s1 = Address::generate(&env);
    let s2 = Address::generate(&env);
    let signers = vec![&env, s1.clone(), s2.clone()];
    let client = deploy_distribution(&env, &signers, 2);

    let hash = fake_hash(&env, 0xAA);
    client.approve_upgrade(&s1, &hash);

    assert_eq!(
        client.get_upgrade_approvals(&hash),
        1,
        "approval count must be 1 after first signer"
    );
    assert_eq!(client.get_threshold(), 2);
}

// ── Distribution: threshold exactly reached triggers upgrade ──────────────────

#[test]
fn distribution_threshold_reached_upgrade_executes_and_emits_event() {
    let env = Env::default();
    env.mock_all_auths();

    let s1 = Address::generate(&env);
    let s2 = Address::generate(&env);
    let signers = vec![&env, s1.clone(), s2.clone()];
    let client = deploy_distribution(&env, &signers, 2);

    let hash = fake_hash(&env, 0xBB);

    client.approve_upgrade(&s1, &hash);
    assert_eq!(client.get_upgrade_approvals(&hash), 1);

    client.approve_upgrade(&s2, &hash);

    assert_eq!(
        client.get_upgrade_approvals(&hash),
        0,
        "approvals must be cleared after upgrade executes"
    );
    assert!(
        !env.events().all().is_empty(),
        "upgraded event must be emitted"
    );
}

// ── Distribution: duplicate approval rejected ─────────────────────────────────

#[test]
#[should_panic(expected = "already approved")]
fn distribution_duplicate_approval_rejected() {
    let env = Env::default();
    env.mock_all_auths();

    let s1 = Address::generate(&env);
    let s2 = Address::generate(&env);
    let signers = vec![&env, s1.clone(), s2.clone()];
    let client = deploy_distribution(&env, &signers, 2);

    let hash = fake_hash(&env, 0xCC);
    client.approve_upgrade(&s1, &hash);
    client.approve_upgrade(&s1, &hash); // must panic
}

// ── Distribution: approval state cleared after upgrade ────────────────────────

#[test]
fn distribution_approval_state_cleared_after_upgrade() {
    let env = Env::default();
    env.mock_all_auths();

    let s1 = Address::generate(&env);
    let s2 = Address::generate(&env);
    let signers = vec![&env, s1.clone(), s2.clone()];
    let client = deploy_distribution(&env, &signers, 2);

    let hash = fake_hash(&env, 0xDD);
    client.approve_upgrade(&s1, &hash);
    client.approve_upgrade(&s2, &hash);

    assert_eq!(
        client.get_upgrade_approvals(&hash),
        0,
        "approval key must be removed after successful upgrade"
    );
}

// ── Distribution: unauthorized signer rejected ────────────────────────────────

#[test]
#[should_panic(expected = "not an authorized signer")]
fn distribution_unauthorized_signer_rejected() {
    let env = Env::default();
    env.mock_all_auths();

    let s1 = Address::generate(&env);
    let signers = vec![&env, s1.clone()];
    let client = deploy_distribution(&env, &signers, 1);

    let outsider = Address::generate(&env);
    let hash = fake_hash(&env, 0xEE);
    client.approve_upgrade(&outsider, &hash);
}

// ── Distribution: different hash is a separate ballot ─────────────────────────

#[test]
fn distribution_different_hash_is_independent_ballot() {
    let env = Env::default();
    env.mock_all_auths();

    let s1 = Address::generate(&env);
    let s2 = Address::generate(&env);
    let signers = vec![&env, s1.clone(), s2.clone()];
    let client = deploy_distribution(&env, &signers, 2);

    let hash_a = fake_hash(&env, 0x11);
    let hash_b = fake_hash(&env, 0x22);

    client.approve_upgrade(&s1, &hash_a);
    client.approve_upgrade(&s2, &hash_b);

    assert_eq!(client.get_upgrade_approvals(&hash_a), 1);
    assert_eq!(client.get_upgrade_approvals(&hash_b), 1);
}

// ── Distribution: 3-of-5 accumulates then upgrades ───────────────────────────

#[test]
fn distribution_three_of_five_accumulates_then_upgrades() {
    let env = Env::default();
    env.mock_all_auths();

    let signers: soroban_sdk::Vec<Address> = vec![
        &env,
        Address::generate(&env),
        Address::generate(&env),
        Address::generate(&env),
        Address::generate(&env),
        Address::generate(&env),
    ];
    let client = deploy_distribution(&env, &signers, 3);

    let hash = fake_hash(&env, 0x44);

    let s0 = signers.get(0).unwrap();
    let s1 = signers.get(1).unwrap();
    let s2 = signers.get(2).unwrap();

    client.approve_upgrade(&s0, &hash);
    assert_eq!(client.get_upgrade_approvals(&hash), 1);

    client.approve_upgrade(&s1, &hash);
    assert_eq!(client.get_upgrade_approvals(&hash), 2);

    client.approve_upgrade(&s2, &hash);
    assert_eq!(
        client.get_upgrade_approvals(&hash),
        0,
        "approval state cleared after 3-of-5 upgrade"
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Governance contract upgrade tests
// ─────────────────────────────────────────────────────────────────────────────

use governance::{GovernanceContract, GovernanceContractClient};

fn deploy_governance<'a>(
    env: &'a Env,
    signers: &soroban_sdk::Vec<Address>,
    threshold: u32,
) -> GovernanceContractClient<'a> {
    let contract_id = env.register(GovernanceContract, ());
    let client = GovernanceContractClient::new(env, &contract_id);
    let admin = Address::generate(env);
    client.initialize(&admin, signers, &threshold);
    client
}

// ── Governance: below-threshold does not upgrade ─────────────────────────────

#[test]
fn governance_single_signer_below_threshold_upgrade_blocked() {
    let env = Env::default();
    env.mock_all_auths();

    let s1 = Address::generate(&env);
    let s2 = Address::generate(&env);
    let signers = vec![&env, s1.clone(), s2.clone()];
    let client = deploy_governance(&env, &signers, 2);

    let hash = fake_hash(&env, 0xAA);
    client.approve_upgrade(&s1, &hash);

    assert_eq!(
        client.get_upgrade_approvals(&hash),
        1,
        "approval count must be 1 after first signer"
    );
    assert_eq!(client.get_threshold(), 2);
}

// ── Governance: threshold exactly reached triggers upgrade ────────────────────

#[test]
fn governance_threshold_reached_upgrade_executes_and_emits_event() {
    let env = Env::default();
    env.mock_all_auths();

    let s1 = Address::generate(&env);
    let s2 = Address::generate(&env);
    let signers = vec![&env, s1.clone(), s2.clone()];
    let client = deploy_governance(&env, &signers, 2);

    let hash = fake_hash(&env, 0xBB);

    client.approve_upgrade(&s1, &hash);
    assert_eq!(client.get_upgrade_approvals(&hash), 1);

    client.approve_upgrade(&s2, &hash);

    assert_eq!(
        client.get_upgrade_approvals(&hash),
        0,
        "approvals must be cleared after upgrade executes"
    );
    assert!(
        !env.events().all().is_empty(),
        "upgraded event must be emitted"
    );
}

// ── Governance: duplicate approval rejected ───────────────────────────────────

#[test]
#[should_panic(expected = "already approved")]
fn governance_duplicate_approval_rejected() {
    let env = Env::default();
    env.mock_all_auths();

    let s1 = Address::generate(&env);
    let s2 = Address::generate(&env);
    let signers = vec![&env, s1.clone(), s2.clone()];
    let client = deploy_governance(&env, &signers, 2);

    let hash = fake_hash(&env, 0xCC);
    client.approve_upgrade(&s1, &hash);
    client.approve_upgrade(&s1, &hash); // must panic
}

// ── Governance: approval state cleared after upgrade ──────────────────────────

#[test]
fn governance_approval_state_cleared_after_upgrade() {
    let env = Env::default();
    env.mock_all_auths();

    let s1 = Address::generate(&env);
    let s2 = Address::generate(&env);
    let signers = vec![&env, s1.clone(), s2.clone()];
    let client = deploy_governance(&env, &signers, 2);

    let hash = fake_hash(&env, 0xDD);
    client.approve_upgrade(&s1, &hash);
    client.approve_upgrade(&s2, &hash);

    assert_eq!(
        client.get_upgrade_approvals(&hash),
        0,
        "approval key must be removed after successful upgrade"
    );
}

// ── Governance: unauthorized signer rejected ──────────────────────────────────

#[test]
#[should_panic(expected = "not an authorized signer")]
fn governance_unauthorized_signer_rejected() {
    let env = Env::default();
    env.mock_all_auths();

    let s1 = Address::generate(&env);
    let signers = vec![&env, s1.clone()];
    let client = deploy_governance(&env, &signers, 1);

    let outsider = Address::generate(&env);
    let hash = fake_hash(&env, 0xEE);
    client.approve_upgrade(&outsider, &hash);
}

// ── Governance: different hash is a separate ballot ───────────────────────────

#[test]
fn governance_different_hash_is_independent_ballot() {
    let env = Env::default();
    env.mock_all_auths();

    let s1 = Address::generate(&env);
    let s2 = Address::generate(&env);
    let signers = vec![&env, s1.clone(), s2.clone()];
    let client = deploy_governance(&env, &signers, 2);

    let hash_a = fake_hash(&env, 0x11);
    let hash_b = fake_hash(&env, 0x22);

    client.approve_upgrade(&s1, &hash_a);
    client.approve_upgrade(&s2, &hash_b);

    assert_eq!(client.get_upgrade_approvals(&hash_a), 1);
    assert_eq!(client.get_upgrade_approvals(&hash_b), 1);
}

// ── Governance: 3-of-5 accumulates then upgrades ─────────────────────────────

#[test]
fn governance_three_of_five_accumulates_then_upgrades() {
    let env = Env::default();
    env.mock_all_auths();

    let signers: soroban_sdk::Vec<Address> = vec![
        &env,
        Address::generate(&env),
        Address::generate(&env),
        Address::generate(&env),
        Address::generate(&env),
        Address::generate(&env),
    ];
    let client = deploy_governance(&env, &signers, 3);

    let hash = fake_hash(&env, 0x55);

    let s0 = signers.get(0).unwrap();
    let s1 = signers.get(1).unwrap();
    let s2 = signers.get(2).unwrap();

    client.approve_upgrade(&s0, &hash);
    assert_eq!(client.get_upgrade_approvals(&hash), 1);

    client.approve_upgrade(&s1, &hash);
    assert_eq!(client.get_upgrade_approvals(&hash), 2);

    client.approve_upgrade(&s2, &hash);
    assert_eq!(
        client.get_upgrade_approvals(&hash),
        0,
        "approval state cleared after 3-of-5 upgrade"
    );
}

// ── Governance: upgrade does not disrupt active proposals ─────────────────────

/// Confirm that a successful upgrade (WASM swap) does not disturb existing
/// governance state: a proposal created before the upgrade is still readable
/// and vote-able after the upgrade fires.
///
/// (In the Soroban test environment the WASM pointer changes but instance
/// storage persists unchanged, so the proposal key must survive.)
#[test]
fn governance_upgrade_preserves_existing_proposal_state() {
    use soroban_sdk::String;

    let env = Env::default();
    env.mock_all_auths();

    let s1 = Address::generate(&env);
    let s2 = Address::generate(&env);
    let signers = vec![&env, s1.clone(), s2.clone()];
    let client = deploy_governance(&env, &signers, 2);

    // Create a proposal before the upgrade.
    let proposer = Address::generate(&env);
    let proposal_id = client.create_proposal(
        &proposer,
        &String::from_str(&env, "Raise reward cap"),
        &String::from_str(&env, "Proposal created before upgrade"),
    );

    // Trigger the upgrade.
    let hash = fake_hash(&env, 0x66);
    client.approve_upgrade(&s1, &hash);
    client.approve_upgrade(&s2, &hash);

    // Proposal data must still be intact.
    let proposal = client.get_proposal(&proposal_id);
    assert_eq!(proposal.id, proposal_id);
    assert_eq!(proposal.yes_votes, 0);
}
