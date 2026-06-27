//! # Contract State Management
//!
//! Generic key/value state store with versioned snapshots, migration support,
//! admin-controlled recovery, and M-of-N upgrade mechanism.
//!
//! ## Event Schema (v1)
//! All events include `schema_version` as the first data element.
//!
//! | topics                      | data                                                    |
//! |-----------------------------|---------------------------------------------------------|
//! | `("state", "set")`          | `(v, schema_version_counter)`                           |
//! | `("state", "delete")`       | `(v, schema_version_counter)`                           |
//! | `("state", "snapshot")`     | `(v, schema_version_counter)`                           |
//! | `("state", "migrate")`      | `(v, new_version)`                                      |
//! | `("state", "recover")`      | `(v, snap_version)`                                     |
//! | `("state", "upgraded")`     | `(v, new_wasm_hash)`                                    |
#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, Address, Bytes, BytesN, Env, Vec,
};

// ── Constants ─────────────────────────────────────────────────────────────────
const TTL: u32 = 31_536_000;

/// Schema version for all events emitted by this contract.
pub const EVENT_SCHEMA_VERSION: u32 = 1;

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
    /// Multisig signers for upgrade authorization
    Signers,
    /// Minimum approvals required for upgrade
    Threshold,
    /// Pending upgrade approvals: wasm_hash -> Vec<Address>
    UpgradeApprovals(BytesN<32>),
}

// ── Event helpers ─────────────────────────────────────────────────────────────

fn emit_state_set(env: &Env, schema_version: u32) {
    env.events().publish(
        (symbol_short!("state"), symbol_short!("set")),
        (EVENT_SCHEMA_VERSION, schema_version),
    );
}

fn emit_state_delete(env: &Env, schema_version: u32) {
    env.events().publish(
        (symbol_short!("state"), symbol_short!("delete")),
        (EVENT_SCHEMA_VERSION, schema_version),
    );
}

fn emit_snapshot(env: &Env, schema_version: u32) {
    env.events().publish(
        (symbol_short!("state"), symbol_short!("snapshot")),
        (EVENT_SCHEMA_VERSION, schema_version),
    );
}

fn emit_migrate(env: &Env, new_version: u32) {
    env.events().publish(
        (symbol_short!("state"), symbol_short!("migrate")),
        (EVENT_SCHEMA_VERSION, new_version),
    );
}

fn emit_recover(env: &Env, snap_version: u32) {
    env.events().publish(
        (symbol_short!("state"), symbol_short!("recover")),
        (EVENT_SCHEMA_VERSION, snap_version),
    );
}

fn emit_contract_upgraded(env: &Env, new_wasm_hash: &BytesN<32>) {
    env.events().publish(
        (symbol_short!("state"), symbol_short!("upgraded")),
        (EVENT_SCHEMA_VERSION, new_wasm_hash.clone()),
    );
}

// ── Contract ──────────────────────────────────────────────────────────────────
#[contract]
pub struct StateContract;

