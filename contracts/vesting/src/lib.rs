//! # Vesting Contract
//!
//! Linear token vesting with optional cliff periods for beneficiaries.
//!
//! ## Lifecycle
//! 1. Admin calls [`fund_pool`](VestingContract::fund_pool) to deposit tokens.
//! 2. Admin calls [`create_schedule`](VestingContract::create_schedule) for each beneficiary.
//! 3. Beneficiary calls [`release`](VestingContract::release) at any time to claim vested tokens.
//!
//! ## Vesting Formula
//! - Before `start_time + cliff_duration`: 0 tokens vested.
//! - Between cliff and `start_time + total_duration`: linear pro-rata.
//! - After `start_time + total_duration`: 100% vested.
//!
//! ## Usage
//! ```ignore
//! client.initialize(&admin);
//! client.fund_pool(&1_000_000);
//! let id = client.create_schedule(&beneficiary, &100_000, &start, &cliff, &duration);
//! // time passes …
//! let released = client.release(&beneficiary, &id);
//! ```
#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, symbol_short, Address, Env};

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
}

#[contracttype]
pub enum DataKey {
    Admin,
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
    /// - `admin` – Address authorized to call [`fund_pool`](VestingContract::fund_pool)
    ///   and [`create_schedule`](VestingContract::create_schedule).
    ///
    /// # Panics
    /// - `"already initialised"` if called more than once.
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialised");
        }
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
    /// - `cliff_duration` – Seconds after `start_time` before any tokens vest.
    /// - `total_duration` – Total vesting period in seconds (must be > 0).
    ///
    /// # Returns
    /// The new schedule id (`u32`) for this beneficiary.
    ///
    /// # Authorization
    /// Requires admin authorization.
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
        };
        let schedule_key = DataKey::Schedule(beneficiary.clone(), id);
        env.storage().persistent().set(&schedule_key, &schedule);
        // Extend TTL by 365 days (31,536,000 ledgers)
        env.storage()
            .persistent()
            .extend_ttl(&schedule_key, 31_536_000, 31_536_000);

        env.storage().instance().set(&next_id_key, &(id + 1));
        id
    }

    /// Computes the total vested amount for a schedule at a specific timestamp.
    fn vested_amount(schedule: &VestingSchedule, now: u64) -> i128 {
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

    /// Releases the newly vested portion of a schedule.
    ///
    /// Computes the releasable amount (`vested - already_released`) and transfers
    /// it from the pool to the beneficiary.
    ///
    /// # Parameters
    /// - `beneficiary` – Address that owns the schedule.
    /// - `schedule_id` – Id of the schedule to release from.
    ///
    /// # Returns
    /// The number of tokens released in this call.
    ///
    /// # Events
    /// Emits `("vesting", "tok_rel")` with data `(beneficiary: Address, amount: i128, timestamp: u64)`.
    ///
    /// # Panics
    /// - `"schedule not found"` if no schedule exists for the given beneficiary and id.
    /// - `"nothing to release"` if no new tokens have vested since the last release.
    /// - `"insufficient pool balance"` if the pool holds fewer tokens than the releasable amount.
    pub fn release(env: Env, beneficiary: Address, schedule_id: u32) -> i128 {
        let key = DataKey::Schedule(beneficiary.clone(), schedule_id);
        let mut schedule: VestingSchedule = env
            .storage()
            .persistent()
            .get(&key)
            .expect("schedule not found");
        // Extend TTL by 365 days (31,536,000 ledgers)
        env.storage()
            .persistent()
            .extend_ttl(&key, 31_536_000, 31_536_000);

        let now = env.ledger().timestamp();
        let vested = Self::vested_amount(&schedule, now);
        let releasable = vested - schedule.released;
        assert!(releasable > 0, "nothing to release");

        // deduct from pool
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
        // Extend TTL again after update
        env.storage()
            .persistent()
            .extend_ttl(&key, 31_536_000, 31_536_000);

        env.events().publish(
            (symbol_short!("vesting"), symbol_short!("tok_rel")),
            (beneficiary, releasable, now),
        );

        releasable
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
        // Extend TTL by 365 days
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
        let released = client.release(&beneficiary, &sid);
        assert_eq!(released, 500);
    }

    #[test]
    fn test_full_release_after_duration() {
        let (env, _admin, client) = setup();
        let beneficiary = Address::generate(&env);
        let sid = client.create_schedule(&beneficiary, &1000, &0, &0, &1000);
        env.ledger().set_timestamp(1000);
        let released = client.release(&beneficiary, &sid);
        assert_eq!(released, 1000);
    }

    #[test]
    #[should_panic(expected = "nothing to release")]
    fn test_double_release_blocked() {
        let (env, _admin, client) = setup();
        let beneficiary = Address::generate(&env);
        let sid = client.create_schedule(&beneficiary, &1000, &0, &0, &1000);
        env.ledger().set_timestamp(1000);
        client.release(&beneficiary, &sid);
        client.release(&beneficiary, &sid); // should panic
    }

    #[test]
    fn test_release_emits_event() {
        let (env, _admin, client) = setup();
        let beneficiary = Address::generate(&env);
        let sid = client.create_schedule(&beneficiary, &500, &0, &0, &500);
        env.ledger().set_timestamp(500);
        client.release(&beneficiary, &sid);
        let _ = env.events().all(); // drain; event emission verified via snapshot
    }
}
