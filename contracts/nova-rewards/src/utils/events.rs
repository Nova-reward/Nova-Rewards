//! # Event System — Nova Rewards Contract
//!
//! Centralised event definitions and emitters for the Nova Rewards contract.
//!
//! Every state-changing operation emits a typed event via this module so that
//! off-chain indexers, monitoring tools, and the backend event service have a
//! single, consistent source of truth for all contract events.
//!
//! ## Schema version
//! All events carry `schema_version = 1` as the first data element.
//! Increment `EVENT_SCHEMA_VERSION` and bump the minor version in
//! `docs/contract-events.md` whenever the payload shape changes.
//!
//! ## Event taxonomy (v1)
//!
//! | Topic 0      | Topic 1      | Data fields                                              | Trigger                      |
//! |--------------|--------------|----------------------------------------------------------|------------------------------|
//! | `nova_rwd`   | `init`       | `(v, admin: Address)`                                    | Contract first init          |
//! | `nova_rwd`   | `bal_set`    | `(v, user: Address, amount: i128)`                       | Admin sets balance           |
//! | `nova_rwd`   | `staked`     | `(v, staker: Address, amount: i128, ts: u64)`            | User stakes tokens           |
//! | `nova_rwd`   | `unstaked`   | `(v, staker: Address, principal: i128, yield: i128, ts: u64)` | User unstakes           |
//! | `nova_rwd`   | `rate_set`   | `(v, rate: i128)`                                        | Admin updates annual rate    |
//! | `nova_rwd`   | `swap`       | `(v, user: Address, nova: i128, xlm: i128, path)`        | User swaps Nova → XLM        |
//! | `nova_rwd`   | `paused`     | `(v, procedure: Symbol, ts: u64)`                        | Admin pauses contract        |
//! | `nova_rwd`   | `resumed`    | `(v, ts: u64)`                                           | Admin resumes contract       |
//! | `nova_rwd`   | `emrg_paus`  | `(v, expiry: u64)`                                       | Admin emergency-pauses       |
//! | `nova_rwd`   | `rec_op`     | `(v, recovery_admin: Address)`                           | Recovery admin set           |
//! | `nova_rwd`   | `snap`       | `(v, user: Address, balance: i128, ts: u64)`             | Account snapshot taken       |
//! | `nova_rwd`   | `restore`    | `(v, user: Address, balance: i128, ts: u64)`             | Account snapshot restored    |
//! | `nova_rwd`   | `rec_tx`     | `(v, user: Address, delta: i128, new_bal: i128)`         | Recovery transaction applied |
//! | `nova_rwd`   | `rec_funds`  | `(v, from: Address, to: Address, amount: i128)`          | Recovery fund transfer       |
//! | `nova_rwd`   | `upgraded`   | `(v, wasm_hash: BytesN<32>, version: u32)`               | Contract WASM upgraded       |

use soroban_sdk::{symbol_short, Address, BytesN, Env, Symbol, Vec};

/// Schema version embedded in every event payload.
/// Increment when the payload shape changes; document in `docs/contract-events.md`.
pub const EVENT_SCHEMA_VERSION: u32 = 1;

// ── Emitters ──────────────────────────────────────────────────────────────────

/// Emitted once when the contract is first initialised.
pub fn emit_initialized(env: &Env, admin: &Address) {
    env.events().publish(
        (symbol_short!("nova_rwd"), symbol_short!("init")),
        (EVENT_SCHEMA_VERSION, admin.clone()),
    );
}

/// Emitted when an admin directly sets a user's balance.
pub fn emit_balance_set(env: &Env, user: &Address, amount: i128) {
    env.events().publish(
        (symbol_short!("nova_rwd"), symbol_short!("bal_set")),
        (EVENT_SCHEMA_VERSION, user.clone(), amount),
    );
}

/// Emitted when a user stakes tokens.
pub fn emit_staked(env: &Env, staker: &Address, amount: i128, timestamp: u64) {
    env.events().publish(
        (symbol_short!("nova_rwd"), symbol_short!("staked")),
        (EVENT_SCHEMA_VERSION, staker.clone(), amount, timestamp),
    );
}

