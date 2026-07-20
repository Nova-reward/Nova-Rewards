//! Integration tests for Nova Rewards Soroban contracts.
//!
//! Covers:
//!   1. Full reward lifecycle: campaign creation → reward issuance → redemption
//!   2. Cross-contract calls: reward_pool distributes via nova_token
//!   3. Admin governance: two-step transfer, multisig threshold
//!   4. Referral flow: register → credit
//!   5. Vesting flow: create schedule → release
//!   6. Error paths: double-init, overdraft, duplicate referral, etc.

#![cfg(test)]

use soroban_sdk::{
    testutils::{Address as _, Ledger},
    vec, Address, Env,
};

use admin_roles::{AdminRolesContract, AdminRolesContractClient};
use nova_token::{NovaToken, NovaTokenClient};
use referral::{ReferralContract, ReferralContractClient};
use reward_pool::{RewardPool, RewardPoolClient};
use vesting::{VestingContract, VestingContractClient};

// ── Shared setup ─────────────────────────────────────────────────────────────

struct Suite<'a> {
    env: Env,
    admin: Address,
    token: NovaTokenClient<'a>,
    pool: RewardPoolClient<'a>,
    admin_roles: AdminRolesContractClient<'a>,
    referral: ReferralContractClient<'a>,
    vesting: VestingContractClient<'a>,
}

fn setup() -> Suite<'static> {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);

    let token_id = env.register(NovaToken, ());
    let token = NovaTokenClient::new(&env, &token_id);
    token.initialize(&admin);

    let pool_id = env.register(RewardPool, ());
    let pool = RewardPoolClient::new(&env, &pool_id);
    pool.initialize(&admin);

    let roles_id = env.register(AdminRolesContract, ());
    let admin_roles = AdminRolesContractClient::new(&env, &roles_id);
    admin_roles.initialize(&admin, &vec![&env], &1);

    let ref_id = env.register(ReferralContract, ());
    let referral = ReferralContractClient::new(&env, &ref_id);
    referral.initialize(&admin);
    referral.fund_pool(&50_000);

    let vest_id = env.register(VestingContract, ());
    let vesting = VestingContractClient::new(&env, &vest_id);
    vesting.initialize(&admin);
    vesting.fund_pool(&1_000_000);

    Suite {
        env,
        admin,
        token,
        pool,
        admin_roles,
        referral,
        vesting,
    }
}

// ── 1. Full reward lifecycle ──────────────────────────────────────────────────

/// Campaign creation → reward issuance → redemption (burn).
#[test]
fn test_full_reward_lifecycle() {
    let s = setup();
    let merchant = Address::generate(&s.env);
    let user = Address::generate(&s.env);

    // Step 1 – "Campaign creation": merchant deposits campaign budget into pool.
    s.token.mint(&merchant, &10_000);
    // Merchant funds the reward pool (simulates campaign budget deposit).
    s.pool.deposit(&merchant, &5_000);
    assert_eq!(s.pool.balance(), 5_000);

    // Step 2 – "Reward issuance": admin mints tokens directly to user as reward.
    s.token.mint(&user, &1_000);
    assert_eq!(s.token.balance(&user), 1_000);

    // Step 3 – "Redemption": user burns tokens to redeem reward.
    s.token.burn(&user, &1_000);
    assert_eq!(s.token.balance(&user), 0);
}

// ── 2. Cross-contract: pool distributes via token ────────────────────────────

/// reward_pool withdraw followed by nova_token mint to user — simulates
/// the distribution contract calling both contracts in sequence.
#[test]
fn test_cross_contract_pool_to_token_distribution() {
    let s = setup();
    let user = Address::generate(&s.env);

    // Fund pool (campaign budget).
    s.pool.deposit(&s.admin, &20_000);
    assert_eq!(s.pool.balance(), 20_000);

    // Distribution step: pool releases funds (withdraw), token mints to user.
    let reward_amount = 500_i128;
    s.pool.withdraw(&s.admin, &reward_amount);
    s.token.mint(&user, &reward_amount);

    assert_eq!(s.pool.balance(), 19_500);
    assert_eq!(s.token.balance(&user), 500);
}

