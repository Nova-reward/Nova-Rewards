const logger = require('../lib/logger');
const { client } = require('../lib/redis');
const { getUserByWallet } = require('../db/userRepository');

/**
 * Service to manage Redis caching layer.
 * Requirements: #358 Caching Layer
 *
 * ---------------------------------------------------------------------------
 * BALANCE MUTATION → CACHE INVALIDATION MAP
 * ---------------------------------------------------------------------------
 * Every service/method that mutates a user's NOVA balance or off-chain points
 * MUST call the corresponding cache invalidation below after a successful mutation.
 *
 * | # | Mutation Path | Service / Route | Method | Cache Key(s) Invalidated | Invalidation Call |
 *|---|---------------|-----------------|--------|---------------------------|-------------------|
 * | 1 | Direct Stellar tx submission | walletService | submitTransaction() | tokenBalance:${userId}, balance:${userId} | invalidateBalanceCache(sourceWallet, destWallet) |
 * | 2 | Direct reward distribution | routes/rewards.js | POST /distribute | tokenBalance:${userId}, balance:${userId} | invalidateBalanceCache(recipientWallet) |
 * | 3 | Reward issuance (BullMQ) | rewardIssuanceService | processRewardIssuance() | tokenBalance:${userId}, balance:${userId} | invalidateBalanceCache(walletAddress) |
 * | 4 | Campaign batch distribution | campaignDistributionService | processCampaignDistribution() | tokenBalance:${userId}, balance:${userId} | invalidateBalanceCache(walletAddress) per recipient |
 * | 5 | Referral bonus | referralService | processReferralBonus() | balance:${userId} | invalidateUserBalance(referrerId) |
 * | 6 | Refund transaction | transactionService | refundTransaction() | balance:${userId} | invalidateUserBalance(userId) for both wallets |
 * ---------------------------------------------------------------------------
 */
class CacheService {
  constructor() {
    this.client = client;
    this.DEFAULT_TTL = 3600; // 1 hour default
  }

  /**
   * Get a cached value by key.
   */
  async get(key) {
    try {
      const value = await this.client.get(key);
      return value ? JSON.parse(value) : null;
    } catch (err) {
      logger.error(`[Cache] Error getting key=${key}`, err);
      return null;
    }
  }

  /**
   * Set a cached value with TTL.
   */
  async set(key, value, ttl = this.DEFAULT_TTL) {
    try {
      await this.client.setEx(key, ttl, JSON.stringify(value));
      return true;
    } catch (err) {
      logger.error(`[Cache] Error setting key=${key}`, err);
      return false;
    }
  }

  /**
   * Invalidate a specific key.
   */
  async del(key) {
    try {
      await this.client.del(key);
      return true;
    } catch (err) {
      logger.error(`[Cache] Error deleting key=${key}`, err);
      return false;
    }
  }

  /**
   * Force invalidate by pattern (e.g., 'user:*').
   * Warning: keys() can be slow on large datasets, use with caution.
   */
  async invalidatePattern(pattern) {
    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(keys);
        logger.info(`[Cache] Invalidated ${keys.length} keys matching ${pattern}`);
      }
      return true;
    } catch (err) {
      logger.error(`[Cache] Error invalidating pattern=${pattern}`, err);
      return false;
    }
  }

  /**
   * Invalidate all balance-related cache entries for a wallet address.
   * Looks up the userId from the wallet address and deletes both the
   * user-based keys (balance:${userId}, tokenBalance:${userId}) and
   * the wallet-based keys (wallet:balance:${walletAddress}, wallet:tokenBalance:${walletAddress}).
   *
   * @param {string} walletAddress - Stellar public key
   * @param {number} [userId] - Optional user ID to skip DB lookup
   * @returns {Promise<boolean>}
   */
  async invalidateBalanceCache(walletAddress, userId) {
    if (!walletAddress) return false;

    try {
      const resolvedUserId = userId || (await getUserByWallet(walletAddress))?.id;
      const keysToDelete = [
        `wallet:balance:${walletAddress}`,
        `wallet:tokenBalance:${walletAddress}`,
      ];

      if (resolvedUserId) {
        keysToDelete.push(`balance:${resolvedUserId}`, `tokenBalance:${resolvedUserId}`);
      }

      await this.client.del(keysToDelete);
      logger.info(`[Cache] Invalidated balance cache for wallet=${walletAddress} userId=${resolvedUserId || 'unknown'}`);
      return true;
    } catch (err) {
      logger.error(`[Cache] Error invalidating balance cache for wallet=${walletAddress}`, err);
      return false;
    }
  }

  /**
   * Invalidate balance cache for a user ID only (no wallet address known).
   * @param {number} userId
   * @returns {Promise<boolean>}
   */
  async invalidateUserBalance(userId) {
    if (!userId) return false;
    try {
      await this.client.del([`balance:${userId}`, `tokenBalance:${userId}`]);
      logger.info(`[Cache] Invalidated user balance cache for userId=${userId}`);
      return true;
    } catch (err) {
      logger.error(`[Cache] Error invalidating user balance cache for userId=${userId}`, err);
      return false;
    }
  }

  /**
   * Track / monitor cache health.
   */
  async getHealth() {
    try {
      const startTime = Date.now();
      await this.client.ping();
      const latency = Date.now() - startTime;
      
      const info = await this.client.info('memory');
      const usedMemory = info.match(/used_memory_human:(.*)/)?.[1] || 'unknown';

      return {
        status: 'healthy',
        latencyMs: latency,
        usedMemory,
      };
    } catch (err) {
      return {
        status: 'unhealthy',
        error: err.message,
      };
    }
  }
}

module.exports = new CacheService();