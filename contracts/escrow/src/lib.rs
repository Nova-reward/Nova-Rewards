//! # Escrow Contract
//!
//! Holds funds on behalf of a depositor until release conditions are met.
//!
//! ## Lifecycle
//! 1. Admin calls [`initialize`](EscrowContract::initialize).
//! 2. Depositor calls [`create`](EscrowContract::create) to open an escrow.
//! 3. Depositor calls [`fund`](EscrowContract::fund) to add tokens.
//! 4. Release: both depositor **and** beneficiary sign [`release`](EscrowContract::release)
//!    (multi-sig), or admin calls [`release`](EscrowContract::release) after the timeout.
//! 5. Depositor calls [`refund`](EscrowContract::refund) if the timeout has passed
//!    and the escrow was never released.
#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, symbol_short, Address, Env};

// ── Constants ─────────────────────────────────────────────────────────────────
const TTL: u32 = 31_536_000;

// ── Types ─────────────────────────────────────────────────────────────────────
#[contracttype]
#[derive(Clone, PartialEq)]
pub enum EscrowStatus {
    Open,
    Released,
    Refunded,
}

#[contracttype]
#[derive(Clone)]
pub struct Escrow {
    pub depositor: Address,
    pub beneficiary: Address,
    /// Unix timestamp after which a refund or admin-release is allowed.
    pub timeout: u64,
    pub amount: i128,
    pub status: EscrowStatus,
}

#[contracttype]
pub enum DataKey {
    Admin,
    NextId,
    Escrow(u32),
}

// ── Contract ──────────────────────────────────────────────────────────────────
#[contract]
pub struct EscrowContract;

#[contractimpl]
impl EscrowContract {
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialised");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::NextId, &0_u32);
    }

    fn admin(env: &Env) -> Address {
        env.storage().instance().get(&DataKey::Admin).unwrap()
    }

    fn next_id(env: &Env) -> u32 {
        env.storage().instance().get(&DataKey::NextId).unwrap_or(0)
    }

    /// Creates a new escrow. Returns the escrow id.
    ///
    /// `timeout` is an absolute Unix timestamp (seconds).
    pub fn create(env: Env, depositor: Address, beneficiary: Address, timeout: u64) -> u32 {
        depositor.require_auth();
        assert!(
            timeout > env.ledger().timestamp(),
            "timeout must be in the future"
        );

        let id = Self::next_id(&env);
        let escrow = Escrow {
            depositor: depositor.clone(),
            beneficiary: beneficiary.clone(),
            timeout,
            amount: 0,
            status: EscrowStatus::Open,
        };
        let key = DataKey::Escrow(id);
        env.storage().persistent().set(&key, &escrow);
        env.storage().persistent().extend_ttl(&key, TTL, TTL);
        env.storage().instance().set(&DataKey::NextId, &(id + 1));

        env.events().publish(
            (symbol_short!("escrow"), symbol_short!("created")),
            (depositor, beneficiary, timeout, id),
        );
        id
    }

    /// Adds tokens to an open escrow. Only the depositor may fund.
    pub fn fund(env: Env, id: u32, amount: i128) {
        assert!(amount > 0, "amount must be positive");
        let key = DataKey::Escrow(id);
        let mut escrow: Escrow = env.storage().persistent().get(&key).expect("not found");
        assert!(escrow.status == EscrowStatus::Open, "escrow not open");
        escrow.depositor.require_auth();
        escrow.amount += amount;
        env.storage().persistent().set(&key, &escrow);
        env.storage().persistent().extend_ttl(&key, TTL, TTL);

        env.events().publish(
            (symbol_short!("escrow"), symbol_short!("funded")),
            (escrow.depositor, amount, id),
        );
    }

    /// Releases funds to the beneficiary.
    ///
    /// Requires both depositor and beneficiary authorization (multi-sig),
    /// OR admin authorization after the timeout has passed.
    pub fn release(env: Env, id: u32) {
        let key = DataKey::Escrow(id);
        let mut escrow: Escrow = env.storage().persistent().get(&key).expect("not found");
        assert!(escrow.status == EscrowStatus::Open, "escrow not open");
        assert!(escrow.amount > 0, "nothing to release");

        let now = env.ledger().timestamp();
        let admin = Self::admin(&env);
        if now >= escrow.timeout {
            // Admin may release unilaterally after timeout
            admin.require_auth();
        } else {
            // Multi-sig: both parties must authorize
            escrow.depositor.require_auth();
            escrow.beneficiary.require_auth();
        }

        escrow.status = EscrowStatus::Released;
        env.storage().persistent().set(&key, &escrow);
        env.storage().persistent().extend_ttl(&key, TTL, TTL);

        env.events().publish(
            (symbol_short!("escrow"), symbol_short!("released")),
            (escrow.beneficiary, escrow.amount, id),
        );
    }

    /// Refunds the depositor. Only callable after the timeout has passed.
    pub fn refund(env: Env, id: u32) {
        let key = DataKey::Escrow(id);
        let mut escrow: Escrow = env.storage().persistent().get(&key).expect("not found");
        assert!(escrow.status == EscrowStatus::Open, "escrow not open");
        assert!(
            env.ledger().timestamp() >= escrow.timeout,
            "timeout not reached"
        );
        escrow.depositor.require_auth();

        escrow.status = EscrowStatus::Refunded;
        env.storage().persistent().set(&key, &escrow);
        env.storage().persistent().extend_ttl(&key, TTL, TTL);

        env.events().publish(
            (symbol_short!("escrow"), symbol_short!("refunded")),
            (escrow.depositor, escrow.amount, id),
        );
    }

    /// Returns the escrow record.
    pub fn get(env: Env, id: u32) -> Escrow {
        let key = DataKey::Escrow(id);
        let escrow = env.storage().persistent().get(&key).expect("not found");
        env.storage().persistent().extend_ttl(&key, TTL, TTL);
        escrow
    }
}

