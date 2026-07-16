/**
 * Application-wide named constants for the Nova Rewards frontend.
 *
 * Replace all magic numbers with references to these values so that
 * configuration is documented, discoverable, and easy to update.
 */

// ---------------------------------------------------------------------------
// Time constants (milliseconds)
// ---------------------------------------------------------------------------

/** One second in milliseconds. */
export const MS_PER_SECOND = 1_000;

/** One minute in milliseconds. */
export const MS_PER_MINUTE = 60 * MS_PER_SECOND;

// ---------------------------------------------------------------------------
// Polling intervals
// ---------------------------------------------------------------------------

/** How often the points widget polls for a balance update. */
export const POINTS_POLL_INTERVAL_MS = 5 * MS_PER_SECOND;

// ---------------------------------------------------------------------------
// Animation durations (milliseconds)
// ---------------------------------------------------------------------------

/** How long the +/- delta indicator stays visible after a balance change. */
export const POINTS_DELTA_DISPLAY_MS = 3 * MS_PER_SECOND;

/** How long the counter increment animation plays. */
export const POINTS_COUNTER_ANIMATION_MS = 700;

/** Duration of the animated counter number roll. */
export const POINTS_COUNTER_ROLL_MS = MS_PER_SECOND;

/** Default toast notification display duration. */
export const TOAST_DEFAULT_DURATION_MS = 5 * MS_PER_SECOND;

/** How long the "copied" indicator stays visible in settings. */
export const COPIED_INDICATOR_MS = 2 * MS_PER_SECOND;

// ---------------------------------------------------------------------------
// UI limits
// ---------------------------------------------------------------------------

/** Maximum number of toast notifications shown simultaneously. */
export const MAX_TOASTS = 3;

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

/** Default page size for redemption history. */
export const REDEMPTION_PAGE_SIZE = 10;

/** Default page size for rewards and transaction history. */
export const HISTORY_PAGE_SIZE = 20;

/** Maximum number of transactions fetched for CSV export. */
export const EXPORT_MAX_TRANSACTIONS = 10_000;
