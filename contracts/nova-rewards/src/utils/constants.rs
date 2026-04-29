//! Named constants for configuration values, limits, time durations, and fee parameters.
//!
//! All magic numbers used across the Nova Rewards contract are defined here
//! so they are documented, discoverable, and easy to update in one place.

// ---------------------------------------------------------------------------
// Fixed-point arithmetic
// ---------------------------------------------------------------------------

/// Scale factor for 6 decimal places of fixed-point precision.
/// A value of `1_000_000` represents `1.0` in fixed-point.
pub const SCALE_FACTOR: i128 = 1_000_000;

// ---------------------------------------------------------------------------
// Basis points
// ---------------------------------------------------------------------------

/// Divisor for basis-point calculations (10 000 bps = 100%).
pub const BASIS_POINTS_DIVISOR: i128 = 10_000;

/// Maximum allowed annual staking rate in basis points (100% APY).
pub const MAX_ANNUAL_RATE_BPS: i128 = 10_000;

/// Minimum allowed annual staking rate in basis points (0% APY).
pub const MIN_ANNUAL_RATE_BPS: i128 = 0;

// ---------------------------------------------------------------------------
// Time constants (seconds)
// ---------------------------------------------------------------------------

/// Seconds in one minute.
pub const SECONDS_PER_MINUTE: u64 = 60;

/// Seconds in one hour.
pub const SECONDS_PER_HOUR: u64 = 3_600;

/// Seconds in one day (24 hours).
pub const SECONDS_PER_DAY: u64 = 86_400;

/// Seconds in one week (7 days).
pub const SECONDS_PER_WEEK: u64 = 7 * SECONDS_PER_DAY;

/// Seconds in one approximate month (30 days).
pub const SECONDS_PER_MONTH: u64 = 30 * SECONDS_PER_DAY;

/// Seconds in one year (365 days). Used for annualised yield calculations.
pub const SECONDS_PER_YEAR: u64 = 365 * SECONDS_PER_DAY; // 31_536_000

// ---------------------------------------------------------------------------
// Daily limit
// ---------------------------------------------------------------------------

/// Window size for the daily withdrawal limit check (24 hours in seconds).
pub const DAILY_LIMIT_WINDOW_SECS: u64 = SECONDS_PER_DAY;

/// Ledger TTL extension for persistent daily-usage records (1 year in seconds).
pub const DAILY_USAGE_TTL_SECS: u64 = SECONDS_PER_YEAR;

// ---------------------------------------------------------------------------
// Swap / path limits
// ---------------------------------------------------------------------------

/// Maximum number of hops allowed in a DEX swap path.
pub const MAX_SWAP_PATH_HOPS: u32 = 5;

// ---------------------------------------------------------------------------
// Staking
// ---------------------------------------------------------------------------

/// Minimum stakeable amount (1 token in base units).
pub const MIN_STAKE_AMOUNT: i128 = 1;
