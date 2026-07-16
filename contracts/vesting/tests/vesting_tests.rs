#![cfg(test)]

use vesting::VestingContract;
use vesting::VestingContractClient;
use soroban_sdk::{testutils::{Address as _, Ledger}, Address, Env};

fn setup() -> (Env, Address, VestingContractClient<'static>) {
    let env = Env::default();
    env.mock_all_auths();
    let id = env.register(VestingContract, ());
    let client = VestingContractClient::new(&env, &id);
    let admin = Address::generate(&env);
    client.initialize(&admin);
    client.fund_pool(&1_000_000);
    (env, admin, client)
}

// ── initialize ────────────────────────────────────────────────────────────────

#[test]
fn initialize_sets_zero_pool_balance() {
    let env = Env::default();
    env.mock_all_auths();
    let id = env.register(VestingContract, ());
    let client = VestingContractClient::new(&env, &id);
    let admin = Address::generate(&env);
    client.initialize(&admin);
    assert_eq!(client.pool_balance(), 0);
}

#[test]
#[should_panic(expected = "already initialised")]
fn initialize_twice_panics() {
    let (_env, admin, client) = setup();
    client.initialize(&admin);
}

// ── fund_pool ─────────────────────────────────────────────────────────────────

#[test]
fn fund_pool_increases_balance() {
    let (_env, _admin, client) = setup();
    assert_eq!(client.pool_balance(), 1_000_000);
    client.fund_pool(&500_000);
    assert_eq!(client.pool_balance(), 1_500_000);
}

#[test]
#[should_panic(expected = "amount must be positive")]
fn fund_pool_zero_panics() {
    let (_env, _admin, client) = setup();
    client.fund_pool(&0);
}

// ── create_schedule ───────────────────────────────────────────────────────────

#[test]
fn create_schedule_returns_sequential_ids() {
    let (env, _admin, client) = setup();
    let b = Address::generate(&env);
    let id0 = client.create_schedule(&b, &1_000, &0, &0, &1_000);
    let id1 = client.create_schedule(&b, &1_000, &0, &0, &1_000);
    assert_eq!(id0, 0);
    assert_eq!(id1, 1);
}

#[test]
fn create_schedule_stores_correct_fields() {
    let (env, _admin, client) = setup();
    let b = Address::generate(&env);
    let sid = client.create_schedule(&b, &5_000, &100, &200, &1_000);
    let s = client.get_schedule(&b, &sid);
    assert_eq!(s.total_amount, 5_000);
    assert_eq!(s.start_time, 100);
    assert_eq!(s.cliff_duration, 200);
    assert_eq!(s.total_duration, 1_000);
    assert_eq!(s.released, 0);
    assert!(!s.revoked);
}

#[test]
#[should_panic(expected = "total_duration must be > 0")]
fn create_schedule_zero_duration_panics() {
    let (env, _admin, client) = setup();
    let b = Address::generate(&env);
    client.create_schedule(&b, &1_000, &0, &0, &0);
}

#[test]
#[should_panic(expected = "total_amount must be > 0")]
fn create_schedule_zero_amount_panics() {
    let (env, _admin, client) = setup();
    let b = Address::generate(&env);
    client.create_schedule(&b, &0, &0, &0, &1_000);
}

// ── claim_vested ──────────────────────────────────────────────────────────────

#[test]
fn release_before_cliff_nothing_vested() {
    let (env, _admin, client) = setup();
    let b = Address::generate(&env);
    // cliff at start_time(100) + cliff_duration(200) = 300; ledger at 150
    let sid = client.create_schedule(&b, &1_000, &100, &200, &1_000);
    env.ledger().set_timestamp(150);
    let s = client.get_schedule(&b, &sid);
    assert_eq!(s.released, 0);
}

#[test]
fn release_at_cliff_gives_proportional_amount() {
    let (env, _admin, client) = setup();
    let b = Address::generate(&env);
    // start=0, cliff=0, duration=1000, amount=1000
    let sid = client.create_schedule(&b, &1_000, &0, &0, &1_000);
    env.ledger().set_timestamp(500);
    let released = client.claim_vested(&b, &sid);
    assert_eq!(released, 500);
    assert_eq!(client.pool_balance(), 999_500);
}

