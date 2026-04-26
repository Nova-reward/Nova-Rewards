#![cfg(test)]

//! Tests for all utility modules: math, time, validation, conversion, array, string.

use nova_rewards::utils::{array, conversion, math, string, time, validation};
use nova_rewards::SCALE_FACTOR;
use soroban_sdk::{Bytes, Env, Vec};

// ---------------------------------------------------------------------------
// math
// ---------------------------------------------------------------------------

#[test]
fn test_fp_mul_basic() {
    // 2.0 * 3.0 = 6.0  (in fixed-point: 2_000_000 * 3_000_000 / 1_000_000 = 6_000_000)
    let a = 2 * SCALE_FACTOR;
    let b = 3 * SCALE_FACTOR;
    assert_eq!(math::fp_mul(a, b), 6 * SCALE_FACTOR);
}

#[test]
fn test_fp_mul_fractional() {
    // 1.5 * 2.0 = 3.0
    let a = 1_500_000i128;
    let b = 2_000_000i128;
    assert_eq!(math::fp_mul(a, b), 3_000_000);
}

#[test]
fn test_fp_div_basic() {
    // 6.0 / 2.0 = 3.0
    let a = 6 * SCALE_FACTOR;
    let b = 2 * SCALE_FACTOR;
    assert_eq!(math::fp_div(a, b), 3 * SCALE_FACTOR);
}

#[test]
#[should_panic(expected = "fp_div: division by zero")]
fn test_fp_div_by_zero() {
    math::fp_div(1_000_000, 0);
}

#[test]
fn test_bps_to_fp() {
    // 10000 bps = 100% = 1.0 in fixed-point = SCALE_FACTOR
    assert_eq!(math::bps_to_fp(10_000), SCALE_FACTOR);
    // 5000 bps = 50% = 0.5 = 500_000
    assert_eq!(math::bps_to_fp(5_000), 500_000);
    // 1 bps = 0.01% = 100
    assert_eq!(math::bps_to_fp(1), 100);
}

#[test]
fn test_clamp() {
    assert_eq!(math::clamp(5, 1, 10), 5);
    assert_eq!(math::clamp(-5, 0, 100), 0);
    assert_eq!(math::clamp(200, 0, 100), 100);
    assert_eq!(math::clamp(0, 0, 0), 0);
}

#[test]
fn test_abs() {
    assert_eq!(math::abs(-42), 42);
    assert_eq!(math::abs(42), 42);
    assert_eq!(math::abs(0), 0);
}

#[test]
fn test_isqrt() {
    assert_eq!(math::isqrt(0), 0);
    assert_eq!(math::isqrt(1), 1);
    assert_eq!(math::isqrt(4), 2);
    assert_eq!(math::isqrt(9), 3);
    assert_eq!(math::isqrt(10), 3); // floor(sqrt(10)) = 3
    assert_eq!(math::isqrt(100), 10);
}

#[test]
#[should_panic(expected = "isqrt: negative input")]
fn test_isqrt_negative() {
    math::isqrt(-1);
}

#[test]
fn test_safe_ops() {
    assert_eq!(math::safe_add(10, 5), 15);
    assert_eq!(math::safe_sub(10, 5), 5);
    assert_eq!(math::safe_mul(4, 5), 20);
    assert_eq!(math::safe_div(20, 4), 5);
}

#[test]
#[should_panic(expected = "safe_div: division by zero")]
fn test_safe_div_zero() {
    math::safe_div(10, 0);
}

// ---------------------------------------------------------------------------
// time
// ---------------------------------------------------------------------------

#[test]
fn test_elapsed() {
    assert_eq!(time::elapsed(100, 200), 100);
    assert_eq!(time::elapsed(200, 100), 0); // no negative
    assert_eq!(time::elapsed(50, 50), 0);
}

#[test]
fn test_seconds_to_days() {
    assert_eq!(time::seconds_to_days(86_400), 1);
    assert_eq!(time::seconds_to_days(172_800), 2);
    assert_eq!(time::seconds_to_days(100_000), 1); // floor
}

#[test]
fn test_days_to_seconds() {
    assert_eq!(time::days_to_seconds(1), 86_400);
    assert_eq!(time::days_to_seconds(7), 604_800);
}

#[test]
fn test_seconds_to_hours() {
    assert_eq!(time::seconds_to_hours(3_600), 1);
    assert_eq!(time::seconds_to_hours(7_200), 2);
    assert_eq!(time::seconds_to_hours(3_700), 1); // floor
}

#[test]
fn test_fractional_year_fp() {
    use nova_rewards::SECONDS_PER_YEAR;
    // Full year → SCALE_FACTOR
    assert_eq!(
        time::fractional_year_fp(SECONDS_PER_YEAR, SCALE_FACTOR),
        SCALE_FACTOR
    );
    // Half year → SCALE_FACTOR / 2
    assert_eq!(
        time::fractional_year_fp(SECONDS_PER_YEAR / 2, SCALE_FACTOR),
        SCALE_FACTOR / 2
    );
}

