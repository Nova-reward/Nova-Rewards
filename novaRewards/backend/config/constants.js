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

/** Longer sliding-window for authentication endpoints (15 minutes). */
const RL_AUTH_WINDOW_MS = 15 * MS_PER_MINUTE;

// ---------------------------------------------------------------------------
// Rate-limit max requests (requests per window)
// ---------------------------------------------------------------------------

/** Global per-IP request cap per window. */
const RL_GLOBAL_MAX = 100;

/** Auth endpoint cap per window (login, forgot-password). */
const RL_AUTH_MAX = 5;

/** Login endpoint cap per 15-minute window per IP. */
const RL_LOGIN_MAX = 10;

/** Token refresh endpoint cap per 15-minute window per IP. */
const RL_REFRESH_MAX = 30;

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
// Rate-limit identifier strategies
// ---------------------------------------------------------------------------

/**
 * Supported strategies for deriving the per-request rate-limit identifier.
 * The string values are the wire contract consumed by the sliding-window
 * factory (`keyBy`); they must stay stable so existing limiters keep working.
 */
const IDENTIFIER_STRATEGY = Object.freeze({
  IP:         'ip',
  USER:       'user',
  USER_OR_IP: 'user-or-ip',
  API_KEY:    'api-key',
  MERCHANT:   'merchant',
});

// ---------------------------------------------------------------------------
// Shared Redis namespace
// ---------------------------------------------------------------------------

/**
 * Root segments for every Redis key this service owns. Centralising them here
 * lets the rate limiter and the abuse-detection layer share one convention and
 * makes future key families (analytics, quotas, …) easy to slot in without
 * risking collisions between subsystems.
 *
 * Key layout:
 *   rl:<prefix>:<identifier>   — sliding-window rate-limit buckets
 *   abuse:<kind>:<identifier>  — abuse-detection counters, blocks, soft locks
 */
const REDIS_ROOT = Object.freeze({
  RATE_LIMIT: 'rl',
  ABUSE:      'abuse',
});

/** Abuse-detection key families under the shared `abuse:` root. */
const ABUSE_KIND = Object.freeze({
  BLOCK:     'block',    // hard block (IP or wallet)
  SOFT_LOCK: 'softlock', // graduated, short-lived lock ahead of a hard block
  CRED:      'cred',     // credential-stuffing failure counter (per IP)
  FARM:      'farm',     // reward-farming campaign set (per wallet)
});

/**
 * Builders for every namespaced Redis key. Both middlewares import these so a
 * key format is defined in exactly one place.
 */
const REDIS_NAMESPACE = Object.freeze({
  /** Sliding-window bucket key, e.g. `rl:sw:auth:ip:1.2.3.4`. */
  rateLimit: (prefix, identifier) => `${REDIS_ROOT.RATE_LIMIT}:${prefix}:${identifier}`,
  /** Full abuse key, e.g. `abuse:block:1.2.3.4`. */
  abuse:       (kind, identifier) => `${REDIS_ROOT.ABUSE}:${kind}:${identifier}`,
  /** Abuse key prefix (trailing colon), e.g. `abuse:block:`, for `${prefix}${id}` callers. */
  abusePrefix: (kind) => `${REDIS_ROOT.ABUSE}:${kind}:`,
});

// ---------------------------------------------------------------------------
// Abuse-detection escalation (repeated-401 → soft lock → hard block)
// ---------------------------------------------------------------------------

/**
 * Failed-login count at which an IP earns a short-lived "soft lock" — a
 * temporary 429 that lets a mistyped-password human recover quickly while
 * slowing an attacker, well before the hard credential-stuffing block trips.
 */
const CRED_SOFT_LOCK_THRESHOLD = 5;

// ---------------------------------------------------------------------------
// Per-route rate-limit configuration matrix
// ---------------------------------------------------------------------------

/**
 * Single source of truth for every protected route's rate-limit policy.
 *
 * Each entry declares:
 *   prefix             — sliding-window key prefix (`rl:<prefix>:<id>`)
 *   windowMs           — window size in milliseconds
 *   max                — max requests per window (env-overridable, see below)
 *   identifierStrategy — how the caller is identified (IDENTIFIER_STRATEGY)
 *   envMax             — optional env var name that overrides `max` at boot
 *   message            — optional custom 429 message
 *
 * `max` keeps its historical env-override behaviour so ops can retune limits
 * without a deploy; `rateLimiter.js` resolves `envMax` at construction time.
 */
