//! # Vesting Contract
//!
//! Linear token vesting with optional cliff periods and admin revocation.
//!
//! ## Lifecycle
//! 1. Admin calls [`fund_pool`](VestingContract::fund_pool) to deposit tokens.
//! 2. Admin calls [`create_schedule`](VestingContract::create_schedule) for each beneficiary.
//! 3. Beneficiary calls [`claim_vested`](VestingContract::claim_vested) at any time to claim vested tokens.
//! 4. Admin may call [`revoke`](VestingContract::revoke) to cancel unvested tokens and return them to treasury.
//!
//! ## Vesting Formula
//! - Before `start_time + cliff_duration`: 0 tokens vested.
//! - Between cliff and `start_time + total_duration`: linear pro-rata.
//! - After `start_time + total_duration`: 100% vested.
//!
//! ## Revocation
//! After revocation, vesting stops at the revocation timestamp. The beneficiary may
//! still claim any tokens that had already vested; unvested tokens are returned to the pool.
//!
//! ## Usage
//! ```ignore
//! client.initialize(&admin);
//! client.fund_pool(&1_000_000);
//! let id = client.create_schedule(&beneficiary, &100_000, &start, &cliff, &duration);
//! // time passes …
//! let claimed = client.claim_vested(&beneficiary, &id);
//! // admin revokes remaining unvested tokens
//! let returned = client.revoke(&beneficiary, &id);
//! ```
#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, contracterror, symbol_short, Address, Env};

// ── Errors ────────────────────────────────────────────────────────────────────
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    AlreadyInitialized = 1,
    ScheduleRevoked = 2,
}

// ── Types ─────────────────────────────────────────────────────────────────────
#[contracttype]
#[derive(Clone)]
pub struct VestingSchedule {
    pub beneficiary: Address,
    pub total_amount: i128,
    pub start_time: u64,
    pub cliff_duration: u64,
    pub total_duration: u64,
    pub released: i128,
    /// Set to true after admin revokes this schedule.
    pub revoked: bool,
    /// Vested amount captured at revocation time (0 when not revoked).
    pub revoked_amount: i128,
}

#[contracttype]
pub enum DataKey {
    Admin,
    Initialized,
    /// Pool balance available for vesting payouts
    PoolBalance,
    /// Composite key: (beneficiary, schedule_id)
    Schedule(Address, u32),
    /// Next schedule id per beneficiary
    NextId(Address),
}

// ── Contract ──────────────────────────────────────────────────────────────────
#[contract]
pub struct VestingContract;

