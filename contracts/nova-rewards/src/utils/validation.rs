//! Validation utilities for common contract guard checks.

/// Panics with `msg` if `condition` is false.
#[inline]
pub fn require(condition: bool, msg: &str) {
    if !condition {
        panic!("{}", msg);
    }
}

/// Panics if `amount` is not strictly positive.
pub fn require_positive(amount: i128, label: &str) {
    if amount <= 0 {
        panic!("{} must be positive", label);
    }
}

/// Panics if `amount` is negative.
pub fn require_non_negative(amount: i128, label: &str) {
    if amount < 0 {
        panic!("{} must be non-negative", label);
    }
}

/// Panics if `value` is outside `[min, max]`.
pub fn require_in_range(value: i128, min: i128, max: i128, label: &str) {
    if value < min || value > max {
        panic!("{} must be between {} and {}", label, min, max);
    }
}

/// Panics if `len` exceeds `max_len`.
pub fn require_max_len(len: u32, max_len: u32, label: &str) {
    if len > max_len {
        panic!("{} length {} exceeds maximum {}", label, len, max_len);
    }
}

/// Panics if `a != b`.
pub fn require_eq(a: i128, b: i128, msg: &str) {
    if a != b {
        panic!("{}: {} != {}", msg, a, b);
    }
}

/// Panics if `a >= b` (i.e. requires a < b).
pub fn require_lt(a: i128, b: i128, msg: &str) {
    if a >= b {
        panic!("{}: {} must be < {}", msg, a, b);
    }
}

/// Panics if `a > b` (i.e. requires a <= b).
pub fn require_lte(a: i128, b: i128, msg: &str) {
    if a > b {
        panic!("{}: {} must be <= {}", msg, a, b);
    }
}