const RATE_LIMIT_ROUTES = Object.freeze({
  global: {
    prefix: 'sw:global',
    windowMs: RATE_LIMIT_WINDOW_MS,
    max: RL_GLOBAL_MAX,
    identifierStrategy: IDENTIFIER_STRATEGY.IP,
    envMax: 'RL_GLOBAL_MAX',
  },
  auth: {
    prefix: 'sw:auth',
    windowMs: RATE_LIMIT_WINDOW_MS,
    max: RL_AUTH_MAX,
    identifierStrategy: IDENTIFIER_STRATEGY.IP,
    envMax: 'RL_AUTH_MAX',
    message: `Too many authentication attempts. Retry after ${RATE_LIMIT_RETRY_AFTER_SECS} seconds.`,
  },
  user: {
    prefix: 'sw:user',
    windowMs: RATE_LIMIT_WINDOW_MS,
    max: RL_USER_MAX,
    identifierStrategy: IDENTIFIER_STRATEGY.USER_OR_IP,
    envMax: 'RL_USER_MAX',
  },
  search: {
    prefix: 'sw:search',
    windowMs: RATE_LIMIT_WINDOW_MS,
    max: RL_SEARCH_MAX,
    identifierStrategy: IDENTIFIER_STRATEGY.USER_OR_IP,
    envMax: 'RL_SEARCH_MAX',
    message: `Search rate limit exceeded. Retry after ${RATE_LIMIT_RETRY_AFTER_SECS} seconds.`,
  },
  webhook: {
    prefix: 'sw:webhook',
    windowMs: RATE_LIMIT_WINDOW_MS,
    max: RL_WEBHOOK_MAX,
    identifierStrategy: IDENTIFIER_STRATEGY.IP,
    envMax: 'RL_WEBHOOK_MAX',
  },
  webhookApiKey: {
    prefix: 'sw:webhook-apikey',
    windowMs: RATE_LIMIT_WINDOW_MS,
    max: RL_WEBHOOK_API_KEY_MAX,
    identifierStrategy: IDENTIFIER_STRATEGY.API_KEY,
    envMax: 'RL_WEBHOOK_API_KEY_MAX',
  },
  rewards: {
    prefix: 'sw:rewards',
    windowMs: RATE_LIMIT_WINDOW_MS,
    max: RL_REWARDS_MAX,
    identifierStrategy: IDENTIFIER_STRATEGY.MERCHANT,
    envMax: 'RL_REWARDS_MAX',
  },
  admin: {
    prefix: 'sw:admin',
    windowMs: RATE_LIMIT_WINDOW_MS,
    max: RL_ADMIN_MAX,
    identifierStrategy: IDENTIFIER_STRATEGY.USER,
    envMax: 'RL_ADMIN_MAX',
  },
  login: {
    prefix: 'sw:login',
    windowMs: RL_AUTH_WINDOW_MS,
    max: RL_LOGIN_MAX,
    identifierStrategy: IDENTIFIER_STRATEGY.IP,
    envMax: 'RL_LOGIN_MAX',
    message: `Too many login attempts. Retry after ${Math.ceil(RL_AUTH_WINDOW_MS / MS_PER_SECOND)} seconds.`,
  },
  refresh: {
    prefix: 'sw:refresh',
    windowMs: RL_AUTH_WINDOW_MS,
    max: RL_REFRESH_MAX,
    identifierStrategy: IDENTIFIER_STRATEGY.IP,
    envMax: 'RL_REFRESH_MAX',
    message: `Too many token refresh attempts. Retry after ${Math.ceil(RL_AUTH_WINDOW_MS / MS_PER_SECOND)} seconds.`,
  },
});

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
  RL_AUTH_WINDOW_MS,
  RL_GLOBAL_MAX,
  RL_AUTH_MAX,
  RL_LOGIN_MAX,
  RL_REFRESH_MAX,
  RL_USER_MAX,
  RL_SEARCH_MAX,
  RL_WEBHOOK_MAX,
  RL_WEBHOOK_API_KEY_MAX,
  RL_REWARDS_MAX,
  RL_ADMIN_MAX,
  RATE_LIMIT_RETRY_AFTER_SECS,
  // rate-limit identifier strategies + shared namespace
  IDENTIFIER_STRATEGY,
  REDIS_ROOT,
  ABUSE_KIND,
  REDIS_NAMESPACE,
  RATE_LIMIT_ROUTES,
  // abuse-detection escalation
  CRED_SOFT_LOCK_THRESHOLD,
  // pagination
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  MIN_PAGE_SIZE,
  // rewards
  REWARD_ISSUANCE_MAX_ATTEMPTS,
  DEFAULT_REFERRAL_BONUS_POINTS,
  DEFAULT_DAILY_BONUS_POINTS,
};
