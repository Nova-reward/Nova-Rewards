#![no_main]
use libfuzzer_sys::fuzz_target;
use nova_rewards::calculate_payout;

fuzz_target!(|data: &[u8]| {
    if data.len() < 32 {
        return;
    }
    let balance = i128::from_le_bytes(data[..16].try_into().unwrap());
    let rate = i128::from_le_bytes(data[16..32].try_into().unwrap());

    // Only test non-negative inputs; negative inputs are expected to panic
    if balance < 0 || rate < 0 {
        return;
    }
    // Guard against overflow: balance * rate must fit in i128
    if balance > 0 && rate > i128::MAX / balance {
        return;
    }

    let result = calculate_payout(balance, rate);

    assert!(result >= 0, "payout must be non-negative");
    if balance == 0 || rate == 0 {
        assert_eq!(result, 0, "payout must be zero when balance or rate is zero");
    }
    // Result must not exceed the unscaled product
    assert!(result <= balance.saturating_mul(rate));
});