#[test]
fn test_within_window() {
    assert!(time::within_window(50, 0, 100));
    assert!(time::within_window(0, 0, 100));
    assert!(!time::within_window(100, 0, 100)); // exclusive end
    assert!(!time::within_window(200, 0, 100));
}

#[test]
fn test_cliff_passed() {
    assert!(time::cliff_passed(0, 100, 100));
    assert!(time::cliff_passed(0, 100, 200));
    assert!(!time::cliff_passed(0, 100, 50));
}

// ---------------------------------------------------------------------------
// validation
// ---------------------------------------------------------------------------

#[test]
fn test_require_passes() {
    validation::require(true, "should not panic");
}

#[test]
#[should_panic(expected = "test condition")]
fn test_require_fails() {
    validation::require(false, "test condition");
}

#[test]
fn test_require_positive() {
    validation::require_positive(1, "amount");
}

#[test]
#[should_panic(expected = "amount must be positive")]
fn test_require_positive_zero() {
    validation::require_positive(0, "amount");
}

#[test]
#[should_panic(expected = "amount must be positive")]
fn test_require_positive_negative() {
    validation::require_positive(-1, "amount");
}

#[test]
fn test_require_non_negative() {
    validation::require_non_negative(0, "val");
    validation::require_non_negative(100, "val");
}

#[test]
#[should_panic(expected = "val must be non-negative")]
fn test_require_non_negative_fails() {
    validation::require_non_negative(-1, "val");
}

#[test]
fn test_require_in_range() {
    validation::require_in_range(5, 0, 10, "rate");
    validation::require_in_range(0, 0, 10, "rate");
    validation::require_in_range(10, 0, 10, "rate");
}

#[test]
#[should_panic(expected = "rate must be between")]
fn test_require_in_range_fails() {
    validation::require_in_range(11, 0, 10, "rate");
}

#[test]
fn test_require_max_len() {
    validation::require_max_len(3, 5, "path");
}

#[test]
#[should_panic(expected = "path length")]
fn test_require_max_len_fails() {
    validation::require_max_len(6, 5, "path");
}

#[test]
fn test_require_eq() {
    validation::require_eq(42, 42, "values");
}

#[test]
#[should_panic(expected = "values")]
fn test_require_eq_fails() {
    validation::require_eq(1, 2, "values");
}

#[test]
fn test_require_lt_and_lte() {
    validation::require_lt(1, 2, "a < b");
    validation::require_lte(2, 2, "a <= b");
    validation::require_lte(1, 2, "a <= b");
}

#[test]
#[should_panic]
fn test_require_lt_fails() {
    validation::require_lt(2, 2, "a < b");
}

// ---------------------------------------------------------------------------
// conversion
// ---------------------------------------------------------------------------

#[test]
fn test_to_decimal() {
    let (whole, frac) = conversion::to_decimal(1_500_000, 6);
    assert_eq!(whole, 1);
    assert_eq!(frac, 500_000);

    let (whole, frac) = conversion::to_decimal(0, 6);
    assert_eq!(whole, 0);
    assert_eq!(frac, 0);
}

#[test]
fn test_from_decimal() {
    assert_eq!(conversion::from_decimal(1, 500_000, 6), 1_500_000);
    assert_eq!(conversion::from_decimal(0, 0, 6), 0);
    assert_eq!(conversion::from_decimal(10, 0, 6), 10_000_000);
}

#[test]
fn test_bps_to_percent() {
    let (whole, frac) = conversion::bps_to_percent(500);
    assert_eq!(whole, 5);
    assert_eq!(frac, 0);

    let (whole, frac) = conversion::bps_to_percent(333);
    assert_eq!(whole, 3);
    assert_eq!(frac, 33);
}

#[test]
fn test_percent_to_bps() {
    assert_eq!(conversion::percent_to_bps(5, 0), 500);
    assert_eq!(conversion::percent_to_bps(3, 33), 333);
    assert_eq!(conversion::percent_to_bps(100, 0), 10_000);
}

#[test]
fn test_to_fp_from_fp_roundtrip() {
    let raw = 42i128;
    let fp = conversion::to_fp(raw);
    assert_eq!(fp, 42 * SCALE_FACTOR);
    assert_eq!(conversion::from_fp(fp), raw);
}

#[test]
fn test_stroops_xlm_roundtrip() {
    let stroops = 12_345_678i128; // 1.2345678 XLM
    let (whole, frac) = conversion::stroops_to_xlm(stroops);
    assert_eq!(whole, 1);
    assert_eq!(frac, 2_345_678);
    assert_eq!(conversion::xlm_to_stroops(whole, frac), stroops);
}

