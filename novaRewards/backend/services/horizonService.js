'use strict';

const { Horizon } = require('stellar-sdk');
const { getRedisClient } = require('../cache/redisClient');

const DEFAULT_TTL = {
  balance: parseInt(process.env.HORIZON_CACHE_TTL_BALANCE, 10) || 30,
  transactions: parseInt(process.env.HORIZON_CACHE_TTL_TX, 10) || 60,
  operations: parseInt(process.env.HORIZON_CACHE_TTL_OPS, 10) || 60,
};

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 500;

/**
 * Executes fn with exponential backoff on 429 responses.
 * @param {Function} fn - async function to retry
 * @returns {Promise<*>}
 */
async function withRetry(fn) {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const is429 = err?.response?.status === 429 || err?.status === 429;
      if (!is429 || attempt === MAX_RETRIES) throw err;
      const delay = BASE_DELAY_MS * 2 ** attempt;
      await new Promise((res) => setTimeout(res, delay));
    }
  }
}

class HorizonService {
  constructor(horizonUrl) {
    this.server = new Horizon.Server(
      horizonUrl || process.env.HORIZON_URL || 'https://horizon-testnet.stellar.org'
    );
  }

  /**
   * Returns cached value or fetches fresh data, caching the result.
   * Falls back to fetching if Redis is unavailable.
   */
  async _cached(key, ttl, fetchFn) {
    const redis = getRedisClient();
    if (redis) {
      const cached = await redis.get(key);
      if (cached) return JSON.parse(cached);
    }
    const data = await withRetry(fetchFn);
    if (redis) await redis.set(key, JSON.stringify(data), 'EX', ttl);
    return data;
  }

  /**
   * Fetches all balances for a Stellar account.
   * @param {string} accountId - Stellar public key
   * @returns {Promise<Array>} balances array
   */
  async getAccountBalance(accountId) {
    return this._cached(
      `horizon:balance:${accountId}`,
      DEFAULT_TTL.balance,
      async () => {
        const account = await this.server.loadAccount(accountId);
        return account.balances;
      }
    );
  }

  /**
   * Fetches transaction history for a Stellar account.
   * @param {string} accountId - Stellar public key
   * @param {object} [opts] - { limit, cursor, order }
   * @returns {Promise<Array>} transactions array
   */
  async getTransactionHistory(accountId, opts = {}) {
    const { limit = 10, cursor, order = 'desc' } = opts;
    const cacheKey = `horizon:tx:${accountId}:${limit}:${cursor || ''}:${order}`;
    return this._cached(
      cacheKey,
      DEFAULT_TTL.transactions,
      async () => {
        let builder = this.server
          .transactions()
          .forAccount(accountId)
          .limit(limit)
          .order(order);
        if (cursor) builder = builder.cursor(cursor);
        const result = await builder.call();
        return result.records;
      }
    );
  }

  /**
   * Fetches operations for a Stellar account.
   * @param {string} accountId - Stellar public key
   * @param {object} [opts] - { limit, cursor, order }
   * @returns {Promise<Array>} operations array
   */
  async getOperations(accountId, opts = {}) {
    const { limit = 10, cursor, order = 'desc' } = opts;
    const cacheKey = `horizon:ops:${accountId}:${limit}:${cursor || ''}:${order}`;
    return this._cached(
      cacheKey,
      DEFAULT_TTL.operations,
      async () => {
        let builder = this.server
          .operations()
          .forAccount(accountId)
          .limit(limit)
          .order(order);
        if (cursor) builder = builder.cursor(cursor);
        const result = await builder.call();
        return result.records;
      }
    );
  }
}

module.exports = new HorizonService();
module.exports.HorizonService = HorizonService;
