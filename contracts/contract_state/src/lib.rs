//! # Contract State Management
//!
//! Generic key/value state store with versioned snapshots, migration support,
//! and admin-controlled recovery.
//!
//! ## Lifecycle
//! 1. Admin calls [`initialize`](StateContract::initialize).
//! 2. Admin calls [`set`](StateContract::set) / [`delete`](StateContract::delete) to manage state.
//! 3. Admin calls [`snapshot`](StateContract::snapshot) to capture the current version.
//! 4. Admin calls [`migrate`](StateContract::migrate) to bump the schema version.
//! 5. Admin calls [`recover`](StateContract::recover) to restore a previous snapshot value.
#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, symbol_short, Bytes, Env, Address};

// ── Constants ─────────────────────────────────────────────────────────────────
const TTL: u32 = 31_536_000;

// ── Types ─────────────────────────────────────────────────────────────────────
#[contracttype]
pub enum DataKey {
    Admin,
    /// Schema version counter
    Version,
    /// Live state entry
    State(Bytes),
    /// Snapshot: (key, version) -> value
    Snapshot(Bytes, u32),
}

// ── Contract ──────────────────────────────────────────────────────────────────
#[contract]
pub struct StateContract;

#[contractimpl]
impl StateContract {
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialised");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Version, &0_u32);
    }

    fn admin(env: &Env) -> Address {
        env.storage().instance().get(&DataKey::Admin).unwrap()
    }

    fn version(env: &Env) -> u32 {
        env.storage().instance().get(&DataKey::Version).unwrap_or(0)
    }

    /// Stores or updates a state entry. Admin only.
    pub fn set(env: Env, key: Bytes, value: Bytes) {
        Self::admin(&env).require_auth();
        assert!(!key.is_empty(), "key must not be empty");
        let k = DataKey::State(key);
        env.storage().persistent().set(&k, &value);
        env.storage().persistent().extend_ttl(&k, TTL, TTL);

        env.events().publish(
            (symbol_short!("state"), symbol_short!("set")),
            (Self::version(&env),),
        );
    }

    /// Returns a state entry. Panics if not found.
    pub fn get(env: Env, key: Bytes) -> Bytes {
        let k = DataKey::State(key);
        let val = env.storage().persistent().get(&k).expect("key not found");
        env.storage().persistent().extend_ttl(&k, TTL, TTL);
        val
    }

    /// Deletes a state entry. Admin only.
    pub fn delete(env: Env, key: Bytes) {
        Self::admin(&env).require_auth();
        let k = DataKey::State(key);
        assert!(env.storage().persistent().has(&k), "key not found");
        env.storage().persistent().remove(&k);

        env.events().publish(
            (symbol_short!("state"), symbol_short!("delete")),
            (Self::version(&env),),
        );
    }

    /// Saves a snapshot of `key`'s current value at the current version. Admin only.
    pub fn snapshot(env: Env, key: Bytes) {
        Self::admin(&env).require_auth();
        let state_key = DataKey::State(key.clone());
        let value: Bytes = env
            .storage()
            .persistent()
            .get(&state_key)
            .expect("key not found");
        let ver = Self::version(&env);
        let snap_key = DataKey::Snapshot(key, ver);
        env.storage().persistent().set(&snap_key, &value);
        env.storage().persistent().extend_ttl(&snap_key, TTL, TTL);

        env.events().publish(
            (symbol_short!("state"), symbol_short!("snapshot")),
            (ver,),
        );
    }

    /// Bumps the schema version. Admin only.
    pub fn migrate(env: Env) -> u32 {
        Self::admin(&env).require_auth();
        let new_ver = Self::version(&env) + 1;
        env.storage().instance().set(&DataKey::Version, &new_ver);

        env.events().publish(
            (symbol_short!("state"), symbol_short!("migrate")),
            (new_ver,),
        );
        new_ver
    }

    /// Restores a key's live value from a snapshot at `snap_version`. Admin only.
    pub fn recover(env: Env, key: Bytes, snap_version: u32) {
        Self::admin(&env).require_auth();
        let snap_key = DataKey::Snapshot(key.clone(), snap_version);
        let value: Bytes = env
            .storage()
            .persistent()
            .get(&snap_key)
            .expect("snapshot not found");
        let state_key = DataKey::State(key);
        env.storage().persistent().set(&state_key, &value);
        env.storage().persistent().extend_ttl(&state_key, TTL, TTL);

        env.events().publish(
            (symbol_short!("state"), symbol_short!("recover")),
            (snap_version,),
        );
    }

    /// Returns the current schema version.
    pub fn get_version(env: Env) -> u32 {
        Self::version(&env)
    }
}

// ── Tests ─────────────────────────────────────────────────────────────────────
#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Bytes, Env};

    fn setup() -> (Env, Address, StateContractClient<'static>) {
        let env = Env::default();
        env.mock_all_auths();
        let id = env.register(StateContract, ());
        let client = StateContractClient::new(&env, &id);
        let admin = Address::generate(&env);
        client.initialize(&admin);
        (env, admin, client)
    }

    #[test]
    fn test_set_and_get() {
        let (env, _admin, client) = setup();
        let key = Bytes::from_slice(&env, b"foo");
        let val = Bytes::from_slice(&env, b"bar");
        client.set(&key, &val);
        assert_eq!(client.get(&key), val);
    }

    #[test]
    fn test_snapshot_and_recover() {
        let (env, _admin, client) = setup();
        let key = Bytes::from_slice(&env, b"k");
        let v1 = Bytes::from_slice(&env, b"v1");
        let v2 = Bytes::from_slice(&env, b"v2");
        client.set(&key, &v1);
        client.snapshot(&key);          // snapshot at version 0
        client.set(&key, &v2);
        assert_eq!(client.get(&key), v2);
        client.recover(&key, &0);
        assert_eq!(client.get(&key), v1);
    }

    #[test]
    fn test_migrate_bumps_version() {
        let (_env, _admin, client) = setup();
        assert_eq!(client.get_version(), 0);
        let v = client.migrate();
        assert_eq!(v, 1);
        assert_eq!(client.get_version(), 1);
    }

    #[test]
    fn test_delete() {
        let (env, _admin, client) = setup();
        let key = Bytes::from_slice(&env, b"del");
        let val = Bytes::from_slice(&env, b"x");
        client.set(&key, &val);
        client.delete(&key);
    }

    #[test]
    #[should_panic(expected = "key not found")]
    fn test_get_missing_panics() {
        let (env, _admin, client) = setup();
        client.get(&Bytes::from_slice(&env, b"missing"));
    }
}