#[test]
fn release_after_full_duration_gives_total() {
    let (env, _admin, client) = setup();
    let b = Address::generate(&env);
    let sid = client.create_schedule(&b, &1_000, &0, &0, &1_000);
    env.ledger().set_timestamp(1_000);
    let released = client.claim_vested(&b, &sid);
    assert_eq!(released, 1_000);
}

#[test]
fn release_beyond_duration_gives_total() {
    let (env, _admin, client) = setup();
    let b = Address::generate(&env);
    let sid = client.create_schedule(&b, &1_000, &0, &0, &1_000);
    env.ledger().set_timestamp(9_999);
    let released = client.claim_vested(&b, &sid);
    assert_eq!(released, 1_000);
}

#[test]
fn release_twice_gives_incremental_amounts() {
    let (env, _admin, client) = setup();
    let b = Address::generate(&env);
    let sid = client.create_schedule(&b, &1_000, &0, &0, &1_000);
    env.ledger().set_timestamp(400);
    let r1 = client.claim_vested(&b, &sid);
    assert_eq!(r1, 400);
    env.ledger().set_timestamp(800);
    let r2 = client.claim_vested(&b, &sid);
    assert_eq!(r2, 400); // 800 vested - 400 already released
}

#[test]
#[should_panic(expected = "nothing to release")]
fn release_when_nothing_vested_panics() {
    let (env, _admin, client) = setup();
    let b = Address::generate(&env);
    // cliff at 500, ledger at 0
    let sid = client.create_schedule(&b, &1_000, &0, &500, &1_000);
    env.ledger().set_timestamp(0);
    client.claim_vested(&b, &sid);
}

#[test]
#[should_panic(expected = "nothing to release")]
fn release_before_cliff_panics() {
    let (env, _admin, client) = setup();
    let b = Address::generate(&env);
    // cliff at start(100) + cliff_duration(200) = 300; ledger at 150
    let sid = client.create_schedule(&b, &1_000, &100, &200, &1_000);
    env.ledger().set_timestamp(150);
    client.claim_vested(&b, &sid);
}

#[test]
#[should_panic(expected = "nothing to release")]
fn double_release_at_same_time_panics() {
    let (env, _admin, client) = setup();
    let b = Address::generate(&env);
    let sid = client.create_schedule(&b, &1_000, &0, &0, &1_000);
    env.ledger().set_timestamp(1_000);
    client.claim_vested(&b, &sid);
    client.claim_vested(&b, &sid); // nothing left
}

#[test]
#[should_panic(expected = "schedule not found")]
fn release_nonexistent_schedule_panics() {
    let (env, _admin, client) = setup();
    let b = Address::generate(&env);
    client.claim_vested(&b, &99);
}

#[test]
#[should_panic(expected = "insufficient pool balance")]
fn release_when_pool_empty_panics() {
    let env = Env::default();
    env.mock_all_auths();
    let id = env.register(VestingContract, ());
    let client = VestingContractClient::new(&env, &id);
    let admin = Address::generate(&env);
    client.initialize(&admin);
    // do NOT fund pool
    let b = Address::generate(&env);
    let sid = client.create_schedule(&b, &1_000, &0, &0, &1_000);
    env.ledger().set_timestamp(1_000);
    client.claim_vested(&b, &sid);
}

// ── get_schedule ──────────────────────────────────────────────────────────────

#[test]
#[should_panic(expected = "schedule not found")]
fn get_nonexistent_schedule_panics() {
    let (env, _admin, client) = setup();
    let b = Address::generate(&env);
    client.get_schedule(&b, &0);
}

// ── boundary ──────────────────────────────────────────────────────────────────

#[test]
fn multiple_beneficiaries_independent_schedules() {
    let (env, _admin, client) = setup();
    let b1 = Address::generate(&env);
    let b2 = Address::generate(&env);
    let s1 = client.create_schedule(&b1, &300, &0, &0, &300);
    let s2 = client.create_schedule(&b2, &700, &0, &0, &700);
    env.ledger().set_timestamp(300);
    let r1 = client.claim_vested(&b1, &s1);
    assert_eq!(r1, 300);
    env.ledger().set_timestamp(700);
    let r2 = client.claim_vested(&b2, &s2);
    assert_eq!(r2, 700);
}

// ── zero cliff / immediate full vest ─────────────────────────────────────────

