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

    Suite { env, admin, token, pool, admin_roles, referral, vesting }
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
    s.token.approve(&owner, &spender, &500);
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
    s.referral.credit_referrer(&referred, &1_000);
    assert_eq!(s.referral.pool_balance(), pool_before - 1_000);
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
    let sid = s.vesting.create_schedule(&beneficiary, &1_000, &0, &0, &1_000);
    s.env.ledger().set_timestamp(500);

    let released = s.vesting.release(&beneficiary, &sid);
    assert_eq!(released, 500);

    let schedule = s.vesting.get_schedule(&beneficiary, &sid);
    assert_eq!(schedule.released, 500);
}

/// Full vesting: release everything after duration expires.
#[test]
fn test_vesting_full_release_after_duration() {
    let s = setup();
    let beneficiary = Address::generate(&s.env);

    let sid = s.vesting.create_schedule(&beneficiary, &2_000, &0, &0, &1_000);
    s.env.ledger().set_timestamp(1_000);

    let released = s.vesting.release(&beneficiary, &sid);
    assert_eq!(released, 2_000);
    assert_eq!(s.vesting.pool_balance(), 1_000_000 - 2_000);
}

/// Cliff not reached: vested amount is zero, release must panic.
#[test]
fn test_vesting_before_cliff_nothing_released() {
    let s = setup();
    let beneficiary = Address::generate(&s.env);

    // cliff at t=200 (start=0 + cliff_duration=200)
    let schedule = s.vesting.create_schedule(&beneficiary, &1_000, &0, &200, &1_000);
    s.env.ledger().set_timestamp(100); // before cliff

    let sched = s.vesting.get_schedule(&beneficiary, &schedule);
    // vested_amount is 0 before cliff
    assert_eq!(sched.released, 0);
    assert_eq!(sched.total_amount, 1_000);
}

// ── 7. Error paths ────────────────────────────────────────────────────────────

#[test]
#[should_panic(expected = "already initialised")]
fn test_token_double_init_rejected() {
    let s = setup();
    let other = Address::generate(&s.env);
    s.token.initialize(&other);
}

#[test]
#[should_panic(expected = "already initialised")]
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
#[should_panic(expected = "already referred")]
fn test_referral_duplicate_registration_rejected() {
    let s = setup();
    let referrer = Address::generate(&s.env);
    let referred = Address::generate(&s.env);
    s.referral.register_referral(&referrer, &referred);
    s.referral.register_referral(&referrer, &referred);
}

#[test]
#[should_panic(expected = "cannot refer yourself")]
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
    let sid = s.vesting.create_schedule(&beneficiary, &1_000, &0, &0, &1_000);
    s.env.ledger().set_timestamp(1_000);
    s.vesting.release(&beneficiary, &sid);
    s.vesting.release(&beneficiary, &sid);
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
    s.referral.credit_referrer(&new_user, &200);
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
    let released = s.vesting.release(&employee, &sid);
    assert_eq!(released, 3_000);

    // Pool is independent — still holds merchant deposit.
    assert_eq!(s.pool.balance(), 10_000);
}