/// Emitted when a user unstakes tokens and collects yield.
pub fn emit_unstaked(
    env: &Env,
    staker: &Address,
    principal: i128,
    yield_amount: i128,
    timestamp: u64,
) {
    env.events().publish(
        (symbol_short!("nova_rwd"), symbol_short!("unstaked")),
        (EVENT_SCHEMA_VERSION, staker.clone(), principal, yield_amount, timestamp),
    );
}

/// Emitted when the admin updates the annual staking rate.
pub fn emit_rate_set(env: &Env, rate: i128) {
    env.events().publish(
        (symbol_short!("nova_rwd"), symbol_short!("rate_set")),
        (EVENT_SCHEMA_VERSION, rate),
    );
}

/// Emitted when a user swaps Nova points for XLM.
pub fn emit_swap(
    env: &Env,
    user: &Address,
    nova_amount: i128,
    xlm_received: i128,
    path: Vec<Address>,
) {
    env.events().publish(
        (symbol_short!("nova_rwd"), symbol_short!("swap")),
        (EVENT_SCHEMA_VERSION, user.clone(), nova_amount, xlm_received, path),
    );
}

/// Emitted when the contract is paused by the admin.
pub fn emit_paused(env: &Env, procedure: Symbol, timestamp: u64) {
    env.events().publish(
        (symbol_short!("nova_rwd"), symbol_short!("paused")),
        (EVENT_SCHEMA_VERSION, procedure, timestamp),
    );
}

/// Emitted when the contract is resumed after a pause.
pub fn emit_resumed(env: &Env, timestamp: u64) {
    env.events().publish(
        (symbol_short!("nova_rwd"), symbol_short!("resumed")),
        (EVENT_SCHEMA_VERSION, timestamp),
    );
}

/// Emitted when an emergency pause with auto-expiry is set.
pub fn emit_emergency_pause(env: &Env, expiry: u64) {
    env.events().publish(
        (symbol_short!("nova_rwd"), symbol_short!("emrg_paus")),
        (EVENT_SCHEMA_VERSION, expiry),
    );
}

/// Emitted when a dedicated recovery admin is assigned.
pub fn emit_recovery_admin_set(env: &Env, recovery_admin: &Address) {
    env.events().publish(
        (symbol_short!("nova_rwd"), symbol_short!("rec_op")),
        (EVENT_SCHEMA_VERSION, recovery_admin.clone()),
    );
}

/// Emitted when an account snapshot is captured.
pub fn emit_snapshot(env: &Env, user: &Address, balance: i128, timestamp: u64) {
    env.events().publish(
        (symbol_short!("nova_rwd"), symbol_short!("snap")),
        (EVENT_SCHEMA_VERSION, user.clone(), balance, timestamp),
    );
}

/// Emitted when an account snapshot is restored.
pub fn emit_restore(env: &Env, user: &Address, balance: i128, timestamp: u64) {
    env.events().publish(
        (symbol_short!("nova_rwd"), symbol_short!("restore")),
        (EVENT_SCHEMA_VERSION, user.clone(), balance, timestamp),
    );
}

/// Emitted when a recovery transaction (balance delta) is applied.
pub fn emit_recovery_tx(env: &Env, user: &Address, delta: i128, new_balance: i128) {
    env.events().publish(
        (symbol_short!("nova_rwd"), symbol_short!("rec_tx")),
        (EVENT_SCHEMA_VERSION, user.clone(), delta, new_balance),
    );
}

/// Emitted when funds are moved between accounts during recovery.
pub fn emit_recovery_funds(env: &Env, from: &Address, to: &Address, amount: i128) {
    env.events().publish(
        (symbol_short!("nova_rwd"), symbol_short!("rec_funds")),
        (EVENT_SCHEMA_VERSION, from.clone(), to.clone(), amount),
    );
}

/// Emitted after a successful WASM upgrade and migration.
pub fn emit_upgraded(env: &Env, wasm_hash: BytesN<32>, migration_version: u32) {
    env.events().publish(
        (symbol_short!("nova_rwd"), symbol_short!("upgraded")),
        (EVENT_SCHEMA_VERSION, wasm_hash, migration_version),
    );
}
