//! Math utilities for fixed-point arithmetic and safe numeric operations.

use crate::SCALE_FACTOR;

/// Multiplies two fixed-point values (both scaled by SCALE_FACTOR).
/// Returns result scaled by SCALE_FACTOR.
///
/// # Panics
/// Panics on overflow.
pub fn fp_mul(a: i128, b: i128) -> i128 {
    a.checked_mul(b)
        .expect("fp_mul: overflow in a * b")
        .checked_div(SCALE_FACTOR)
        .expect("fp_mul: overflow in / SCALE_FACTOR")
}

/// Divides two fixed-point values (both scaled by SCALE_FACTOR).
/// Returns result scaled by SCALE_FACTOR.
///
/// # Panics
/// Panics on overflow or division by zero.
pub fn fp_div(a: i128, b: i128) -> i128 {
    if b == 0 {
        panic!("fp_div: division by zero");
    }
    a.checked_mul(SCALE_FACTOR)
        .expect("fp_div: overflow in a * SCALE_FACTOR")
        .checked_div(b)
        .expect("fp_div: overflow in / b")
}

/// Converts basis points (e.g. 500 = 5%) to a SCALE_FACTOR-scaled fraction.
/// Result = bps * SCALE_FACTOR / 10_000
pub fn bps_to_fp(bps: i128) -> i128 {
    bps.checked_mul(SCALE_FACTOR)
        .expect("bps_to_fp: overflow")
        .checked_div(10_000)
        .expect("bps_to_fp: division error")
}

/// Clamps `value` to the inclusive range `[min, max]`.
pub fn clamp(value: i128, min: i128, max: i128) -> i128 {
    if value < min {
        min
    } else if value > max {
        max
    } else {
        value
    }
}

/// Returns the absolute value of `n`.
pub fn abs(n: i128) -> i128 {
    if n < 0 { -n } else { n }
}

/// Integer square root (floor) using Newton's method.
/// Returns the largest integer `r` such that `r * r <= n`.
///
/// # Panics
/// Panics if `n` is negative.
pub fn isqrt(n: i128) -> i128 {
    if n < 0 {
        panic!("isqrt: negative input");
    }
    if n == 0 {
        return 0;
    }
    let mut x = n;
    let mut y = (x + 1) / 2;
    while y < x {
        x = y;
        y = (x + n / x) / 2;
    }
    x
}

/// Safe addition — panics on overflow.
pub fn safe_add(a: i128, b: i128) -> i128 {
    a.checked_add(b).expect("safe_add: overflow")
}

/// Safe subtraction — panics on underflow.
pub fn safe_sub(a: i128, b: i128) -> i128 {
    a.checked_sub(b).expect("safe_sub: underflow")
}

/// Safe multiplication — panics on overflow.
pub fn safe_mul(a: i128, b: i128) -> i128 {
    a.checked_mul(b).expect("safe_mul: overflow")
}

/// Safe division — panics on division by zero or overflow.
pub fn safe_div(a: i128, b: i128) -> i128 {
    if b == 0 {
        panic!("safe_div: division by zero");
    }
    a.checked_div(b).expect("safe_div: overflow")
}
