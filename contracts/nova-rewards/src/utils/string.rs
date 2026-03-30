//! String utilities for Soroban Bytes/Symbol operations.
//!
//! Soroban contracts run in a `no_std` environment, so these helpers work
//! with raw byte slices and `soroban_sdk::Bytes` rather than `std::String`.

use soroban_sdk::{Bytes, Env};

/// Returns the length of a `Bytes` value.
pub fn byte_len(b: &Bytes) -> u32 {
    b.len()
}

/// Returns true if `b` is empty (length == 0).
pub fn is_empty(b: &Bytes) -> bool {
    b.len() == 0
}

/// Returns true if `haystack` starts with `prefix` (byte-wise).
pub fn starts_with(haystack: &Bytes, prefix: &Bytes) -> bool {
    if prefix.len() > haystack.len() {
        return false;
    }
    for i in 0..prefix.len() {
        if haystack.get(i) != prefix.get(i) {
            return false;
        }
    }
    true
}

/// Returns true if `haystack` ends with `suffix` (byte-wise).
pub fn ends_with(haystack: &Bytes, suffix: &Bytes) -> bool {
    let hlen = haystack.len();
    let slen = suffix.len();
    if slen > hlen {
        return false;
    }
    let offset = hlen - slen;
    for i in 0..slen {
        if haystack.get(offset + i) != suffix.get(i) {
            return false;
        }
    }
    true
}

/// Concatenates two `Bytes` values into a new one.
pub fn concat(env: &Env, a: &Bytes, b: &Bytes) -> Bytes {
    let mut result = a.clone();
    result.append(b);
    result
}

/// Converts an `i128` to its ASCII decimal representation as `Bytes`.
/// Handles negative numbers with a leading `-` byte.
pub fn i128_to_bytes(env: &Env, mut n: i128) -> Bytes {
    if n == 0 {
        return Bytes::from_slice(env, b"0");
    }

    let negative = n < 0;
    if negative {
        n = -n;
    }

    // Build digits in reverse
    let mut digits: [u8; 40] = [0u8; 40]; // i128::MAX has 39 digits
    let mut len = 0usize;
    while n > 0 {
        digits[len] = b'0' + (n % 10) as u8;
        n /= 10;
        len += 1;
    }

    let total = if negative { len + 1 } else { len };
    let mut buf = [0u8; 41];
    let mut pos = 0;
    if negative {
        buf[pos] = b'-';
        pos += 1;
    }
    for i in (0..len).rev() {
        buf[pos] = digits[i];
        pos += 1;
    }

    Bytes::from_slice(env, &buf[..total])
}