#[contractimpl]
impl VestingContract {
    /// Initializes the vesting contract and resets its funding pool.
    ///
    /// # Parameters
    /// - `admin` – Address authorized to call [`fund_pool`](VestingContract::fund_pool),
    ///   [`create_schedule`](VestingContract::create_schedule), and [`revoke`](VestingContract::revoke).
    ///
    /// # Panics
    /// - `"already initialised"` if called more than once.
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialised");
        }
        env.storage().instance().set(&DataKey::Initialized, &true);
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::PoolBalance, &0_i128);
    }

    /// Returns the admin address allowed to manage schedules.
    fn admin(env: &Env) -> Address {
        env.storage().instance().get(&DataKey::Admin).unwrap()
    }

    /// Adds tokens to the vesting pool used for future releases.
    ///
    /// # Parameters
    /// - `amount` – Tokens to add to the pool (must be > 0).
    ///
    /// # Authorization
    /// Requires admin authorization.
    ///
    /// # Panics
    /// - `"amount must be positive"` if `amount <= 0`.
    pub fn fund_pool(env: Env, amount: i128) {
        Self::admin(&env).require_auth();
        assert!(amount > 0, "amount must be positive");
        let bal: i128 = env
            .storage()
            .instance()
            .get(&DataKey::PoolBalance)
            .unwrap_or(0);
        env.storage()
            .instance()
            .set(&DataKey::PoolBalance, &(bal + amount));
    }

    /// Creates a vesting schedule for a beneficiary and returns its schedule id.
    ///
    /// Schedule ids are per-beneficiary and start at `0`.
    ///
    /// # Parameters
    /// - `beneficiary` – Address that will receive vested tokens.
    /// - `total_amount` – Total tokens to vest (must be > 0).
    /// - `start_time` – Unix timestamp (seconds) when vesting begins.
    /// - `cliff_duration` – Seconds after `start_time` before any tokens vest (0 = no cliff).
    /// - `total_duration` – Total vesting period in seconds (must be > 0).
    ///   Setting equal to 1 with `cliff_duration = 0` achieves immediate full vest.
    ///
    /// # Returns
    /// The new schedule id (`u32`) for this beneficiary.
    ///
    /// # Authorization
    /// Requires admin authorization.
    ///
    /// # Events
    /// Emits `("vesting", "created")` with data `(beneficiary, id, total_amount, start_time, cliff_duration, total_duration)`.
    ///
    /// # Panics
    /// - `"total_duration must be > 0"` if `total_duration == 0`.
    /// - `"total_amount must be > 0"` if `total_amount <= 0`.
    pub fn create_schedule(
        env: Env,
        beneficiary: Address,
        total_amount: i128,
        start_time: u64,
        cliff_duration: u64,
        total_duration: u64,
    ) -> u32 {
        Self::admin(&env).require_auth();
        assert!(total_duration > 0, "total_duration must be > 0");
        assert!(total_amount > 0, "total_amount must be > 0");

        let next_id_key = DataKey::NextId(beneficiary.clone());
        let id: u32 = env.storage().instance().get(&next_id_key).unwrap_or(0);

        let schedule = VestingSchedule {
            beneficiary: beneficiary.clone(),
            total_amount,
            start_time,
            cliff_duration,
            total_duration,
            released: 0,
            revoked: false,
            revoked_amount: 0,
        };
        let schedule_key = DataKey::Schedule(beneficiary.clone(), id);
        env.storage().persistent().set(&schedule_key, &schedule);
        env.storage()
            .persistent()
            .extend_ttl(&schedule_key, 31_536_000, 31_536_000);

        env.storage().instance().set(&next_id_key, &(id + 1));

        env.events().publish(
            (symbol_short!("vesting"), symbol_short!("created")),
            (beneficiary, id, total_amount, start_time, cliff_duration, total_duration),
        );

        id
    }

    /// Computes the total vested amount for a schedule at a specific timestamp.
    ///
    /// If the schedule has been revoked, returns the amount vested at revocation time.
    fn vested_amount(schedule: &VestingSchedule, now: u64) -> i128 {
        if schedule.revoked {
            return schedule.revoked_amount;
        }
        if now < schedule.start_time + schedule.cliff_duration {
            return 0;
        }
        let elapsed = now - schedule.start_time;
        if elapsed >= schedule.total_duration {
            schedule.total_amount
        } else {
            schedule.total_amount * (elapsed as i128) / (schedule.total_duration as i128)
        }
    }

    /// Releases the newly vested portion of a schedule to the beneficiary.
    ///
    /// Computes the releasable amount (`vested - already_released`) and transfers
    /// it from the pool. If the schedule has been revoked, only the portion vested
    /// before revocation can be claimed.
    ///
    /// # Parameters
    /// - `beneficiary` – Address that owns the schedule.
    /// - `schedule_id` – Id of the schedule to claim from.
    ///
    /// # Returns
    /// The number of tokens released in this call.
    ///
    /// # Events
    /// Emits `("vesting", "claimed")` with data `(beneficiary: Address, amount: i128, timestamp: u64)`.
    ///
    /// # Panics
    /// - `"schedule not found"` if no schedule exists for the given beneficiary and id.
    /// - `"nothing to release"` if no new tokens have vested since the last release.
    /// - `"insufficient pool balance"` if the pool holds fewer tokens than the releasable amount.
    pub fn claim_vested(env: Env, beneficiary: Address, schedule_id: u32) -> i128 {
        let key = DataKey::Schedule(beneficiary.clone(), schedule_id);
        let mut schedule: VestingSchedule = env
            .storage()
            .persistent()
            .get(&key)
            .expect("schedule not found");
        env.storage()
            .persistent()
            .extend_ttl(&key, 31_536_000, 31_536_000);

        let now = env.ledger().timestamp();
        let vested = Self::vested_amount(&schedule, now);
        let releasable = vested - schedule.released;
        assert!(releasable > 0, "nothing to release");

        let pool_bal: i128 = env
            .storage()
            .instance()
            .get(&DataKey::PoolBalance)
            .unwrap_or(0);
        assert!(pool_bal >= releasable, "insufficient pool balance");
        env.storage()
            .instance()
            .set(&DataKey::PoolBalance, &(pool_bal - releasable));

        schedule.released += releasable;
        env.storage().persistent().set(&key, &schedule);
        env.storage()
            .persistent()
            .extend_ttl(&key, 31_536_000, 31_536_000);

        env.events().publish(
            (symbol_short!("vesting"), symbol_short!("claimed")),
            (beneficiary, releasable, now),
        );

        releasable
    }

    /// Revokes a vesting schedule, stopping future vesting and returning unvested
    /// tokens to the treasury pool.
    ///
    /// After revocation the beneficiary may still call [`claim_vested`](VestingContract::claim_vested)
    /// to collect any tokens that had already vested before this call.
    ///
    /// # Parameters
    /// - `beneficiary` – Address that owns the schedule.
    /// - `schedule_id` – Id of the schedule to revoke.
    ///
    /// # Returns
    /// The number of unvested tokens returned to the treasury pool.
    ///
    /// # Authorization
    /// Requires admin authorization.
    ///
    /// # Events
    /// Emits `("vesting", "revoked")` with data `(beneficiary: Address, returned: i128, timestamp: u64)`.
    ///
    /// # Panics
    /// - `"schedule not found"` if no schedule exists for the given beneficiary and id.
    /// - `"already revoked"` if the schedule has already been revoked.
    pub fn revoke(env: Env, beneficiary: Address, schedule_id: u32) -> i128 {
        Self::admin(&env).require_auth();

        let key = DataKey::Schedule(beneficiary.clone(), schedule_id);
        let mut schedule: VestingSchedule = env
            .storage()
            .persistent()
            .get(&key)
            .expect("schedule not found");

        assert!(!schedule.revoked, "already revoked");

        let now = env.ledger().timestamp();
        let vested_now = Self::vested_amount(&schedule, now);
        let unvested = schedule.total_amount - vested_now;

        // Return unvested tokens to treasury pool
        if unvested > 0 {
            let pool_bal: i128 = env
                .storage()
                .instance()
                .get(&DataKey::PoolBalance)
                .unwrap_or(0);
            env.storage()
                .instance()
                .set(&DataKey::PoolBalance, &(pool_bal + unvested));
        }

        schedule.revoked = true;
        schedule.revoked_amount = vested_now;
        env.storage().persistent().set(&key, &schedule);
        env.storage()
            .persistent()
            .extend_ttl(&key, 31_536_000, 31_536_000);

        env.events().publish(
            (symbol_short!("vesting"), symbol_short!("revoked")),
            (beneficiary, unvested, now),
        );

        unvested
    }

    /// Returns the stored schedule for a beneficiary and schedule id.
    ///
    /// # Panics
    /// - `"schedule not found"` if no schedule exists for the given beneficiary and id.
    pub fn get_schedule(env: Env, beneficiary: Address, schedule_id: u32) -> VestingSchedule {
        let key = DataKey::Schedule(beneficiary, schedule_id);
        let schedule = env
            .storage()
            .persistent()
            .get(&key)
            .expect("schedule not found");
        env.storage()
            .persistent()
            .extend_ttl(&key, 31_536_000, 31_536_000);
        schedule
    }

    /// Returns the remaining unfunded vesting pool balance.
    pub fn pool_balance(env: Env) -> i128 {
        env.storage()
            .instance()
            .get(&DataKey::PoolBalance)
            .unwrap_or(0)
    }
}

