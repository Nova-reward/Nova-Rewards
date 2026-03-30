#![no_std]
use soroban_sdk::{Bytes, contract, contractimpl, contracttype, symbol_short, Address, Env};

// ── Storage keys ─────────────────────────────────────────────────────────────
#[contracttype]
pub enum DataKey {
    Admin,
    Name,
    Symbol,
    Decimals,
    TotalSupply,
    Balance(Address),
    Allowance(Address, Address),
}

// ── Contract ──────────────────────────────────────────────────────────────────
#[contract]
pub struct NovaToken;

#[contractimpl]
impl NovaToken {
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }
        let name = Bytes::from_slice(&env, b"NovaToken");
        let symbol = Bytes::from_slice(&env, b"NOVA");
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Name, &name);
        env.storage().instance().set(&DataKey::Symbol, &symbol);
        env.storage().instance().set(&DataKey::Decimals, &7u32);
        env.storage().instance().set(&DataKey::TotalSupply, &0i128);
    }

    // ── Internal helpers ──────────────────────────────────────────────────────

fn admin(env: &Env) -> Address {
        env.storage().instance().get(&DataKey::Admin).unwrap()
    }

    fn total_supply_raw(env: &Env) -> i128 {
        env.storage().instance().get(&DataKey::TotalSupply).unwrap_or(0)
    }

fn allowance_raw(env: &Env, owner: Address, spender: Address) -> i128 {
        let key = DataKey::Allowance(owner, spender);
        let allowance = env.storage().persistent().get(&key).unwrap_or(0);
        if env.storage().persistent().has(&key) {
            env.storage().persistent().extend_ttl(&key, 2_678_400, 2_678_400);
        }
        allowance
    }

fn balance_of(env: &Env, addr: &Address) -> i128 {
        let key = DataKey::Balance(addr.clone());
        let balance = env.storage().persistent().get(&key).unwrap_or(0);
        if env.storage().persistent().has(&key) {
            env.storage().persistent().extend_ttl(&key, 2_678_400, 2_678_400);
        }
        balance
    }

    fn set_balance(env: &Env, addr: &Address, amount: i128) {
        assert!(amount >= 0, "balance cannot be negative");
        let key = DataKey::Balance(addr.clone());
        env.storage().persistent().set(&key, &amount);
        // Extend TTL by 31 days
        env.storage().persistent().extend_ttl(&key, 2_678_400, 2_678_400);
    }

    // ── Mint ──────────────────────────────────────────────────────────────────

    /// Mint `amount` tokens to `to`. Admin-gated.
    pub fn mint(env: Env, to: Address, amount: i128) {
        let admin_addr = Self::admin(&env);
        admin_addr.require_auth();
        assert!(amount > 0, "amount must be positive");
        let new_bal = Self::balance_of(&env, &to) + amount;
        Self::set_balance(&env, &to, new_bal);
        let mut total_supply = Self::total_supply_raw(&env);
        total_supply += amount;
        assert!(total_supply >= 0, "total supply cannot be negative");
        env.storage().instance().set(&DataKey::TotalSupply, &total_supply);

        env.events().publish(
            (symbol_short!("nova_tok"), symbol_short!("mint")),
            (to, amount),
        );
    }

    /// Burn `amount` tokens from `from`. Caller must be `from`.
    pub fn burn(env: Env, from: Address, amount: i128) {
        from.require_auth();
        assert!(amount > 0, "amount must be positive");
        let bal = Self::balance_of(&env, &from);
        assert!(bal >= amount, "insufficient balance");
        Self::set_balance(&env, &from, bal - amount);
        let mut total_supply = Self::total_supply_raw(&env);
        total_supply -= amount;
        assert!(total_supply >= 0, "total supply cannot be negative");
        env.storage().instance().set(&DataKey::TotalSupply, &total_supply);

        env.events().publish(
            (symbol_short!("nova_tok"), symbol_short!("burn")),
            (from, amount),
        );
    }

    /// Transfer `amount` tokens from `from` to `to`.
    pub fn transfer(env: Env, from: Address, to: Address, amount: i128) {
        from.require_auth();
        assert!(amount > 0, "amount must be positive");
        let from_bal = Self::balance_of(&env, &from);
        assert!(from_bal >= amount, "insufficient balance");
        Self::set_balance(&env, &from, from_bal - amount);
        let to_bal = Self::balance_of(&env, &to);
        Self::set_balance(&env, &to, to_bal + amount);

        env.events().publish(
            (symbol_short!("nova_tok"), symbol_short!("transfer")),
            (from, to, amount),
        );
    }

    /// Approve `spender` to spend up to `amount` on behalf of `owner`.
    pub fn approve(env: Env, owner: Address, spender: Address, amount: i128) {
        owner.require_auth();
        assert!(amount >= 0, "amount cannot be negative");
        let key = DataKey::Allowance(owner.clone(), spender.clone());
        env.storage().persistent().set(&key, &amount);
        // Extend TTL by 31 days
        env.storage().persistent().extend_ttl(&key, 2_678_400, 2_678_400);

        env.events().publish(
            (symbol_short!("nova_tok"), symbol_short!("approve")),
            (owner, spender, amount),
        );
    }

    pub fn balance(env: Env, addr: Address) -> i128 {
        Self::balance_of(&env, &addr)
    }