// ── Tests ─────────────────────────────────────────────────────────────────────
#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{testutils::{Address as _, Ledger}, Env};

    fn setup() -> (Env, Address, Address, Address, EscrowContractClient<'static>) {
        let env = Env::default();
        env.mock_all_auths();
        let cid = env.register(EscrowContract, ());
        let client = EscrowContractClient::new(&env, &cid);
        let admin = Address::generate(&env);
        let depositor = Address::generate(&env);
        let beneficiary = Address::generate(&env);
        client.initialize(&admin);
        (env, admin, depositor, beneficiary, client)
    }

    #[test]
    fn test_create_fund_release() {
        let (env, _admin, depositor, beneficiary, client) = setup();
        env.ledger().set_timestamp(100);
        let id = client.create(&depositor, &beneficiary, &1000);
        client.fund(&id, &500);
        let escrow = client.get(&id);
        assert_eq!(escrow.amount, 500);
        client.release(&id);
        let escrow = client.get(&id);
        assert!(matches!(escrow.status, EscrowStatus::Released));
    }

    #[test]
    fn test_refund_after_timeout() {
        let (env, _admin, depositor, beneficiary, client) = setup();
        env.ledger().set_timestamp(100);
        let id = client.create(&depositor, &beneficiary, &200);
        client.fund(&id, &300);
        env.ledger().set_timestamp(200);
        client.refund(&id);
        let escrow = client.get(&id);
        assert!(matches!(escrow.status, EscrowStatus::Refunded));
    }

    #[test]
    #[should_panic(expected = "timeout not reached")]
    fn test_refund_before_timeout_blocked() {
        let (env, _admin, depositor, beneficiary, client) = setup();
        env.ledger().set_timestamp(100);
        let id = client.create(&depositor, &beneficiary, &500);
        client.fund(&id, &100);
        client.refund(&id);
    }

    #[test]
    #[should_panic(expected = "escrow not open")]
    fn test_double_release_blocked() {
        let (env, _admin, depositor, beneficiary, client) = setup();
        env.ledger().set_timestamp(100);
        let id = client.create(&depositor, &beneficiary, &1000);
        client.fund(&id, &100);
        client.release(&id);
        client.release(&id);
    }
}