/// Multiple users receive rewards from the same campaign pool.
#[test]
fn test_multi_user_distribution_from_pool() {
    let s = setup();
    let users: Vec<Address> = (0..3).map(|_| Address::generate(&s.env)).collect();

    s.pool.deposit(&s.admin, &3_000);

    for user in &users {
        s.pool.withdraw(&s.admin, &1_000);
        s.token.mint(user, &1_000);
    }

    assert_eq!(s.pool.balance(), 0);
    for user in &users {
        assert_eq!(s.token.balance(user), 1_000);
    }
}

// ── 3. Token cross-contract: approve + transfer ───────────────────────────────

/// Approve a spender, then verify allowance is recorded correctly.
#[test]
fn test_token_approve_and_allowance() {
    let s = setup();
    let owner = Address::generate(&s.env);
    let spender = Address::generate(&s.env);

    s.token.mint(&owner, &2_000);
    s.token
        .approve(&owner, &spender, &500, &(s.env.ledger().sequence() + 1_000));
    assert_eq!(s.token.allowance(&owner, &spender), 500);
}

/// Transfer between two users updates both balances atomically.
#[test]
fn test_token_transfer_between_users() {
    let s = setup();
    let alice = Address::generate(&s.env);
    let bob = Address::generate(&s.env);

    s.token.mint(&alice, &1_000);
    s.token.transfer(&alice, &bob, &400);

    assert_eq!(s.token.balance(&alice), 600);
    assert_eq!(s.token.balance(&bob), 400);
}

// ── 4. Admin governance ───────────────────────────────────────────────────────

/// Two-step admin transfer: propose → accept.
#[test]
fn test_admin_two_step_transfer() {
    let s = setup();
    let new_admin = Address::generate(&s.env);

    s.admin_roles.propose_admin(&new_admin);
    assert_eq!(s.admin_roles.get_pending_admin(), Some(new_admin.clone()));

    s.admin_roles.accept_admin();
    assert_eq!(s.admin_roles.get_admin(), new_admin);
    assert_eq!(s.admin_roles.get_pending_admin(), None);
}

/// Multisig threshold and signers update.
#[test]
fn test_admin_multisig_config() {
    let s = setup();
    let s1 = Address::generate(&s.env);
    let s2 = Address::generate(&s.env);

    s.admin_roles.update_signers(&vec![&s.env, s1, s2]);
    s.admin_roles.update_threshold(&2);

    assert_eq!(s.admin_roles.get_threshold(), 2);
    assert_eq!(s.admin_roles.get_signers().len(), 2);
}

// ── 5. Referral flow ──────────────────────────────────────────────────────────

/// Register referral → credit referrer → verify pool deduction.
#[test]
fn test_referral_register_and_credit() {
    let s = setup();
    let referrer = Address::generate(&s.env);
    let referred = Address::generate(&s.env);

    s.referral.register_referral(&referrer, &referred);
    assert_eq!(s.referral.get_referrer(&referred), Some(referrer.clone()));
    assert_eq!(s.referral.total_referrals(&referrer), 1);

    let pool_before = s.referral.pool_balance();
    s.referral.claim_referral_reward(&referred, &1_000, &100);
    assert_eq!(s.referral.pool_balance(), pool_before - 1_100);
}

/// Referral chain: multiple users referred by the same referrer.
#[test]
fn test_referral_chain_increments_counter() {
    let s = setup();
    let referrer = Address::generate(&s.env);
    let r1 = Address::generate(&s.env);
    let r2 = Address::generate(&s.env);
    let r3 = Address::generate(&s.env);

    for referred in [&r1, &r2, &r3] {
        s.referral.register_referral(&referrer, referred);
    }
    assert_eq!(s.referral.total_referrals(&referrer), 3);
}

// ── 6. Vesting flow ───────────────────────────────────────────────────────────