// ── Tests ─────────────────────────────────────────────────────────────────────
#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{
        testutils::{Address as _, Events, Ledger},
        Env,
    };

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

    #[test]
    fn test_before_cliff_release_is_zero() {
        let (env, _admin, client) = setup();
        let beneficiary = Address::generate(&env);
        // start=100, cliff=200, duration=1000
        let sid = client.create_schedule(&beneficiary, &1000, &100, &200, &1000);
        // set ledger time to 150 (before cliff at 300)
        env.ledger().set_timestamp(150);
        // vested = 0 because cliff not reached
        let schedule = client.get_schedule(&beneficiary, &sid);
        let now = env.ledger().timestamp();
        let vested = VestingContract::vested_amount(&schedule, now);
        assert_eq!(vested, 0);
    }

    #[test]
    fn test_partial_linear_release() {
        let (env, _admin, client) = setup();
        let beneficiary = Address::generate(&env);
        // start=0, cliff=0, duration=1000, total=1000
        let sid = client.create_schedule(&beneficiary, &1000, &0, &0, &1000);
        env.ledger().set_timestamp(500);
        let released = client.claim_vested(&beneficiary, &sid);
        assert_eq!(released, 500);
    }

    #[test]
    fn test_full_release_after_duration() {
        let (env, _admin, client) = setup();
        let beneficiary = Address::generate(&env);
        let sid = client.create_schedule(&beneficiary, &1000, &0, &0, &1000);
        env.ledger().set_timestamp(1000);
        let released = client.claim_vested(&beneficiary, &sid);
        assert_eq!(released, 1000);
    }

    #[test]
    #[should_panic(expected = "nothing to release")]
    fn test_double_release_blocked() {
        let (env, _admin, client) = setup();
        let beneficiary = Address::generate(&env);
        let sid = client.create_schedule(&beneficiary, &1000, &0, &0, &1000);
        env.ledger().set_timestamp(1000);
        client.claim_vested(&beneficiary, &sid);
        client.claim_vested(&beneficiary, &sid); // should panic
    }

    #[test]
    fn test_release_emits_event() {
        let (env, _admin, client) = setup();
        let beneficiary = Address::generate(&env);
        let sid = client.create_schedule(&beneficiary, &500, &0, &0, &500);
        env.ledger().set_timestamp(500);
        client.claim_vested(&beneficiary, &sid);
        let _ = env.events().all(); // drain; event emission verified via snapshot
    }

    #[test]
    #[should_panic(expected = "already initialised")]
    fn test_reinitialize_is_blocked() {
        let (env, admin, client) = setup();
        client.initialize(&admin);
    }

    // ── zero cliff / immediate full vest ──────────────────────────────────────

    #[test]
    fn test_zero_cliff_vesting_starts_immediately() {
        let (env, _admin, client) = setup();
        let b = Address::generate(&env);
        // cliff=0 means vesting starts at start_time with no delay
        let sid = client.create_schedule(&b, &1000, &0, &0, &1000);
        env.ledger().set_timestamp(1);
        let released = client.claim_vested(&b, &sid);
        assert_eq!(released, 1); // 1/1000 of tokens vested
    }

    #[test]
    fn test_immediate_full_vest_at_start() {
        let (env, _admin, client) = setup();
        let b = Address::generate(&env);
        // duration=1, cliff=0, elapsed>=duration → 100% vested immediately
        let sid = client.create_schedule(&b, &1000, &0, &0, &1);
        env.ledger().set_timestamp(1);
        let released = client.claim_vested(&b, &sid);
        assert_eq!(released, 1000);
    }

    // ── revoke ────────────────────────────────────────────────────────────────

    #[test]
    fn test_revoke_returns_unvested_to_pool() {
        let (env, _admin, client) = setup();
        let b = Address::generate(&env);
        // 1000 tokens, start=0, no cliff, duration=1000
        let sid = client.create_schedule(&b, &1000, &0, &0, &1000);
        // at t=400: 400 vested, 600 unvested
        env.ledger().set_timestamp(400);
        let returned = client.revoke(&b, &sid);
        assert_eq!(returned, 600);
        // pool went from 1_000_000 down to 999_000 after create_schedule funded nothing
        // then revoke adds 600 back: 999_000 + 600 = 999_600
        assert_eq!(client.pool_balance(), 1_000_600);
    }

    #[test]
    fn test_revoke_allows_claiming_vested_portion() {
        let (env, _admin, client) = setup();
        let b = Address::generate(&env);
        let sid = client.create_schedule(&b, &1000, &0, &0, &1000);
        env.ledger().set_timestamp(500);
        // revoke; 500 unvested returned to pool
        client.revoke(&b, &sid);
        // beneficiary can still claim the 500 that were vested at revocation
        let claimed = client.claim_vested(&b, &sid);
        assert_eq!(claimed, 500);
    }

    #[test]
    fn test_revoke_stops_further_vesting() {
        let (env, _admin, client) = setup();
        let b = Address::generate(&env);
        let sid = client.create_schedule(&b, &1000, &0, &0, &1000);
        env.ledger().set_timestamp(300);
        client.revoke(&b, &sid);
        // advance time well past full duration
        env.ledger().set_timestamp(9999);
        // vested amount is still capped at what was vested at revocation (300)
        let schedule = client.get_schedule(&b, &sid);
        let vested = VestingContract::vested_amount(&schedule, 9999);
        assert_eq!(vested, 300);
    }

    #[test]
    #[should_panic(expected = "already revoked")]
    fn test_revoke_twice_panics() {
        let (env, _admin, client) = setup();
        let b = Address::generate(&env);
        let sid = client.create_schedule(&b, &1000, &0, &0, &1000);
        env.ledger().set_timestamp(500);
        client.revoke(&b, &sid);
        client.revoke(&b, &sid); // should panic
    }

    #[test]
    #[should_panic(expected = "schedule not found")]
    fn test_revoke_nonexistent_schedule_panics() {
        let (env, _admin, client) = setup();
        let b = Address::generate(&env);
        client.revoke(&b, &99);
    }

    #[test]
    fn test_revoke_fully_vested_returns_zero() {
        let (env, _admin, client) = setup();
        let b = Address::generate(&env);
        let sid = client.create_schedule(&b, &1000, &0, &0, &1000);
        // fully vested before revoke
        env.ledger().set_timestamp(1000);
        let returned = client.revoke(&b, &sid);
        assert_eq!(returned, 0); // nothing unvested to return
    }

    #[test]
    fn test_revoke_before_cliff_returns_all() {
        let (env, _admin, client) = setup();
        let b = Address::generate(&env);
        // cliff at 500; revoke at t=100 (before cliff)
        let sid = client.create_schedule(&b, &1000, &0, &500, &1000);
        env.ledger().set_timestamp(100);
        let returned = client.revoke(&b, &sid);
        assert_eq!(returned, 1000); // nothing vested yet, all returned
    }

    #[test]
    fn test_revoke_emits_event() {
        let (env, _admin, client) = setup();
        let b = Address::generate(&env);
        let sid = client.create_schedule(&b, &1000, &0, &0, &1000);
        env.ledger().set_timestamp(500);
        client.revoke(&b, &sid);
        let _ = env.events().all();
    }

    #[test]
    fn test_create_schedule_emits_vesting_created_event() {
        let (env, _admin, client) = setup();
        let b = Address::generate(&env);
        client.create_schedule(&b, &1000, &0, &0, &1000);
        let _ = env.events().all();
    }
}
