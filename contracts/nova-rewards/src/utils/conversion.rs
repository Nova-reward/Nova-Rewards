//! Conversion utilities between token units, basis points, and fixed-point.

use crate::SCALE_FACTOR;

/// Converts a raw token amount (base units) to a human-readable decimal
/// representation scaled by `decimals` places.
///
/// Returns `(whole, fractional)` where `fractional` is zero-padded to `decimals` digits.
///
/// # Example
/// `to_decimal(1_500_000, 6)` → `(1, 500000)` meaning "1.500000"
pub fn to_decimal(amount: i128, decimals: u32) -> (i128, i128) {
    let scale = 10i128.pow(decimals);
    let whole = amount / scale;
    let frac = (amount % scale).abs();
    (whole, frac)
}

/// Converts a human-readable decimal to base units.
/// `whole` + `fractional` (zero-padded to `decimals` digits) → base units.
pub fn from_decimal(whole: i128, fractional: i128, decimals: u32) -> i128 {
    let scale = 10i128.pow(decimals);
    whole
        .checked_mul(scale)
        .expect("from_decimal: overflow")
        .checked_add(fractional)
        .expect("from_decimal: overflow adding fractional")
}

/// Converts basis points to a percentage string representation.
/// 500 bps → "5.00" (as (whole_pct, hundredths))
pub fn bps_to_percent(bps: i128) -> (i128, i128) {
    let whole = bps / 100;
    let frac = bps % 100;
    (whole, frac)
}

/// Converts a percentage (whole + hundredths) back to basis points.
pub fn percent_to_bps(whole_pct: i128, hundredths: i128) -> i128 {
    whole_pct
        .checked_mul(100)
        .expect("percent_to_bps: overflow")
        .checked_add(hundredths)
        .expect("percent_to_bps: overflow adding hundredths")
}

/// Scales a raw amount up by SCALE_FACTOR (converts to fixed-point).
pub fn to_fp(amount: i128) -> i128 {
    amount
        .checked_mul(SCALE_FACTOR)
        .expect("to_fp: overflow")
}

/// Scales a fixed-point value down by SCALE_FACTOR (converts to raw amount, truncated).
pub fn from_fp(fp_amount: i128) -> i128 {
    fp_amount
        .checked_div(SCALE_FACTOR)
        .expect("from_fp: overflow")
}

/// Converts stroops (Stellar base unit, 1 XLM = 10^7 stroops) to XLM as (whole, fractional).
pub fn stroops_to_xlm(stroops: i128) -> (i128, i128) {
    to_decimal(stroops, 7)
}

/// Converts XLM (whole + fractional with 7 decimal places) to stroops.
pub fn xlm_to_stroops(whole: i128, fractional: i128) -> i128 {
    from_decimal(whole, fractional, 7)
}
