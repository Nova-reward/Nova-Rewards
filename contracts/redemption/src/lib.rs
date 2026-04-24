//! # Redemption Contract
//!
//! Create, validate, process, and track NOVA token redemption requests.
//!
//! ## Lifecycle
//! 1. Admin calls [`initialize`](RedemptionContract::initialize).
//! 2. User calls [`request`](RedemptionContract::request) to open a redemption.
//! 3. Admin calls [`confirm`](RedemptionContract::confirm) to finalise it.
//! 4. Either party may call [`cancel`](RedemptionContract::cancel) before confirmation.
#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, symbol_short, Address, Env};

// ── Constants ─────────────────────────────────────────────────────────────────
const TTL: u32 = 31_536_000;

// ── Types ─────────────────────────────────────────────────────────────────────
#[contracttype]
#[derive(Clone, PartialEq)]
pub enum RedemptionStatus {
    Pending,
    Confirmed,
    Cancelled,
}

#[contracttype]
#[derive(Clone)]
pub struct RedemptionRequest {
    pub user: Address,
    pub amount: i128,
    pub status: RedemptionStatus,
    pub created_at: u64,
}

#[contracttype]
pub enum DataKey {
    Admin,
    NextId,
    Redemption(u32),
}

// ── Contract ──────────────────────────────────────────────────────────────────
#[contract]
pub struct RedemptionContract;

#[contractimpl]
impl RedemptionContract {
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

    /// Opens a new redemption request. Returns the request id.
    pub fn request(env: Env, user: Address, amount: i128) -> u32 {
        user.require_auth();
        assert!(amount > 0, "amount must be positive");

        let id: u32 = env
            .storage()
            .instance()
            .get(&DataKey::NextId)
            .unwrap_or(0);

        let req = RedemptionRequest {
            user: user.clone(),
            amount,
            status: RedemptionStatus::Pending,
            created_at: env.ledger().timestamp(),
        };
        let key = DataKey::Redemption(id);
        env.storage().persistent().set(&key, &req);
        env.storage().persistent().extend_ttl(&key, TTL, TTL);
        env.storage().instance().set(&DataKey::NextId, &(id + 1));

        env.events().publish(
            (symbol_short!("redeem"), symbol_short!("request")),
            (user, amount, id),
        );
        id
    }

    /// Confirms a pending redemption. Admin only.
    pub fn confirm(env: Env, id: u32) {
        Self::admin(&env).require_auth();
        let key = DataKey::Redemption(id);
        let mut req: RedemptionRequest = env
            .storage()
            .persistent()
            .get(&key)
            .expect("not found");
        assert!(
            req.status == RedemptionStatus::Pending,
            "not pending"
        );
        req.status = RedemptionStatus::Confirmed;
        env.storage().persistent().set(&key, &req);
        env.storage().persistent().extend_ttl(&key, TTL, TTL);

        env.events().publish(
            (symbol_short!("redeem"), symbol_short!("confirm")),
            (req.user, req.amount, id),
        );
    }

    /// Cancels a pending redemption. Caller must be admin or the requesting user.
    ///
    /// Pass `as_admin = true` to cancel with admin authorization,
    /// `as_admin = false` to cancel as the requesting user.
    pub fn cancel(env: Env, id: u32, as_admin: bool) {
        let key = DataKey::Redemption(id);
        let mut req: RedemptionRequest = env
            .storage()
            .persistent()
            .get(&key)
            .expect("not found");
        assert!(req.status == RedemptionStatus::Pending, "not pending");

        if as_admin {
            Self::admin(&env).require_auth();
        } else {
            req.user.require_auth();
        }

        req.status = RedemptionStatus::Cancelled;
        env.storage().persistent().set(&key, &req);
        env.storage().persistent().extend_ttl(&key, TTL, TTL);

        env.events().publish(
            (symbol_short!("redeem"), symbol_short!("cancel")),
            (req.user, req.amount, id),
        );
    }

    /// Returns a redemption request by id.
    pub fn get(env: Env, id: u32) -> RedemptionRequest {
        let key = DataKey::Redemption(id);
        let req = env
            .storage()
            .persistent()
            .get(&key)
            .expect("not found");
        env.storage().persistent().extend_ttl(&key, TTL, TTL);
        req
    }
}

// ── Tests ─────────────────────────────────────────────────────────────────────
#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Env};

    fn setup() -> (Env, Address, Address, RedemptionContractClient<'static>) {
        let env = Env::default();
        env.mock_all_auths();
        let id = env.register(RedemptionContract, ());
        let client = RedemptionContractClient::new(&env, &id);
        let admin = Address::generate(&env);
        let user = Address::generate(&env);
        client.initialize(&admin);
        (env, admin, user, client)
    }

    #[test]
    fn test_request_and_confirm() {
        let (_env, _admin, user, client) = setup();
        let rid = client.request(&user, &1000);
        assert_eq!(rid, 0);
        client.confirm(&rid);
        let req = client.get(&rid);
        assert!(matches!(req.status, RedemptionStatus::Confirmed));
    }

    #[test]
    fn test_request_and_cancel() {
        let (_env, _admin, user, client) = setup();
        let rid = client.request(&user, &500);
        client.cancel(&rid, &false);
        let req = client.get(&rid);
        assert!(matches!(req.status, RedemptionStatus::Cancelled));
    }

    #[test]
    #[should_panic(expected = "not pending")]
    fn test_double_confirm_blocked() {
        let (_env, _admin, user, client) = setup();
        let rid = client.request(&user, &100);
        client.confirm(&rid);
        client.confirm(&rid);
    }

    #[test]
    #[should_panic(expected = "amount must be positive")]
    fn test_zero_amount_rejected() {
        let (_env, _admin, user, client) = setup();
        client.request(&user, &0);
    }
}