pub fn allowance(env: Env, owner: Address, spender: Address) -> i128 {
        let key = DataKey::Allowance(owner, spender);
        let allowance = env.storage().persistent().get(&key).unwrap_or(0);
        if env.storage().persistent().has(&key) {
            env.storage().persistent().extend_ttl(&key, 2_678_400, 2_678_400);
        }
        allowance
    }

    /// Transfer `amount` tokens from `from` to `to` using `spender`'s allowance.
    pub fn transfer_from(env: Env, from: Address, spender: Address, to: Address, amount: i128) {
        spender.require_auth();
        assert!(amount > 0, "amount must be positive");
        let allowance = Self::allowance_raw(&env, from.clone(), spender.clone());
        assert!(allowance >= amount, "insufficient allowance");
        let from_bal = Self::balance_of(&env, &from);
        assert!(from_bal >= amount, "insufficient balance");
        let new_from_bal = from_bal - amount;
        Self::set_balance(&env, &from, new_from_bal);
        let to_bal = Self::balance_of(&env, &to);
        let new_to_bal = to_bal + amount;
        Self::set_balance(&env, &to, new_to_bal);
        let new_allowance = allowance - amount;
        let key = DataKey::Allowance(from.clone(), spender);
        env.storage().persistent().set(&key, &new_allowance);
        env.storage().persistent().extend_ttl(&key, 2_678_400, 2_678_400);

        env.events().publish(
            (symbol_short!("nova_tok"), symbol_short!("transfer")),
            (from, to, amount),
        );
    }

    pub fn name(env: Env) -> Bytes {
        env.storage().instance().get(&DataKey::Name).unwrap_or_else(|| Bytes::from_slice(&env, b""))
    }

    pub fn symbol(env: Env) -> Bytes {
        env.storage().instance().get(&DataKey::Symbol).unwrap_or_else(|| Bytes::from_slice(&env, b""))
    }

    pub fn decimals(env: Env) -> u32 {
        env.storage().instance().get(&DataKey::Decimals).unwrap_or(0)
    }

    pub fn total_supply(env: Env) -> i128 {
        Self::total_supply_raw(&env)
    }
}

// ── Tests ─────────────────────────────────────────────────────────────────────
#[cfg(test)]
mod tests {
    use super::*;
use soroban_sdk::{testutils::{Address as _, Events, AuthorizedFunction, AuthorizedInvocation}, Bytes, Env};

fn setup() -> (Env, Address, NovaTokenClient<'static>) {
        let env = Env::default();
        env.mock_all_auths();
        let id = env.register(NovaToken, ());
        let client = NovaTokenClient::new(&env, &id);
        let admin = Address::generate(&env);
        client.initialize(&admin);
        (env, admin, client)
    }

    fn setup_admin_auth(env: &Env, client: &NovaTokenClient, admin: Address) {
        admin.as_contract(&env, || {});
    }

    #[test]
    fn test_initialize_sets_metadata() {
        let env = Env::default();
        let id = env.register(NovaToken, ());
        let client = NovaTokenClient::new(&env, &id);
        let admin = Address::generate(&env);
        client.initialize(&admin);
        assert_eq!(client.name(), Bytes::from_slice(&env, b"NovaToken"));
        assert_eq!(client.symbol(), Bytes::from_slice(&env, b"NOVA"));
        assert_eq!(client.decimals(), 7u32);
        assert_eq!(client.total_supply(), 0i128);
    }

    #[test]
    #[should_panic(expected = "already initialized")]
    fn test_initialize_twice_panics() {
        let (env, admin, client) = setup();
        client.initialize(&admin);
    }

