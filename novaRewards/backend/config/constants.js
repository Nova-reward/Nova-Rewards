'use strict';

/**
 * Application-wide named constants.
 *
 * Replace all magic numbers with references to these values so that
 * configuration is documented, discoverable, and easy to update.
 */

// ---------------------------------------------------------------------------
// Time constants (milliseconds)
// ---------------------------------------------------------------------------

/** One second in milliseconds. */
const MS_PER_SECOND = 1_000;

/** One minute in milliseconds. */
const MS_PER_MINUTE = 60 * MS_PER_SECOND;

/** One hour in milliseconds. */
const MS_PER_HOUR = 60 * MS_PER_MINUTE;

/** One day in milliseconds. */
const MS_PER_DAY = 24 * MS_PER_HOUR;

// ---------------------------------------------------------------------------
// Rate-limit windows (milliseconds)
// ---------------------------------------------------------------------------

/** Standard sliding-window size used by most rate limiters (60 seconds). */
const RATE_LIMIT_WINDOW_MS = MS_PER_MINUTE;

// ---------------------------------------------------------------------------
// Rate-limit max requests (requests per window)
// ---------------------------------------------------------------------------

/** Global per-IP request cap per window. */
const RL_GLOBAL_MAX = 100;

/** Auth endpoint cap per window (login, forgot-password). */
const RL_AUTH_MAX = 5;

/** Authenticated-user cap per window. */
const RL_USER_MAX = 200;

/** Search endpoint cap per window. */
const RL_SEARCH_MAX = 30;

/** Webhook endpoint cap per window (per IP). */
const RL_WEBHOOK_MAX = 60;

/** Webhook endpoint cap per window (per merchant API key). */
const RL_WEBHOOK_API_KEY_MAX = 1_000;

/** Reward-distribution endpoint cap per window. */
const RL_REWARDS_MAX = 20;

/** Admin endpoint cap per window (per user). */
const RL_ADMIN_MAX = 120;

/** Retry-After header value returned on 429 responses (seconds). */
const RATE_LIMIT_RETRY_AFTER_SECS = 60;

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

/** Default page size for list endpoints. */
const DEFAULT_PAGE_SIZE = 20;

/** Maximum page size accepted from clients. */
const MAX_PAGE_SIZE = 100;

/** Minimum page size accepted from clients. */
const MIN_PAGE_SIZE = 1;

// ---------------------------------------------------------------------------
// Reward issuance
// ---------------------------------------------------------------------------

/** Default number of retry attempts for failed reward-issuance jobs. */
const REWARD_ISSUANCE_MAX_ATTEMPTS = 3;

/** Default referral bonus points awarded on successful referral. */
const DEFAULT_REFERRAL_BONUS_POINTS = 100;

/** Default daily login bonus points. */
const DEFAULT_DAILY_BONUS_POINTS = 10;

module.exports = {
  // time
  MS_PER_SECOND,
  MS_PER_MINUTE,
  MS_PER_HOUR,
  MS_PER_DAY,
  // rate limits
  RATE_LIMIT_WINDOW_MS,
  RL_GLOBAL_MAX,
  RL_AUTH_MAX,
  RL_USER_MAX,
  RL_SEARCH_MAX,
  RL_WEBHOOK_MAX,
  RL_WEBHOOK_API_KEY_MAX,
  RL_REWARDS_MAX,
  RL_ADMIN_MAX,
  RATE_LIMIT_RETRY_AFTER_SECS,
  // pagination
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  MIN_PAGE_SIZE,
  // rewards
  REWARD_ISSUANCE_MAX_ATTEMPTS,
  DEFAULT_REFERRAL_BONUS_POINTS,
  DEFAULT_DAILY_BONUS_POINTS,
};
