'use strict';
const logger = require('../lib/logger');

const { client: redis } = require('../lib/redis');
const { sendSecurityAlert } = require('../services/securityAlertService');
const { REDIS_NAMESPACE, CRED_SOFT_LOCK_THRESHOLD } = require('../config/constants');

// ── Config ────────────────────────────────────────────────────────────────────
const CRED_STUFF_WINDOW_S  = parseInt(process.env.CRED_STUFF_WINDOW_S)  || 300; // 5 min
const CRED_STUFF_THRESHOLD = parseInt(process.env.CRED_STUFF_THRESHOLD) || 10;
const CRED_STUFF_BLOCK_S   = parseInt(process.env.CRED_STUFF_BLOCK_S)   || 900; // 15 min

// Soft-lock: a graduated response that engages *before* the hard block. Once an
// IP crosses the soft-lock threshold of failed logins within the
// credential-stuffing window, further login attempts are rejected with a 429
// until the window decays. It is enforced purely on read in checkIpBlock (no
// extra writes), so a single mistyped-password streak is throttled early while
// aggressive parallel stuffing still races past the counter into a full hard
// block + alert. Threshold is sourced from constants (single source of truth),
// with an env override for ops tuning.
const SOFT_LOCK_THRESHOLD  = parseInt(process.env.CRED_SOFT_LOCK_THRESHOLD) || CRED_SOFT_LOCK_THRESHOLD;

const FARM_WINDOW_S        = parseInt(process.env.FARM_WINDOW_S)        || 60;  // 1 min
const FARM_THRESHOLD       = parseInt(process.env.FARM_THRESHOLD)       || 5;
const FARM_BLOCK_S         = parseInt(process.env.FARM_BLOCK_S)         || 3600; // 1 hr

// Key prefixes are derived from the shared namespace module so the abuse tree
// (abuse:*) and the rate-limit tree (rl:*) can never collide, and every key
// convention lives in one place. The resulting strings are unchanged.
const BLOCK_PREFIX  = REDIS_NAMESPACE.abusePrefix('block'); // 'abuse:block:'
const CRED_PREFIX   = REDIS_NAMESPACE.abusePrefix('cred');  // 'abuse:cred:'
const FARM_PREFIX   = REDIS_NAMESPACE.abusePrefix('farm');  // 'abuse:farm:'

// ── Helpers ───────────────────────────────────────────────────────────────────

async function isBlocked(key) {
  try {
    return !!(await redis.get(`${BLOCK_PREFIX}${key}`));
  } catch {
    return false; // fail open — never block on Redis errors
  }
}

/**
 * Current failed-login count for an IP within the active window.
 * Reads the credential-stuffing counter; returns 0 on miss or Redis error.
 */
async function failedLoginCount(ip) {
  try {
    return Number(await redis.get(`${CRED_PREFIX}${ip}`)) || 0;
  } catch {
    return 0; // fail open
  }
}

/**
 * Seconds until the credential-stuffing counter for an IP expires.
 * Used as the soft-lock Retry-After so it accurately reflects the cooldown.
 */
async function failedLoginTtl(ip) {
  try {
    const ttl = await redis.ttl(`${CRED_PREFIX}${ip}`);
    return ttl > 0 ? ttl : CRED_STUFF_WINDOW_S;
  } catch {
    return CRED_STUFF_WINDOW_S;
  }
}

async function block(key, ttlSeconds, type, reason, meta) {
  try {
    await redis.set(`${BLOCK_PREFIX}${key}`, '1', { EX: ttlSeconds });
    await sendSecurityAlert({ type, identifier: key, reason, ttlSeconds, meta });
  } catch (err) {
    logger.error('[abuseDetection] block error:', err.message);
  }
}

async function increment(prefix, key, windowSeconds) {
  const redisKey = `${prefix}${key}`;
  try {
    const count = await redis.incr(redisKey);
    if (count === 1) await redis.expire(redisKey, windowSeconds);
    return count;
  } catch {
    return 0; // fail open
  }
}

// ── Middleware factories ──────────────────────────────────────────────────────