    #[test]
    fn test_mint_emits_event() {
        let (env, admin, client) = setup();
        let user = Address::generate(&env);
        admin.as_contract(&env, || {
            client.mint(&user, &500);
        });
        assert_eq!(client.balance(&user), 500);
        assert_eq!(client.total_supply(), 500);
        let _ = env.events().all();
    }

    #[test]
    fn test_burn_emits_event() {
        let (env, admin, client) = setup();
        let user = Address::generate(&env);
        admin.as_contract(&env, || {
            client.mint(&user, &200);
        });
        user.as_contract(&env, || {
            client.burn(&user, &50);
        });
        assert_eq!(client.balance(&user), 150);
        assert_eq!(client.total_supply(), 150);
        let _ = env.events().all();
    }

    #[test]
    fn test_transfer_emits_event() {
        let (env, admin, client) = setup();
        let alice = Address::generate(&env);
        let bob = Address::generate(&env);
        admin.as_contract(&env, || {
            client.mint(&alice, &300);
        });
        alice.as_contract(&env, || {
            client.transfer(&alice, &bob, &100);
        });
        assert_eq!(client.balance(&alice), 200);
        assert_eq!(client.balance(&bob), 100);
        assert_eq!(client.total_supply(), 300);
        let _ = env.events().all();
    }

    #[test]
    fn test_approve_emits_event() {
        let (env, _admin, client) = setup();
        let owner = Address::generate(&env);
        let spender = Address::generate(&env);
        owner.as_contract(&env, || {
            client.approve(&owner, &spender, &1000);
        });
        assert_eq!(client.allowance(&owner, &spender), 1000);
        let _ = env.events().all();
    }

    #[test]
    fn test_transfer_from_success() {
        let (env, admin, client) = setup();
        let owner = Address::generate(&env);
        let spender = Address::generate(&env);
        let to = Address::generate(&env);
        admin.as_contract(&env, || {
            client.mint(&owner, &500);
        });
        owner.as_contract(&env, || {
            client.approve(&owner, &spender, &300);
        });
        spender.as_contract(&env, || {
            client.transfer_from(&owner, &spender, &to, &200);
        });
        assert_eq!(client.balance(&owner), 300);
        assert_eq!(client.balance(&to), 200);
        assert_eq!(client.allowance(&owner, &spender), 100);
        let _ = env.events().all();
    }

    #[test]
    #[should_panic(expected = "insufficient allowance")]
    fn test_transfer_from_overallowance_panics() {
        let (env, admin, client) = setup();
        let owner = Address::generate(&env);
        let spender = Address::generate(&env);
        let to = Address::generate(&env);
        admin.as_contract(&env, || {
            client.mint(&owner, &100);
        });
        owner.as_contract(&env, || {
            client.approve(&owner, &spender, &50);
        });
        spender.as_contract(&env, || {
            client.transfer_from(&owner, &spender, &to, &100);
        });
    }

    #[test]
    #[should_panic(expected = "insufficient balance")]
    fn test_transfer_from_insufficient_from_panics() {
        let (env, _admin, client) = setup();
        let owner = Address::generate(&env);
        let spender = Address::generate(&env);
        let to = Address::generate(&env);
        owner.as_contract(&env, || {
            client.approve(&owner, &spender, &100);
        });
        spender.as_contract(&env, || {
            client.transfer_from(&owner, &spender, &to, &50);
        });
    }

    #[test]
    #[should_panic(expected = "amount must be positive")]
    fn test_mint_negative_amount_panics() {
        let (env, admin, client) = setup();
        let user = Address::generate(&env);
        admin.as_contract(&env, || {
            client.mint(&user, &-1);
        });
    }

    #[test]
    #[should_panic(expected = "amount cannot be negative")]
    fn test_approve_negative_panics() {
        let (env, _admin, client) = setup();
        let owner = Address::generate(&env);
        let spender = Address::generate(&env);
        client.approve(&owner, &spender, &-1);
    }

    #[test]
    #[should_panic(expected = "insufficient balance")]
    fn test_burn_insufficient_balance() {
        let (env, admin, client) = setup();
        let user = Address::generate(&env);
        admin.as_contract(&env, || {
            client.mint(&user, &10);
        });
        user.as_contract(&env, || {
            client.burn(&user, &100);
        });
    }

    #[test]
    #[should_panic(expected = "insufficient balance")]
    fn test_transfer_insufficient_panics() {
        let (env, admin, client) = setup();
        let from = Address::generate(&env);
        let to = Address::generate(&env);
        admin.as_contract(&env, || {
            client.mint(&from, &10);
        });
        from.as_contract(&env, || {
            client.transfer(&from, &to, &20);
        });
    }
}
