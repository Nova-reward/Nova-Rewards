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
    // setup already funded 1_000_000
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

// ── release ───────────────────────────────────────────────────────────────────

#[test]
fn release_before_cliff_nothing_vested() {
    let (env, _admin, client) = setup();
    let b = Address::generate(&env);
    // cliff at start_time(100) + cliff_duration(200) = 300; ledger at 150
    let sid = client.create_schedule(&b, &1_000, &100, &200, &1_000);
    env.ledger().set_timestamp(150);
    // schedule.released must still be 0 — nothing vested before cliff
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
    let released = client.release(&b, &sid);
    assert_eq!(released, 500);
    assert_eq!(client.pool_balance(), 999_500);
}

#[test]
fn release_after_full_duration_gives_total() {
    let (env, _admin, client) = setup();
    let b = Address::generate(&env);
    let sid = client.create_schedule(&b, &1_000, &0, &0, &1_000);
    env.ledger().set_timestamp(1_000);
    let released = client.release(&b, &sid);
    assert_eq!(released, 1_000);
}

#[test]
fn release_beyond_duration_gives_total() {
    let (env, _admin, client) = setup();
    let b = Address::generate(&env);
    let sid = client.create_schedule(&b, &1_000, &0, &0, &1_000);
    env.ledger().set_timestamp(9_999);
    let released = client.release(&b, &sid);
    assert_eq!(released, 1_000);
}

#[test]
fn release_twice_gives_incremental_amounts() {
    let (env, _admin, client) = setup();
    let b = Address::generate(&env);
    let sid = client.create_schedule(&b, &1_000, &0, &0, &1_000);
    env.ledger().set_timestamp(400);
    let r1 = client.release(&b, &sid);
    assert_eq!(r1, 400);
    env.ledger().set_timestamp(800);
    let r2 = client.release(&b, &sid);
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
    client.release(&b, &sid);
}

#[test]
#[should_panic(expected = "nothing to release")]
fn release_before_cliff_panics() {
    let (env, _admin, client) = setup();
    let b = Address::generate(&env);
    // cliff at start(100) + cliff_duration(200) = 300; ledger at 150
    let sid = client.create_schedule(&b, &1_000, &100, &200, &1_000);
    env.ledger().set_timestamp(150);
    client.release(&b, &sid);
}

#[test]
#[should_panic(expected = "nothing to release")]
fn double_release_at_same_time_panics() {
    let (env, _admin, client) = setup();
    let b = Address::generate(&env);
    let sid = client.create_schedule(&b, &1_000, &0, &0, &1_000);
    env.ledger().set_timestamp(1_000);
    client.release(&b, &sid);
    client.release(&b, &sid); // nothing left
}

#[test]
#[should_panic(expected = "schedule not found")]
fn release_nonexistent_schedule_panics() {
    let (env, _admin, client) = setup();
    let b = Address::generate(&env);
    client.release(&b, &99);
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
    client.release(&b, &sid);
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
    let r1 = client.release(&b1, &s1);
    assert_eq!(r1, 300);
    env.ledger().set_timestamp(700);
    let r2 = client.release(&b2, &s2);
    assert_eq!(r2, 700);
}
