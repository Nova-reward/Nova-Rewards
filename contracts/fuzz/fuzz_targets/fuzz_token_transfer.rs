//! Fuzz target: nova_token transfer operations
//!
//! # Invariants verified
//! 1. **Supply conservation** — total supply (sum of all balances) never changes
//!    after a transfer; tokens are neither created nor destroyed.
//! 2. **Balance non-negative** — no address ever holds a negative balance.
//! 3. **Allowance consistency** — after `transfer_from`, the spender's allowance
//!    decreases by exactly the transferred amount.
//!
//! # Input layout (48 bytes)
//! ```text
//! [0..16]  mint_amount  : i128  — tokens minted to `from`
//! [16..32] transfer_amt : i128  — tokens to transfer from `from` to `to`
//! [32..48] allowance    : i128  — allowance granted to `spender`
//! ```
#![no_main]
use libfuzzer_sys::fuzz_target;
use nova_token::{NovaToken, NovaTokenClient};
use soroban_sdk::testutils::Address as _;
use soroban_sdk::{Address, Env};

fuzz_target!(|data: &[u8]| {
    if data.len() < 48 {
        return;
    }

    let mint_amount = i128::from_le_bytes(data[0..16].try_into().unwrap());
    let transfer_amt = i128::from_le_bytes(data[16..32].try_into().unwrap());
    let allowance = i128::from_le_bytes(data[32..48].try_into().unwrap());

    // Constrain to valid, non-overflowing ranges
    if mint_amount <= 0 || mint_amount > 1_000_000_000_000_i128 {
        return;
    }
    if transfer_amt <= 0 || transfer_amt > mint_amount {
        return;
    }
    if allowance < 0 || allowance > mint_amount {
        return;
    }

    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(NovaToken, ());
    let client = NovaTokenClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let from = Address::generate(&env);
    let to = Address::generate(&env);
    let spender = Address::generate(&env);

    client.initialize(&admin);

    // ── Invariant 1: supply conservation across direct transfer ──────────────
    client.mint(&from, &mint_amount);

    let from_before = client.balance(&from);
    let to_before = client.balance(&to);
    let supply_before = from_before + to_before;

    // Invariant: balances are non-negative before transfer
    assert!(from_before >= 0, "from balance must be non-negative before transfer");
    assert!(to_before >= 0, "to balance must be non-negative before transfer");

    client.transfer(&from, &to, &transfer_amt);

    let from_after = client.balance(&from);
    let to_after = client.balance(&to);
    let supply_after = from_after + to_after;

    // Invariant: supply is conserved
    assert_eq!(
        supply_before, supply_after,
        "supply conservation violated: before={supply_before} after={supply_after}"
    );

    // Invariant: balances are non-negative after transfer
    assert!(from_after >= 0, "from balance must be non-negative after transfer");
    assert!(to_after >= 0, "to balance must be non-negative after transfer");

    // Invariant: sender lost exactly transfer_amt
    assert_eq!(
        from_before - transfer_amt,
        from_after,
        "sender balance delta mismatch"
    );

    // Invariant: recipient gained exactly transfer_amt
    assert_eq!(
        to_before + transfer_amt,
        to_after,
        "recipient balance delta mismatch"
    );

    // ── Invariant 2: supply conservation across transfer_from ─────────────────
    // Re-mint so `from` has enough for a second transfer
    client.mint(&from, &mint_amount);

    if allowance > 0 && allowance <= client.balance(&from) {
        client.approve(&from, &spender, &allowance);

        let allowance_before = client.allowance(&from, &spender);
        let from_before2 = client.balance(&from);
        let to_before2 = client.balance(&to);

        // Use at most the full allowance
        let spend_amt = allowance;
        client.transfer_from(&spender, &from, &to, &spend_amt);

        let allowance_after = client.allowance(&from, &spender);
        let from_after2 = client.balance(&from);
        let to_after2 = client.balance(&to);

        // Invariant: supply conserved
        assert_eq!(
            from_before2 + to_before2,
            from_after2 + to_after2,
            "supply conservation violated in transfer_from"
        );

        // Invariant: allowance decreased by exactly spend_amt
        assert_eq!(
            allowance_before - spend_amt,
            allowance_after,
            "allowance not decremented correctly"
        );

        // Invariant: balances non-negative
        assert!(from_after2 >= 0, "from balance negative after transfer_from");
        assert!(to_after2 >= 0, "to balance negative after transfer_from");
    }
});
