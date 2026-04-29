//! # Event System
//!
//! Centralised event definitions and emitters for the Nova Rewards contract.
//!
//! Every state-changing operation emits a typed event via this module so that
//! off-chain indexers, monitoring tools, and the backend event service have a
//! single, consistent source of truth for all contract events.
//!
//! ## Event taxonomy
//!
//! | Topic 0        | Topic 1        | Data fields                                  | Trigger                        |
//! |----------------|----------------|----------------------------------------------|--------------------------------|
//! | `nova_rewards` | `initialized`  | `(admin: Address)`                           | Contract first init            |
//! | `nova_rewards` | `bal_set`      | `(user: Address, amount: i128)`              | Admin sets balance             |
//! | `nova_rewards` | `staked`       | `(staker: Address, amount: i128, ts: u64)`   | User stakes tokens             |
//! | `nova_rewards` | `unstaked`     | `(staker: Address, principal: i128, yield_: i128, ts: u64)` | User unstakes  |
//! | `nova_rewards` | `rate_set`     | `(rate: i128)`                               | Admin updates annual rate      |
//! | `nova_rewards` | `swap`         | `(user: Address, nova: i128, xlm: i128)`     | User swaps Nova → XLM          |
//! | `nova_rewards` | `paused`       | `(procedure: Symbol, ts: u64)`               | Admin pauses contract          |
//! | `nova_rewards` | `resumed`      | `(ts: u64)`                                  | Admin resumes contract         |
//! | `nova_rewards` | `emrg_pause`   | `(expiry: u64)`                              | Admin emergency-pauses         |
//! | `nova_rewards` | `rec_op`       | `(admin: Address, op_id: BytesN<32>)`        | Recovery admin set             |
//! | `nova_rewards` | `snap`         | `(user: Address, balance: i128, ts: u64)`    | Account snapshot taken         |
//! | `nova_rewards` | `restore`      | `(user: Address, balance: i128, ts: u64)`    | Account snapshot restored      |
//! | `nova_rewards` | `rec_tx`       | `(user: Address, delta: i128, new_bal: i128)`| Recovery transaction applied   |
//! | `nova_rewards` | `rec_funds`    | `(from: Address, to: Address, amount: i128)` | Recovery fund transfer         |
//! | `nova_rewards` | `upgraded`     | `(wasm_hash: BytesN<32>, version: u32)`      | Contract WASM upgraded         |

use soroban_sdk::{symbol_short, Address, BytesN, Env, Symbol, Vec};

// ── Topic constants ───────────────────────────────────────────────────────────

const CONTRACT: &str = "nova_rwd";

// ── Emitters ──────────────────────────────────────────────────────────────────

/// Emitted once when the contract is first initialised.
pub fn emit_initialized(env: &Env, admin: &Address) {
    env.events().publish(
        (symbol_short!(CONTRACT), symbol_short!("init")),
        admin.clone(),
    );
}

/// Emitted when an admin directly sets a user's balance.
pub fn emit_balance_set(env: &Env, user: &Address, amount: i128) {
    env.events().publish(
        (symbol_short!(CONTRACT), symbol_short!("bal_set")),
        (user.clone(), amount),
    );
}

/// Emitted when a user stakes tokens.
pub fn emit_staked(env: &Env, staker: &Address, amount: i128, timestamp: u64) {
    env.events().publish(
        (symbol_short!(CONTRACT), symbol_short!("staked")),
        (staker.clone(), amount, timestamp),
    );
}

/// Emitted when a user unstakes tokens and collects yield.
pub fn emit_unstaked(env: &Env, staker: &Address, principal: i128, yield_amount: i128, timestamp: u64) {
    env.events().publish(
        (symbol_short!(CONTRACT), symbol_short!("unstaked")),
        (staker.clone(), principal, yield_amount, timestamp),
    );
}

/// Emitted when the admin updates the annual staking rate.
pub fn emit_rate_set(env: &Env, rate: i128) {
    env.events().publish(
        (symbol_short!(CONTRACT), symbol_short!("rate_set")),
        rate,
    );
}

/// Emitted when a user swaps Nova points for XLM.
pub fn emit_swap(env: &Env, user: &Address, nova_amount: i128, xlm_received: i128, path: Vec<Address>) {
    env.events().publish(
        (symbol_short!(CONTRACT), symbol_short!("swap")),
        (user.clone(), nova_amount, xlm_received, path),
    );
}

/// Emitted when the contract is paused by the admin.
pub fn emit_paused(env: &Env, procedure: Symbol, timestamp: u64) {
    env.events().publish(
        (symbol_short!(CONTRACT), symbol_short!("paused")),
        (procedure, timestamp),
    );
}

/// Emitted when the contract is resumed after a pause.
pub fn emit_resumed(env: &Env, timestamp: u64) {
    env.events().publish(
        (symbol_short!(CONTRACT), symbol_short!("resumed")),
        timestamp,
    );
}

/// Emitted when an emergency pause with auto-expiry is set.
pub fn emit_emergency_pause(env: &Env, expiry: u64) {
    env.events().publish(
        (symbol_short!(CONTRACT), symbol_short!("emrg_paus")),
        expiry,
    );
}

/// Emitted when a dedicated recovery admin is assigned.
pub fn emit_recovery_admin_set(env: &Env, recovery_admin: &Address) {
    env.events().publish(
        (symbol_short!(CONTRACT), symbol_short!("rec_op")),
        recovery_admin.clone(),
    );
}

/// Emitted when an account snapshot is captured.
pub fn emit_snapshot(env: &Env, user: &Address, balance: i128, timestamp: u64) {
    env.events().publish(
        (symbol_short!(CONTRACT), symbol_short!("snap")),
        (user.clone(), balance, timestamp),
    );
}

/// Emitted when an account snapshot is restored.
pub fn emit_restore(env: &Env, user: &Address, balance: i128, timestamp: u64) {
    env.events().publish(
        (symbol_short!(CONTRACT), symbol_short!("restore")),
        (user.clone(), balance, timestamp),
    );
}

/// Emitted when a recovery transaction (balance delta) is applied.
pub fn emit_recovery_tx(env: &Env, user: &Address, delta: i128, new_balance: i128) {
    env.events().publish(
        (symbol_short!(CONTRACT), symbol_short!("rec_tx")),
        (user.clone(), delta, new_balance),
    );
}

/// Emitted when funds are moved between accounts during recovery.
pub fn emit_recovery_funds(env: &Env, from: &Address, to: &Address, amount: i128) {
    env.events().publish(
        (symbol_short!(CONTRACT), symbol_short!("rec_funds")),
        (from.clone(), to.clone(), amount),
    );
}

/// Emitted after a successful WASM upgrade and migration.
pub fn emit_upgraded(env: &Env, wasm_hash: BytesN<32>, migration_version: u32) {
    env.events().publish(
        (symbol_short!(CONTRACT), symbol_short!("upgraded")),
        (wasm_hash, migration_version),
    );
}