/**
 * Credential stuffing detection.
 * Tracks failed login attempts per IP. On threshold breach, blocks the IP.
 * Attach AFTER the auth handler; call next(err) or next() from the route,
 * then call recordFailedLogin(req) on failure.
 *
 * Usage: apply checkIpBlock to the login route, call recordFailedLogin on 401.
 */
async function checkIpBlock(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress;
  try {
    // 1. Hard block — set once the credential-stuffing threshold is breached.
    if (await isBlocked(ip)) {
      return res.status(429).json({
        success: false,
        error: 'ip_blocked',
        message: 'Too many failed attempts. Your IP has been temporarily blocked.',
      });
    }

    // 2. Soft lock — graduated escalation once repeated 401s cross the soft
    //    threshold but before the hard block. Enforced on read: it reuses the
    //    existing failed-login counter and adds no writes.
    const failures = await failedLoginCount(ip);
    if (failures >= SOFT_LOCK_THRESHOLD) {
      const retryAfter = await failedLoginTtl(ip);
      res.setHeader('Retry-After', String(retryAfter));
      return res.status(429).json({
        success: false,
        error: 'ip_soft_locked',
        message: `Too many failed login attempts. Retry after ${retryAfter} seconds.`,
      });
    }

    next();
  } catch {
    next(); // fail open — never block legitimate traffic on Redis errors
  }
}

/**
 * Records a failed login attempt for the request IP.
 * Blocks the IP if the threshold is exceeded within the window.
 *
 * @param {import('express').Request} req
 */
async function recordFailedLogin(req) {
  const ip = req.ip || req.connection.remoteAddress;
  const count = await increment(CRED_PREFIX, ip, CRED_STUFF_WINDOW_S);
  if (count >= CRED_STUFF_THRESHOLD) {
    await block(
      ip,
      CRED_STUFF_BLOCK_S,
      'CREDENTIAL_STUFFING',
      `${count} failed login attempts in ${CRED_STUFF_WINDOW_S}s`,
      { failedAttempts: count, windowSeconds: CRED_STUFF_WINDOW_S },
    );
  }
}

/**
 * Reward farming detection middleware.
 * Tracks unique campaign claims per wallet within the window.
 * Expects req.body.wallet and req.body.campaignId to be set.
 */
function checkRewardFarming(req, res, next) {
  const wallet = req.body?.wallet;
  if (!wallet) return next();

  return isBlocked(wallet).then((blocked) => {
    if (blocked) {
      return res.status(429).json({
        success: false,
        error: 'wallet_blocked',
        message: 'This wallet has been flagged for suspicious activity.',
      });
    }
    next();
  }).catch(() => next());
}

/**
 * Records a reward claim for farming detection.
 * Blocks the wallet if it claims from more than FARM_THRESHOLD campaigns in FARM_WINDOW_S.
 *
 * @param {string} wallet
 * @param {string|number} campaignId
 */
async function recordRewardClaim(wallet, campaignId) {
  if (!wallet) return;
  const redisKey = `${FARM_PREFIX}${wallet}`;
  try {
    await redis.sAdd(redisKey, String(campaignId));
    const ttl = await redis.ttl(redisKey);
    if (ttl < 0) await redis.expire(redisKey, FARM_WINDOW_S);
    const uniqueCampaigns = await redis.sCard(redisKey);
    if (uniqueCampaigns > FARM_THRESHOLD) {
      await block(
        wallet,
        FARM_BLOCK_S,
        'REWARD_FARMING',
        `Claimed from ${uniqueCampaigns} campaigns in ${FARM_WINDOW_S}s`,
        { uniqueCampaigns, windowSeconds: FARM_WINDOW_S },
      );
    }
  } catch (err) {
    logger.error('[abuseDetection] recordRewardClaim error:', err.message);
  }
}

/**
 * Manually unblocks an identifier (IP or wallet).
 * @param {string} identifier
 */
async function unblock(identifier) {
  await redis.del(`${BLOCK_PREFIX}${identifier}`);
}

module.exports = {
  checkIpBlock,
  recordFailedLogin,
  checkRewardFarming,
  recordRewardClaim,
  unblock,
  // expose for testing
  BLOCK_PREFIX,
  CRED_PREFIX,
  FARM_PREFIX,
};