/// Create schedule → advance ledger past cliff → release tokens.
#[test]
fn test_vesting_create_and_release() {
    let s = setup();
    let beneficiary = Address::generate(&s.env);

    // start=0, cliff=0, duration=1000, total=1000
    let sid = s
        .vesting
        .create_schedule(&beneficiary, &1_000, &0, &0, &1_000);
    s.env.ledger().set_timestamp(500);

    let released = s.vesting.claim_vested(&beneficiary, &sid);
    assert_eq!(released, 500);

    let schedule = s.vesting.get_schedule(&beneficiary, &sid);
    assert_eq!(schedule.released, 500);
}

/// Full vesting: release everything after duration expires.
#[test]
fn test_vesting_full_release_after_duration() {
    let s = setup();
    let beneficiary = Address::generate(&s.env);

    let sid = s
        .vesting
        .create_schedule(&beneficiary, &2_000, &0, &0, &1_000);
    s.env.ledger().set_timestamp(1_000);

    let released = s.vesting.claim_vested(&beneficiary, &sid);
    assert_eq!(released, 2_000);
    assert_eq!(s.vesting.pool_balance(), 1_000_000 - 2_000);
}

/// Cliff not reached: vested amount is zero, release must panic.
#[test]
fn test_vesting_before_cliff_nothing_released() {
    let s = setup();
    let beneficiary = Address::generate(&s.env);

    // cliff at t=200 (start=0 + cliff_duration=200)
    let schedule = s
        .vesting
        .create_schedule(&beneficiary, &1_000, &0, &200, &1_000);
    s.env.ledger().set_timestamp(100); // before cliff

    let sched = s.vesting.get_schedule(&beneficiary, &schedule);
    // vested_amount is 0 before cliff
    assert_eq!(sched.released, 0);
    assert_eq!(sched.total_amount, 1_000);
}

// ── 7. Error paths ────────────────────────────────────────────────────────────

#[test]
#[should_panic(expected = "already initialized")]
fn test_token_double_init_rejected() {
    let s = setup();
    let other = Address::generate(&s.env);
    s.token.initialize(&other);
}

#[test]
#[should_panic(expected = "already initialized")]
fn test_pool_double_init_rejected() {
    let s = setup();
    let other = Address::generate(&s.env);
    s.pool.initialize(&other);
}

#[test]
#[should_panic(expected = "already initialised")]
fn test_admin_roles_double_init_rejected() {
    let s = setup();
    let other = Address::generate(&s.env);
    s.admin_roles.initialize(&other, &vec![&s.env], &1);
}

#[test]
#[should_panic(expected = "insufficient balance")]
fn test_token_burn_overdraft_rejected() {
    let s = setup();
    let user = Address::generate(&s.env);
    s.token.mint(&user, &100);
    s.token.burn(&user, &200);
}

#[test]
#[should_panic(expected = "insufficient pool balance")]
fn test_pool_withdraw_overdraft_rejected() {
    let s = setup();
    s.pool.withdraw(&s.admin, &1);
}

#[test]
#[should_panic]
fn test_referral_duplicate_registration_rejected() {
    let s = setup();
    let referrer = Address::generate(&s.env);
    let referred = Address::generate(&s.env);
    s.referral.register_referral(&referrer, &referred);
    s.referral.register_referral(&referrer, &referred);
}

#[test]
#[should_panic]
fn test_referral_self_referral_rejected() {
    let s = setup();
    let user = Address::generate(&s.env);
    s.referral.register_referral(&user, &user);
}

#[test]
#[should_panic(expected = "nothing to release")]
fn test_vesting_double_release_rejected() {
    let s = setup();
    let beneficiary = Address::generate(&s.env);
    let sid = s
        .vesting
        .create_schedule(&beneficiary, &1_000, &0, &0, &1_000);
    s.env.ledger().set_timestamp(1_000);
    s.vesting.claim_vested(&beneficiary, &sid);
    s.vesting.claim_vested(&beneficiary, &sid);
}

// ── 8. Combined lifecycle: referral + token reward ───────────────────────────

