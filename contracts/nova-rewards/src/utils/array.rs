//! Array/Vec utilities for Soroban SDK Vec<i128> operations.

use soroban_sdk::{Env, Vec};

/// Returns the sum of all elements. Returns 0 for empty vec.
pub fn sum(v: &Vec<i128>) -> i128 {
    let mut total: i128 = 0;
    for i in 0..v.len() {
        total = total
            .checked_add(v.get(i).unwrap())
            .expect("sum: overflow");
    }
    total
}

/// Returns the minimum value in the vec.
///
/// # Panics
/// Panics if the vec is empty.
pub fn min(v: &Vec<i128>) -> i128 {
    if v.is_empty() {
        panic!("min: empty vec");
    }
    let mut m = v.get(0).unwrap();
    for i in 1..v.len() {
        let val = v.get(i).unwrap();
        if val < m {
            m = val;
        }
    }
    m
}

/// Returns the maximum value in the vec.
///
/// # Panics
/// Panics if the vec is empty.
pub fn max(v: &Vec<i128>) -> i128 {
    if v.is_empty() {
        panic!("max: empty vec");
    }
    let mut m = v.get(0).unwrap();
    for i in 1..v.len() {
        let val = v.get(i).unwrap();
        if val > m {
            m = val;
        }
    }
    m
}

/// Returns true if `target` is present in `v`.
pub fn contains(v: &Vec<i128>, target: i128) -> bool {
    for i in 0..v.len() {
        if v.get(i).unwrap() == target {
            return true;
        }
    }
    false
}

/// Returns a new Vec with all elements multiplied by `scalar`.
pub fn scale(env: &Env, v: &Vec<i128>, scalar: i128) -> Vec<i128> {
    let mut result = Vec::new(env);
    for i in 0..v.len() {
        let val = v.get(i).unwrap();
        result.push_back(
            val.checked_mul(scalar).expect("scale: overflow"),
        );
    }
    result
}

/// Returns a new Vec containing only elements satisfying `predicate`.
/// `predicate` receives the element value and returns true to keep it.
pub fn filter(env: &Env, v: &Vec<i128>, predicate: impl Fn(i128) -> bool) -> Vec<i128> {
    let mut result = Vec::new(env);
    for i in 0..v.len() {
        let val = v.get(i).unwrap();
        if predicate(val) {
            result.push_back(val);
        }
    }
    result
}

/// Returns the integer average (floor) of the vec.
///
/// # Panics
/// Panics if the vec is empty.
pub fn average(v: &Vec<i128>) -> i128 {
    if v.is_empty() {
        panic!("average: empty vec");
    }
    sum(v) / v.len() as i128
}
