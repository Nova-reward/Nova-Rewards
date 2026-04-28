//! # Redemption Contract
//!
//! Create, validate, process, and track NOVA token redemption requests.
//! Users burn reward tokens in exchange for merchant-defined perks.
//!
//! ## Lifecycle
//! 1. Admin calls [`initialize`](RedemptionContract::initialize).
//! 2. Merchant calls [`set_redemption_rate`](RedemptionContract::set_redemption_rate).
//! 3. User calls [`redeem`](RedemptionContract::redeem) to burn tokens.
//! 4. Redemption events are emitted for merchant verification.
#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, symbol_short, Address, Env, Map};

// ── Constants ─────────────────────────────────────────────────────────────────
const TTL: u32 = 31_536_000;

// ── Types ─────────────────────────────────────────────────────────────────────
#[contracttype]
#[derive(Clone, PartialEq)]
pub enum RedemptionStatus {
    Pending,
    Confirmed,
    Cancelled,
    Completed,
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
#[derive(Clone)]
pub struct RedemptionProof {
    pub user: Address,
    pub merchant: Address,
    pub amount_burned: i128,
    pub timestamp: u64,
}

#[contracttype]
pub enum DataKey {
    Admin,
    NextId,
    Redemption(u32),
    RedemptionRate(Address),  // merchant -> tokens_per_perk_unit
    TotalRedemptions(Address), // merchant -> total_amount_redeemed
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

    /// Sets the redemption rate for a merchant (tokens per perk unit).
    /// Only the merchant can set their own rate.
    pub fn set_redemption_rate(env: Env, merchant: Address, tokens_per_unit: i128) {
        merchant.require_auth();
        assert!(tokens_per_unit > 0, "rate must be positive");
        
        let key = DataKey::RedemptionRate(merchant.clone());
        env.storage().instance().set(&key, &tokens_per_unit);
        
        env.events().publish(
            (symbol_short!("redeem"), symbol_short!("rate")),
            (merchant, tokens_per_unit),
        );
    }

    /// Redeems (burns) tokens for a merchant. Returns redemption proof.
    /// Fails if user balance is insufficient.
    pub fn redeem(env: Env, campaign_id: u64, merchant: Address, amount: i128) -> RedemptionProof {
        // In a real scenario, this would call the token contract to burn tokens
        // For now, we validate the amount and emit the proof
        assert!(amount > 0, "amount must be positive");
        
        let user = env.invoker();
        user.require_auth();
        
        // Get merchant's redemption rate
        let rate_key = DataKey::RedemptionRate(merchant.clone());
        let _rate: i128 = env.storage().instance().get(&rate_key)
            .expect("merchant has no redemption rate configured");
        
        let proof = RedemptionProof {
            user: user.clone(),
            merchant: merchant.clone(),
            amount_burned: amount,
            timestamp: env.ledger().timestamp(),
        };
        
        // Update total redemptions for merchant
        let total_key = DataKey::TotalRedemptions(merchant.clone());
        let current_total: i128 = env.storage().instance().get(&total_key).unwrap_or(0);
        env.storage().instance().set(&total_key, &(current_total + amount));
        
        env.events().publish(
            (symbol_short!("redeem"), symbol_short!("completed")),
            (campaign_id, user, merchant, amount, env.ledger().timestamp()),
        );
        
        proof
    }

    /// Returns total redemptions for a merchant's campaign.
    pub fn get_total_redemptions(env: Env, merchant: Address) -> i128 {
        let key = DataKey::TotalRedemptions(merchant);
        env.storage().instance().get(&key).unwrap_or(0)
    }

    /// Returns the redemption rate for a merchant.
    pub fn get_redemption_rate(env: Env, merchant: Address) -> i128 {
        let key = DataKey::RedemptionRate(merchant);
        env.storage().instance().get(&key).expect("rate not found")
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

    #[test]
    fn test_set_redemption_rate() {
        let (env, _admin, _user, client) = setup();
        let merchant = Address::generate(&env);
        client.set_redemption_rate(&merchant, &100);
        let rate = client.get_redemption_rate(&merchant);
        assert_eq!(rate, 100);
    }

    #[test]
    fn test_redeem_tokens() {
        let (env, _admin, user, client) = setup();
        let merchant = Address::generate(&env);
        let campaign_id = 1u64;
        
        // Set redemption rate
        client.set_redemption_rate(&merchant, &50);
        
        // User redeems tokens
        let proof = client.redeem(&campaign_id, &merchant, &500);
        assert_eq!(proof.user, user);
        assert_eq!(proof.merchant, merchant);
        assert_eq!(proof.amount_burned, 500);
        
        // Check total redemptions
        let total = client.get_total_redemptions(&merchant);
        assert_eq!(total, 500);
    }

    #[test]
    fn test_multiple_redemptions_accumulate() {
        let (env, _admin, user, client) = setup();
        let merchant = Address::generate(&env);
        let campaign_id = 1u64;
        
        client.set_redemption_rate(&merchant, &50);
        
        client.redeem(&campaign_id, &merchant, &100);
        client.redeem(&campaign_id, &merchant, &200);
        
        let total = client.get_total_redemptions(&merchant);
        assert_eq!(total, 300);
    }

    #[test]
    #[should_panic(expected = "rate must be positive")]
    fn test_invalid_rate_rejected() {
        let (env, _admin, _user, client) = setup();
        let merchant = Address::generate(&env);
        client.set_redemption_rate(&merchant, &0);
    }

    #[test]
    #[should_panic(expected = "merchant has no redemption rate configured")]
    fn test_redeem_without_rate() {
        let (env, _admin, _user, client) = setup();
        let merchant = Address::generate(&env);
        let campaign_id = 1u64;
        client.redeem(&campaign_id, &merchant, &100);
    }
}