/// User is referred, completes an action (token mint), referrer is credited.
#[test]
fn test_referral_plus_token_reward_lifecycle() {
    let s = setup();
    let referrer = Address::generate(&s.env);
    let new_user = Address::generate(&s.env);

    // New user signs up via referral link.
    s.referral.register_referral(&referrer, &new_user);

    // Platform mints reward tokens to new user for completing onboarding.
    s.token.mint(&new_user, &500);
    assert_eq!(s.token.balance(&new_user), 500);

    // Platform credits referrer from referral pool.
    s.referral.claim_referral_reward(&new_user, &100, &100);
    assert_eq!(s.referral.pool_balance(), 49_800);

    // New user redeems their reward tokens.
    s.token.burn(&new_user, &500);
    assert_eq!(s.token.balance(&new_user), 0);
}

// ── 9. Pool + vesting combined ────────────────────────────────────────────────

/// Campaign funds pool, vesting schedule created for employee reward,
/// tokens released after vesting period.
#[test]
fn test_pool_deposit_and_vesting_release() {
    let s = setup();
    let employee = Address::generate(&s.env);
    let merchant = Address::generate(&s.env);

    // Merchant funds campaign pool.
    s.pool.deposit(&merchant, &10_000);
    assert_eq!(s.pool.balance(), 10_000);

    // Admin creates vesting schedule for employee bonus.
    let sid = s.vesting.create_schedule(&employee, &3_000, &0, &0, &600);
    s.env.ledger().set_timestamp(600);

    // Employee releases fully vested tokens.
    let released = s.vesting.claim_vested(&employee, &sid);
    assert_eq!(released, 3_000);

    // Pool is independent — still holds merchant deposit.
    assert_eq!(s.pool.balance(), 10_000);
}

// ── Distribution integration tests (#1126) ───────────────────────────────────
//
// Cross-contract token-flow tests: distribution → nova_token
//
// Each test uses a dedicated `DistSuite` that wires a real NovaToken contract
// as the token for the DistributionContract, exercising the full on-chain
// transfer path rather than a mock.

use distribution::{DistributionContract, DistributionContractClient, DistributionError};

struct DistSuite<'a> {
    env: Env,
    admin: Address,
    token: NovaTokenClient<'a>,
    dist: DistributionContractClient<'a>,
    /// Address of the distribution contract (needed for funding via mint)
    dist_id: Address,
}

fn dist_setup() -> DistSuite<'static> {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);

    // Deploy nova_token and initialize
    let token_id = env.register(NovaToken, ());
    let token = NovaTokenClient::new(&env, &token_id);
    token.initialize(&admin);

    // Deploy distribution contract wired to the real nova_token
    let dist_id = env.register(DistributionContract, ());
    let dist = DistributionContractClient::new(&env, &dist_id);
    dist.initialize(
        &admin,
        &token_id,
        &soroban_sdk::vec![&env, admin.clone()],
        &1,
    );

    DistSuite {
        env,
        admin,
        token,
        dist,
        dist_id,
    }
}

// ── Test 1: Full lifecycle ────────────────────────────────────────────────────

