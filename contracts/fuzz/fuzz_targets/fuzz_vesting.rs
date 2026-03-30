#![no_main]
use libfuzzer_sys::fuzz_target;
use soroban_sdk::testutils::{Address as _, Ledger};
use soroban_sdk::{Address, Env};
use vesting::{VestingContract, VestingContractClient};

fuzz_target!(|data: &[u8]| {
    if data.len() < 41 {
        return;
    }
    let total_amount = i128::from_le_bytes(data[..16].try_into().unwrap());
    let cliff = u64::from_le_bytes(data[16..24].try_into().unwrap());
    let duration = u64::from_le_bytes(data[24..32].try_into().unwrap());
    let time_advance = u64::from_le_bytes(data[32..40].try_into().unwrap());
    let releases = (data[40] % 5) + 1;

    // Valid ranges only
    if total_amount <= 0 || total_amount > 1_000_000_000_000_i128 {
        return;
    }
    if duration == 0 || cliff > duration {
        return;
    }

    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register_contract(None, VestingContract);
    let client = VestingContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let beneficiary = Address::generate(&env);

    client.initialize(&admin);
    client.fund_pool(&total_amount);

    let start = env.ledger().timestamp();
    let schedule_id = client.create_schedule(&beneficiary, &total_amount, &start, &cliff, &duration);

    let mut total_released: i128 = 0;
    for _ in 0..releases {
        env.ledger().with_mut(|l| {
            l.timestamp = l.timestamp.saturating_add(time_advance);
        });
        // release may panic with "nothing to release" — that's valid contract behaviour
        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            client.release(&beneficiary, &schedule_id)
        }));
        if let Ok(released) = result {
            assert!(released >= 0);
            total_released += released;
        }
    }

    // Core invariant: can never release more than the total vested amount
    assert!(total_released <= total_amount);
});
