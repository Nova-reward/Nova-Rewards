const { client } = require('../lib/redis');

/**
 * Service to manage Redis caching layer.
 * Requirements: #358 Caching Layer
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
      console.error(`[Cache] Error getting key=${key}`, err);
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
      console.error(`[Cache] Error setting key=${key}`, err);
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
      console.error(`[Cache] Error deleting key=${key}`, err);
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
        console.info(`[Cache] Invalidated ${keys.length} keys matching ${pattern}`);
      }
      return true;
    } catch (err) {
      console.error(`[Cache] Error invalidating pattern=${pattern}`, err);
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