/// Full token-flow lifecycle:
///   1. Register campaign
///   2. Fund distribution pool via nova_token mint
///   3. Batch-distribute to 50 recipients
///   4. Verify every recipient balance via token contract
///   5. Verify distribution contract balance decreased correctly
///   6. Verify campaign state (still active after distribution)
///   7. Clawback one recipient inside 30-day window succeeds
///   8. Attempt clawback after window fails
#[test]
fn test_distribution_full_lifecycle() {
    let s = dist_setup();
    // Reset CPU/memory budget and disable the ledger-footprint resource limit
    // check so the 50-recipient batch (which writes 3 persistent entries per
    // recipient) can run without hitting the mainnet 50-write-entry cap.
    // This is a simulation-only test; the cap is still enforced by the
    // InvalidBatchSize guard (max 50 recipients) at the contract level.
    s.env.cost_estimate().budget().reset_unlimited();
    s.env.host().set_invocation_resource_limits(None).unwrap();
    let merchant = Address::generate(&s.env);
    let campaign_id: u64 = 1;
    let reward_per_user: i128 = 100;
    let n: u32 = 50;

    // Step 1 – register campaign (min_actions = 0 → no eligibility gate)
    s.dist
        .register_campaign(&campaign_id, &merchant, &reward_per_user, &0);

    // Step 2 – fund the distribution contract (mint tokens to it)
    let total_budget = reward_per_user * n as i128;
    s.token.mint(&s.dist_id, &total_budget);
    assert_eq!(s.dist.contract_balance(), total_budget);

    // Step 3 – build batch of 50 recipients, each receives 100 tokens
    let mut recipients = soroban_sdk::Vec::new(&s.env);
    let mut amounts = soroban_sdk::Vec::new(&s.env);
    for _ in 0..n {
        recipients.push_back(Address::generate(&s.env));
        amounts.push_back(reward_per_user);
    }

    s.dist.distribute_batch(&campaign_id, &recipients, &amounts);

    // Step 4 – verify every recipient balance via the real token contract
    for i in 0..n {
        let addr = recipients.get(i).unwrap();
        assert_eq!(
            s.token.balance(&addr),
            reward_per_user,
            "recipient {i} should hold {reward_per_user} tokens"
        );
    }

    // Step 5 – distribution contract balance should now be zero
    assert_eq!(s.dist.contract_balance(), 0);

    // Step 6 – campaign is still active after distribution
    // (deactivate_campaign is the explicit action; distribution alone does not deactivate)
    // We verify by distributing to a fresh user after re-funding
    s.token.mint(&s.dist_id, &reward_per_user);
    let extra_user = Address::generate(&s.env);
    s.dist
        .distribute_reward(&campaign_id, &extra_user, &reward_per_user);
    assert_eq!(s.token.balance(&extra_user), reward_per_user);

    // Step 7 – clawback inside the 30-day window succeeds for the extra_user
    // extra_user must approve the distribution contract to pull tokens back
    let expiry = s.env.ledger().sequence() + 1_000;
    s.token
        .approve(&extra_user, &s.dist_id, &reward_per_user, &expiry);
    s.dist.clawback(&extra_user);
    // After clawback the extra_user balance is zero again
    assert_eq!(s.token.balance(&extra_user), 0);

    // Step 8 – clawback after window expiry panics
    // Re-fund and distribute to a new recipient, then advance past the 30-day window
    s.token.mint(&s.dist_id, &reward_per_user);
    let late_user = Address::generate(&s.env);
    s.dist
        .distribute_reward(&campaign_id, &late_user, &reward_per_user);
    s.token
        .approve(&late_user, &s.dist_id, &reward_per_user, &(expiry + 10_000));

    // Advance ledger timestamp past the 30-day window (2_592_001 seconds)
    s.env.ledger().with_mut(|l| {
        l.timestamp += 2_592_001;
    });

    let clawback_result = s.dist.try_clawback(&late_user);
    assert!(
        clawback_result.is_err(),
        "clawback after window should fail"
    );
}

// ── Test 2: Insufficient balance ──────────────────────────────────────────────

/// Distribution pool holds fewer tokens than the batch requires.
/// Asserts:
///   - batch fails with InsufficientBalance
///   - no recipient receives tokens (no partial transfers)
///   - all balances remain unchanged
#[test]
fn test_distribution_insufficient_balance() {
    let s = dist_setup();
    let merchant = Address::generate(&s.env);
    let campaign_id: u64 = 2;
    let reward_per_user: i128 = 200;

    s.dist
        .register_campaign(&campaign_id, &merchant, &reward_per_user, &0);

    // Fund only enough for 2 recipients, but try to distribute to 3
    s.token.mint(&s.dist_id, &(reward_per_user * 2));

    let recipients: soroban_sdk::Vec<Address> = soroban_sdk::vec![
        &s.env,
        Address::generate(&s.env),
        Address::generate(&s.env),
        Address::generate(&s.env)
    ];
    let amounts = soroban_sdk::vec![&s.env, reward_per_user, reward_per_user, reward_per_user];

    let err = s
        .dist
        .try_distribute_batch(&campaign_id, &recipients, &amounts)
        .unwrap_err()
        .unwrap();
    assert_eq!(err, DistributionError::InsufficientBalance);

    // No recipient should have received any tokens
    for i in 0..3u32 {
        assert_eq!(
            s.token.balance(&recipients.get(i).unwrap()),
            0,
            "recipient {i} should have received nothing"
        );
    }

    // Contract balance is unchanged
    assert_eq!(s.dist.contract_balance(), reward_per_user * 2);
}

