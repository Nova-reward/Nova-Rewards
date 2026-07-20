#![no_main]
//! Fuzz harness for the vesting contract.
//!
//! Each run creates one schedule from fuzz-chosen parameters (including values
//! near the u64 timestamp boundary) and then drives an arbitrary interleaving
//! of `claim_vested` and `revoke` operations, checking after every step that:
//!
//! - `total_released` never exceeds `total_amount`;
//! - after revocation, `revoked_amount + returned == total_amount` and the
//!   beneficiary can claim exactly the pro-rata vested amount — no more;
//! - the pool balance always equals `funded − claimed + returned`.
//!
//! Rejections by the contract ("nothing to release", "already revoked",
//! overflow guards in `create_schedule`) are valid behaviour and are observed
//! via the `try_` client methods; only invariant violations count as crashes.

use libfuzzer_sys::fuzz_target;
use soroban_sdk::testutils::{Address as _, Ledger};
use soroban_sdk::{Address, Env};
use vesting::{VestingContract, VestingContractClient};

/// total_amount(16) + start_time(8) + cliff_duration(8) + total_duration(8) + initial_ts(8)
const HEADER_LEN: usize = 48;
/// op selector(1) + time_advance(8)
const OP_LEN: usize = 9;

fuzz_target!(|data: &[u8]| {
    if data.len() < HEADER_LEN + OP_LEN {
        return;
    }
    let total_amount = i128::from_le_bytes(data[..16].try_into().unwrap());
    let start_time = u64::from_le_bytes(data[16..24].try_into().unwrap());
    let cliff_duration = u64::from_le_bytes(data[24..32].try_into().unwrap());
    let total_duration = u64::from_le_bytes(data[32..40].try_into().unwrap());
    let initial_ts = u64::from_le_bytes(data[40..48].try_into().unwrap());

    // Cap so pool arithmetic (fund + revoke-return ≤ 2 × total) cannot overflow
    // i128 in the harness itself. All other parameters are left unconstrained —
    // create_schedule's own validation is part of the surface under test.
    if total_amount <= 0 || total_amount > i128::MAX / 2 {
        return;
    }

    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(VestingContract, ());
    let client = VestingContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let beneficiary = Address::generate(&env);

    client.initialize(&admin);
    client.fund_pool(&total_amount);

    env.ledger().set_timestamp(initial_ts);

    // create_schedule rejects zero durations/amounts and timestamp-overflow
    // combinations — those rejections are correct behaviour, not crashes.
    let schedule_id = match client.try_create_schedule(
        &beneficiary,
        &total_amount,
        &start_time,
        &cliff_duration,
        &total_duration,
    ) {
        Ok(Ok(id)) => id,
        _ => return,
    };

    let mut total_released: i128 = 0;
    let mut returned: i128 = 0;
    let mut revoked = false;

    for op in data[HEADER_LEN..].chunks_exact(OP_LEN) {
        let advance = u64::from_le_bytes(op[1..9].try_into().unwrap());
        env.ledger()
            .set_timestamp(env.ledger().timestamp().saturating_add(advance));

        if op[0] & 0x03 == 0 && !revoked {
            if let Ok(Ok(r)) = client.try_revoke(&beneficiary, &schedule_id) {
                assert!(r >= 0, "revoke returned a negative amount");
                returned = r;
                revoked = true;
            }
        } else {
            // "nothing to release" rejections surface here as Err — valid.
            if let Ok(Ok(r)) = client.try_claim_vested(&beneficiary, &schedule_id) {
                assert!(r > 0, "claim released a non-positive amount");
                total_released += r;
            }
        }

        // Core invariant after every single operation.
        assert!(
            total_released <= total_amount,
            "released {total_released} exceeds total {total_amount}"
        );
    }

    let schedule = client.get_schedule(&beneficiary, &schedule_id);
    assert_eq!(schedule.released, total_released);

    if revoked {
        // Conservation at revocation: vested-at-revocation + returned == total.
        assert_eq!(schedule.revoked_amount + returned, total_amount);
        assert!(total_released <= schedule.revoked_amount);

        // A claim after revocation must top the beneficiary up to exactly the
        // amount vested at revocation time — never more, no matter how much
        // time passes afterwards.
        env.ledger().set_timestamp(u64::MAX);
        if let Ok(Ok(r)) = client.try_claim_vested(&beneficiary, &schedule_id) {
            assert!(r > 0, "claim released a non-positive amount");
            total_released += r;
        }
        assert_eq!(total_released, schedule.revoked_amount);
    }

    // Pool conservation: funded − claimed + returned-on-revoke.
    assert_eq!(
        client.pool_balance(),
        total_amount - total_released + returned
    );
});