#[test]
fn zero_cliff_vesting_starts_immediately() {
    let (env, _admin, client) = setup();
    let b = Address::generate(&env);
    let sid = client.create_schedule(&b, &1_000, &0, &0, &1_000);
    env.ledger().set_timestamp(1);
    let released = client.claim_vested(&b, &sid);
    assert_eq!(released, 1);
}

#[test]
fn immediate_full_vest_with_duration_one() {
    let (env, _admin, client) = setup();
    let b = Address::generate(&env);
    // duration=1, elapsed>=1 → fully vested
    let sid = client.create_schedule(&b, &1_000, &0, &0, &1);
    env.ledger().set_timestamp(1);
    let released = client.claim_vested(&b, &sid);
    assert_eq!(released, 1_000);
}

// ── revoke ────────────────────────────────────────────────────────────────────

#[test]
fn revoke_returns_unvested_to_pool() {
    let (env, _admin, client) = setup();
    let b = Address::generate(&env);
    let sid = client.create_schedule(&b, &1_000, &0, &0, &1_000);
    // at t=400: 400 vested, 600 unvested
    env.ledger().set_timestamp(400);
    let returned = client.revoke(&b, &sid);
    assert_eq!(returned, 600);
    assert_eq!(client.pool_balance(), 1_000_600);
}

#[test]
fn revoke_allows_claiming_vested_portion() {
    let (env, _admin, client) = setup();
    let b = Address::generate(&env);
    let sid = client.create_schedule(&b, &1_000, &0, &0, &1_000);
    env.ledger().set_timestamp(500);
    client.revoke(&b, &sid);
    let claimed = client.claim_vested(&b, &sid);
    assert_eq!(claimed, 500);
}

#[test]
fn revoke_stops_further_vesting() {
    let (env, _admin, client) = setup();
    let b = Address::generate(&env);
    let sid = client.create_schedule(&b, &1_000, &0, &0, &1_000);
    env.ledger().set_timestamp(300);
    client.revoke(&b, &sid);
    // claim at a much later time — still capped at 300
    env.ledger().set_timestamp(9_999);
    let claimed = client.claim_vested(&b, &sid);
    assert_eq!(claimed, 300);
}

#[test]
#[should_panic(expected = "already revoked")]
fn revoke_twice_panics() {
    let (env, _admin, client) = setup();
    let b = Address::generate(&env);
    let sid = client.create_schedule(&b, &1_000, &0, &0, &1_000);
    env.ledger().set_timestamp(500);
    client.revoke(&b, &sid);
    client.revoke(&b, &sid);
}

#[test]
#[should_panic(expected = "schedule not found")]
fn revoke_nonexistent_schedule_panics() {
    let (env, _admin, client) = setup();
    let b = Address::generate(&env);
    client.revoke(&b, &99);
}

#[test]
fn revoke_fully_vested_returns_zero() {
    let (env, _admin, client) = setup();
    let b = Address::generate(&env);
    let sid = client.create_schedule(&b, &1_000, &0, &0, &1_000);
    env.ledger().set_timestamp(1_000);
    let returned = client.revoke(&b, &sid);
    assert_eq!(returned, 0);
}

#[test]
fn revoke_before_cliff_returns_all() {
    let (env, _admin, client) = setup();
    let b = Address::generate(&env);
    // cliff=500; revoke at t=100 (before cliff)
    let sid = client.create_schedule(&b, &1_000, &0, &500, &1_000);
    env.ledger().set_timestamp(100);
    let returned = client.revoke(&b, &sid);
    assert_eq!(returned, 1_000);
}

#[test]
fn revoke_partial_then_claim_then_no_more() {
    let (env, _admin, client) = setup();
    let b = Address::generate(&env);
    let sid = client.create_schedule(&b, &1_000, &0, &0, &1_000);
    // claim 200 first
    env.ledger().set_timestamp(200);
    let first = client.claim_vested(&b, &sid);
    assert_eq!(first, 200);
    // revoke at t=600: 600 vested total, 200 already released, 400 unvested returned
    env.ledger().set_timestamp(600);
    let returned = client.revoke(&b, &sid);
    assert_eq!(returned, 400);
    // claim remaining vested-but-not-released (600 - 200 = 400)
    let second = client.claim_vested(&b, &sid);
    assert_eq!(second, 400);
}