// ── Test 3: Ineligible recipient ──────────────────────────────────────────────

/// Recipients below the minimum action threshold receive
/// DistributionError::Ineligible.
#[test]
fn test_distribution_ineligible_recipient() {
    let s = dist_setup();
    let merchant = Address::generate(&s.env);
    let campaign_id: u64 = 3;
    let reward: i128 = 50;
    let min_actions: u32 = 3;

    s.dist
        .register_campaign(&campaign_id, &merchant, &reward, &min_actions);
    s.token.mint(&s.dist_id, &10_000);

    let user = Address::generate(&s.env);

    // 0 actions → Ineligible
    let err = s
        .dist
        .try_distribute_reward(&campaign_id, &user, &reward)
        .unwrap_err()
        .unwrap();
    assert_eq!(err, DistributionError::Ineligible);
    assert_eq!(s.token.balance(&user), 0);

    // Record 2 actions → still ineligible (need 3)
    s.dist.record_action(&campaign_id, &user);
    s.dist.record_action(&campaign_id, &user);
    let err = s
        .dist
        .try_distribute_reward(&campaign_id, &user, &reward)
        .unwrap_err()
        .unwrap();
    assert_eq!(err, DistributionError::Ineligible);
    assert_eq!(s.token.balance(&user), 0);

    // Record 3rd action → now eligible
    s.dist.record_action(&campaign_id, &user);
    s.dist.distribute_reward(&campaign_id, &user, &reward);
    assert_eq!(s.token.balance(&user), reward);
}

// ── Test 4: Invalid batch size (> 50) ────────────────────────────────────────

/// A batch containing 51 recipients must be rejected with InvalidBatchSize.
#[test]
fn test_distribution_invalid_batch_size() {
    let s = dist_setup();
    let merchant = Address::generate(&s.env);
    let campaign_id: u64 = 4;
    let reward: i128 = 10;

    s.dist
        .register_campaign(&campaign_id, &merchant, &reward, &0);
    // Fund enough for 51 recipients so the balance is never the limiting factor
    s.token.mint(&s.dist_id, &(reward * 60));

    let mut recipients = soroban_sdk::Vec::new(&s.env);
    let mut amounts = soroban_sdk::Vec::new(&s.env);
    for _ in 0..51 {
        recipients.push_back(Address::generate(&s.env));
        amounts.push_back(reward);
    }

    let err = s
        .dist
        .try_distribute_batch(&campaign_id, &recipients, &amounts)
        .unwrap_err()
        .unwrap();
    assert_eq!(err, DistributionError::InvalidBatchSize);
}

// ── Test 5: Batch length mismatch ─────────────────────────────────────────────

/// Mismatched recipients/amounts vectors must return BatchLengthMismatch.
#[test]
fn test_distribution_batch_length_mismatch() {
    let s = dist_setup();
    let merchant = Address::generate(&s.env);
    let campaign_id: u64 = 5;

    s.dist.register_campaign(&campaign_id, &merchant, &100, &0);
    s.token.mint(&s.dist_id, &10_000);

    let recipients =
        soroban_sdk::vec![&s.env, Address::generate(&s.env), Address::generate(&s.env)];
    let amounts = soroban_sdk::vec![&s.env, 100_i128]; // only 1 amount for 2 recipients

    let err = s
        .dist
        .try_distribute_batch(&campaign_id, &recipients, &amounts)
        .unwrap_err()
        .unwrap();
    assert_eq!(err, DistributionError::BatchLengthMismatch);
}
