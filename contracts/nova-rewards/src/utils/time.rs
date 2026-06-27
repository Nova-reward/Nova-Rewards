//! Time utilities for duration and epoch calculations.

use crate::SECONDS_PER_YEAR;

pub const SECONDS_PER_DAY: u64 = 86_400;
pub const SECONDS_PER_HOUR: u64 = 3_600;
pub const SECONDS_PER_MINUTE: u64 = 60;
pub const SECONDS_PER_WEEK: u64 = 7 * SECONDS_PER_DAY;
pub const SECONDS_PER_MONTH: u64 = 30 * SECONDS_PER_DAY; // approximate

/// Returns elapsed seconds between two timestamps.
/// Returns 0 if `end <= start` (no negative durations).
pub fn elapsed(start: u64, end: u64) -> u64 {
    if end > start { end - start } else { 0 }
}

/// Converts seconds to whole days (floor).
pub fn seconds_to_days(secs: u64) -> u64 {
    secs / SECONDS_PER_DAY
}

/// Converts whole days to seconds.
pub fn days_to_seconds(days: u64) -> u64 {
    days.checked_mul(SECONDS_PER_DAY).expect("days_to_seconds: overflow")
}

/// Converts seconds to whole hours (floor).
pub fn seconds_to_hours(secs: u64) -> u64 {
    secs / SECONDS_PER_HOUR
}

/// Returns the fractional year elapsed as a SCALE_FACTOR-scaled integer.
/// e.g. half a year → 500_000 (with SCALE_FACTOR = 1_000_000).
pub fn fractional_year_fp(elapsed_secs: u64, scale: i128) -> i128 {
    (elapsed_secs as i128)
        .checked_mul(scale)
        .expect("fractional_year_fp: overflow")
        .checked_div(SECONDS_PER_YEAR as i128)
        .expect("fractional_year_fp: division error")
}

/// Returns true if `timestamp` is within `[window_start, window_start + duration)`.
pub fn within_window(timestamp: u64, window_start: u64, duration: u64) -> bool {
    timestamp >= window_start && timestamp < window_start.saturating_add(duration)
}

/// Returns true if the cliff period has passed.
pub fn cliff_passed(start: u64, cliff_secs: u64, now: u64) -> bool {
    now >= start.saturating_add(cliff_secs)
}