// ---------------------------------------------------------------------------
// array
// ---------------------------------------------------------------------------

#[test]
fn test_sum() {
    let env = Env::default();
    let mut v: Vec<i128> = Vec::new(&env);
    v.push_back(10);
    v.push_back(20);
    v.push_back(30);
    assert_eq!(array::sum(&v), 60);
}

#[test]
fn test_sum_empty() {
    let env = Env::default();
    let v: Vec<i128> = Vec::new(&env);
    assert_eq!(array::sum(&v), 0);
}

#[test]
fn test_min_max() {
    let env = Env::default();
    let mut v: Vec<i128> = Vec::new(&env);
    v.push_back(5);
    v.push_back(1);
    v.push_back(9);
    v.push_back(3);
    assert_eq!(array::min(&v), 1);
    assert_eq!(array::max(&v), 9);
}

#[test]
#[should_panic(expected = "min: empty vec")]
fn test_min_empty() {
    let env = Env::default();
    let v: Vec<i128> = Vec::new(&env);
    array::min(&v);
}

#[test]
fn test_contains() {
    let env = Env::default();
    let mut v: Vec<i128> = Vec::new(&env);
    v.push_back(10);
    v.push_back(20);
    assert!(array::contains(&v, 10));
    assert!(!array::contains(&v, 99));
}

#[test]
fn test_scale() {
    let env = Env::default();
    let mut v: Vec<i128> = Vec::new(&env);
    v.push_back(1);
    v.push_back(2);
    v.push_back(3);
    let scaled = array::scale(&env, &v, 10);
    assert_eq!(scaled.get(0).unwrap(), 10);
    assert_eq!(scaled.get(1).unwrap(), 20);
    assert_eq!(scaled.get(2).unwrap(), 30);
}

#[test]
fn test_filter() {
    let env = Env::default();
    let mut v: Vec<i128> = Vec::new(&env);
    v.push_back(1);
    v.push_back(2);
    v.push_back(3);
    v.push_back(4);
    let evens = array::filter(&env, &v, |x| x % 2 == 0);
    assert_eq!(evens.len(), 2);
    assert_eq!(evens.get(0).unwrap(), 2);
    assert_eq!(evens.get(1).unwrap(), 4);
}

#[test]
fn test_average() {
    let env = Env::default();
    let mut v: Vec<i128> = Vec::new(&env);
    v.push_back(10);
    v.push_back(20);
    v.push_back(30);
    assert_eq!(array::average(&v), 20);
}

// ---------------------------------------------------------------------------
// string
// ---------------------------------------------------------------------------

#[test]
fn test_byte_len_and_is_empty() {
    let env = Env::default();
    let empty = Bytes::new(&env);
    let non_empty = Bytes::from_slice(&env, b"hello");
    assert_eq!(string::byte_len(&empty), 0);
    assert!(string::is_empty(&empty));
    assert_eq!(string::byte_len(&non_empty), 5);
    assert!(!string::is_empty(&non_empty));
}

#[test]
fn test_starts_with() {
    let env = Env::default();
    let haystack = Bytes::from_slice(&env, b"hello world");
    let prefix = Bytes::from_slice(&env, b"hello");
    let not_prefix = Bytes::from_slice(&env, b"world");
    assert!(string::starts_with(&haystack, &prefix));
    assert!(!string::starts_with(&haystack, &not_prefix));
}

#[test]
fn test_ends_with() {
    let env = Env::default();
    let haystack = Bytes::from_slice(&env, b"hello world");
    let suffix = Bytes::from_slice(&env, b"world");
    let not_suffix = Bytes::from_slice(&env, b"hello");
    assert!(string::ends_with(&haystack, &suffix));
    assert!(!string::ends_with(&haystack, &not_suffix));
}

#[test]
fn test_concat() {
    let env = Env::default();
    let a = Bytes::from_slice(&env, b"foo");
    let b = Bytes::from_slice(&env, b"bar");
    let result = string::concat(&env, &a, &b);
    assert_eq!(result, Bytes::from_slice(&env, b"foobar"));
}

#[test]
fn test_i128_to_bytes() {
    let env = Env::default();
    assert_eq!(
        string::i128_to_bytes(&env, 0),
        Bytes::from_slice(&env, b"0")
    );
    assert_eq!(
        string::i128_to_bytes(&env, 42),
        Bytes::from_slice(&env, b"42")
    );
    assert_eq!(
        string::i128_to_bytes(&env, -7),
        Bytes::from_slice(&env, b"-7")
    );
    assert_eq!(
        string::i128_to_bytes(&env, 1_000_000),
        Bytes::from_slice(&env, b"1000000")
    );
}