#[contractimpl]
impl StateContract {
    /// Initialize the contract.
    ///
    /// # Parameters
    /// - `admin` – Admin address.
    /// - `signers` – Multisig signer set for upgrade authorization.
    /// - `threshold` – Minimum approvals required to execute an upgrade.
    pub fn initialize(env: Env, admin: Address, signers: Vec<Address>, threshold: u32) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialised");
        }
        assert!(threshold >= 1, "threshold must be at least 1");
        assert!(
            signers.len() >= threshold,
            "signers count must be >= threshold"
        );
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Version, &0_u32);
        env.storage().instance().set(&DataKey::Signers, &signers);
        env.storage().instance().set(&DataKey::Threshold, &threshold);
    }

    fn admin(env: &Env) -> Address {
        env.storage().instance().get(&DataKey::Admin).unwrap()
    }

    fn version(env: &Env) -> u32 {
        env.storage().instance().get(&DataKey::Version).unwrap_or(0)
    }

    /// Stores or updates a state entry. Admin only.
    ///
    /// # Events
    /// Emits `("state", "set")` with `(schema_version, current_version)`.
    pub fn set(env: Env, key: Bytes, value: Bytes) {
        Self::admin(&env).require_auth();
        assert!(!key.is_empty(), "key must not be empty");
        let k = DataKey::State(key);
        env.storage().persistent().set(&k, &value);
        env.storage().persistent().extend_ttl(&k, TTL, TTL);

        emit_state_set(&env, Self::version(&env));
    }

    /// Returns a state entry. Panics if not found.
    pub fn get(env: Env, key: Bytes) -> Bytes {
        let k = DataKey::State(key);
        let val = env.storage().persistent().get(&k).expect("key not found");
        env.storage().persistent().extend_ttl(&k, TTL, TTL);
        val
    }

    /// Deletes a state entry. Admin only.
    ///
    /// # Events
    /// Emits `("state", "delete")` with `(schema_version, current_version)`.
    pub fn delete(env: Env, key: Bytes) {
        Self::admin(&env).require_auth();
        let k = DataKey::State(key);
        assert!(env.storage().persistent().has(&k), "key not found");
        env.storage().persistent().remove(&k);

        emit_state_delete(&env, Self::version(&env));
    }

    /// Saves a snapshot of `key`'s current value at the current version. Admin only.
    ///
    /// # Events
    /// Emits `("state", "snapshot")` with `(schema_version, current_version)`.
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

        emit_snapshot(&env, ver);
    }

    /// Bumps the schema version. Admin only.
    ///
    /// # Events
    /// Emits `("state", "migrate")` with `(schema_version, new_version)`.
    pub fn migrate(env: Env) -> u32 {
        Self::admin(&env).require_auth();
        let new_ver = Self::version(&env) + 1;
        env.storage().instance().set(&DataKey::Version, &new_ver);

        emit_migrate(&env, new_ver);
        new_ver
    }

    /// Restores a key's live value from a snapshot at `snap_version`. Admin only.
    ///
    /// # Events
    /// Emits `("state", "recover")` with `(schema_version, snap_version)`.
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

        emit_recover(&env, snap_version);
    }

    /// Returns the current schema version.
    pub fn get_version(env: Env) -> u32 {
        Self::version(&env)
    }

    // ── Upgrade (M-of-N multisig) ─────────────────────────────────────────────

    /// Approve a pending WASM upgrade. Executes when threshold is reached.
    ///
    /// # Events
    /// Emits `("state", "upgraded")` with `(schema_version, new_wasm_hash)` when threshold is met.
    ///
    /// # Panics
    /// - `"not an authorized signer"` if `signer` is not in the signer set.
    /// - `"already approved"` if `signer` has already approved this hash.
    pub fn approve_upgrade(env: Env, signer: Address, new_wasm_hash: BytesN<32>) {
        signer.require_auth();

        let signers: Vec<Address> = env
            .storage()
            .instance()
            .get(&DataKey::Signers)
            .expect("not initialized");
        let is_authorized = signers.iter().any(|s| s == signer);
        assert!(is_authorized, "not an authorized signer");

        let approval_key = DataKey::UpgradeApprovals(new_wasm_hash.clone());
        let mut approvals: Vec<Address> = env
            .storage()
            .instance()
            .get(&approval_key)
            .unwrap_or(Vec::new(&env));

        let already_approved = approvals.iter().any(|a| a == signer);
        assert!(!already_approved, "already approved");

        approvals.push_back(signer);
        env.storage().instance().set(&approval_key, &approvals);

        let threshold: u32 = env
            .storage()
            .instance()
            .get(&DataKey::Threshold)
            .unwrap_or(1);

        if approvals.len() >= threshold {
            env.storage().instance().remove(&approval_key);
            emit_contract_upgraded(&env, &new_wasm_hash);
            env.deployer().update_current_contract_wasm(new_wasm_hash);
        }
    }

    pub fn get_upgrade_approvals(env: Env, new_wasm_hash: BytesN<32>) -> u32 {
        let approval_key = DataKey::UpgradeApprovals(new_wasm_hash);
        let approvals: Vec<Address> = env
            .storage()
            .instance()
            .get(&approval_key)
            .unwrap_or(Vec::new(&env));
        approvals.len()
    }

    pub fn get_threshold(env: Env) -> u32 {
        env.storage()
            .instance()
            .get(&DataKey::Threshold)
            .unwrap_or(1)
    }

    pub fn get_signers(env: Env) -> Vec<Address> {
        env.storage()
            .instance()
            .get(&DataKey::Signers)
            .unwrap_or(Vec::new(&env))
    }
}

// ── Tests ─────────────────────────────────────────────────────────────────────
#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{testutils::Address as _, vec, Bytes, BytesN, Env};

    fn setup() -> (Env, Address, StateContractClient<'static>) {
        let env = Env::default();
        env.mock_all_auths();
        let id = env.register(StateContract, ());
        let client = StateContractClient::new(&env, &id);
        let admin = Address::generate(&env);
        client.initialize(&admin, &vec![&env, admin.clone()], &1);
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
        client.snapshot(&key);
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

    // ── Upgrade tests ─────────────────────────────────────────────────────────

    #[test]
    fn test_upgrade_approval_accumulates() {
        let env = Env::default();
        env.mock_all_auths();
        let id = env.register(StateContract, ());
        let client = StateContractClient::new(&env, &id);
        let s1 = Address::generate(&env);
        let s2 = Address::generate(&env);
        client.initialize(&s1, &vec![&env, s1.clone(), s2.clone()], &2);

        let fake_hash = BytesN::from_array(&env, &[0u8; 32]);
        client.approve_upgrade(&s1, &fake_hash);
        assert_eq!(client.get_upgrade_approvals(&fake_hash), 1);
        assert_eq!(client.get_threshold(), 2);
    }

    #[test]
    #[should_panic(expected = "not an authorized signer")]
    fn test_unauthorized_upgrade_rejected() {
        let (env, _admin, client) = setup();
        let outsider = Address::generate(&env);
        let fake_hash = BytesN::from_array(&env, &[1u8; 32]);
        client.approve_upgrade(&outsider, &fake_hash);
    }

    #[test]
    #[should_panic(expected = "already approved")]
    fn test_duplicate_approval_rejected() {
        let env = Env::default();
        env.mock_all_auths();
        let id = env.register(StateContract, ());
        let client = StateContractClient::new(&env, &id);
        let s1 = Address::generate(&env);
        let s2 = Address::generate(&env);
        client.initialize(&s1, &vec![&env, s1.clone(), s2.clone()], &2);

        let fake_hash = BytesN::from_array(&env, &[2u8; 32]);
        client.approve_upgrade(&s1, &fake_hash);
        client.approve_upgrade(&s1, &fake_hash);
    }

    #[test]
    fn test_state_preserved_across_schema_migration() {
        let (env, _admin, client) = setup();
        let key = Bytes::from_slice(&env, b"persist");
        let val = Bytes::from_slice(&env, b"value");
        client.set(&key, &val);
        // Migrate bumps version but state persists
        client.migrate();
        assert_eq!(client.get(&key), val);
        assert_eq!(client.get_version(), 1);
    }
}
