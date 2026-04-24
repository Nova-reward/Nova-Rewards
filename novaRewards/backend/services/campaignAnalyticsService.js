'use strict';
const {
  getCampaignKPIs,
  getCampaignTimeSeries,
  getCampaignAnalyticsForExport,
} = require('../db/campaignAnalyticsRepository');
const { client: redisClient } = require('../lib/redis');

/** Cache TTL in seconds (5 minutes, matching reportingService). */
const ANALYTICS_CACHE_TTL = Number(process.env.ANALYTICS_CACHE_TTL) || 300;

const VALID_GRANULARITIES = ['daily', 'weekly', 'monthly'];

/**
 * Builds a deterministic Redis key for campaign analytics.
 * @param {number} campaignId
 * @param {object} params
 * @returns {string}
 */
function buildCacheKey(campaignId, params = {}) {
  const parts = Object.keys(params)
    .sort()
    .filter((k) => params[k] !== undefined && params[k] !== null && params[k] !== '')
    .map((k) => `${k}=${params[k]}`);
  return `analytics:campaign:${campaignId}${parts.length ? ':' + parts.join(':') : ''}`;
}

/**
 * Wraps a data-fetching function with Redis caching.
 * Gracefully falls through to the generator if Redis is unavailable.
 *
 * @param {string} key
 * @param {Function} generator
 * @returns {Promise<any>}
 */
async function withCache(key, generator) {
  try {
    const cached = await redisClient.get(key);
    if (cached) return JSON.parse(cached);
  } catch (_) {
    // Redis unavailable — fall through to DB
  }

  const data = await generator();

  try {
    await redisClient.setEx(key, ANALYTICS_CACHE_TTL, JSON.stringify(data));
  } catch (_) {
    // Non-fatal: cache write failure
  }

  return data;
}

/**
 * Validates and normalises query parameters for analytics endpoints.
 *
 * @param {object} query - Express req.query
 * @returns {{ valid: boolean, errors: string[], params: object }}
 */
function parseAnalyticsParams(query) {
  const errors = [];
  const { startDate, endDate, granularity = 'daily' } = query;

  if (startDate && isNaN(Date.parse(startDate))) {
    errors.push('startDate must be a valid ISO date (e.g. 2025-01-01)');
  }
  if (endDate && isNaN(Date.parse(endDate))) {
    errors.push('endDate must be a valid ISO date (e.g. 2025-12-31)');
  }
  if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
    errors.push('startDate must be before endDate');
  }
  if (!VALID_GRANULARITIES.includes(granularity)) {
    errors.push(`granularity must be one of: ${VALID_GRANULARITIES.join(', ')}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    params: { startDate, endDate, granularity },
  };
}

/**
 * Returns full analytics payload for a campaign (KPIs + time-series).
 * Result is cached in Redis.
 *
 * @param {number} campaignId
 * @param {object} params - { startDate, endDate, granularity }
 * @returns {Promise<object>}
 */
async function getCampaignAnalytics(campaignId, params = {}) {
  const key = buildCacheKey(campaignId, params);

  return withCache(key, async () => {
    const [kpis, timeSeries] = await Promise.all([
      getCampaignKPIs(campaignId, params),
      getCampaignTimeSeries(campaignId, params),
    ]);

    return {
      campaignId,
      generatedAt: new Date().toISOString(),
      params,
      kpis: {
        total_issued:     Number(kpis.total_issued),
        total_redeemed:   Number(kpis.total_redeemed),
        unique_users:     Number(kpis.unique_users),
        avg_reward_value: parseFloat(Number(kpis.avg_reward_value).toFixed(4)),
        redemption_rate:  parseFloat(Number(kpis.redemption_rate).toFixed(2)),
      },
      timeSeries: timeSeries.map((row) => ({
        period:       row.period,
        issued:       Number(row.issued),
        redeemed:     Number(row.redeemed),
        active_users: Number(row.active_users),
      })),
    };
  });
}

/**
 * Returns a flat array of rows for CSV export.
 *
 * @param {number} campaignId
 * @param {object} params - { startDate, endDate, granularity }
 * @returns {Promise<object[]>}
 */
async function getCampaignAnalyticsExportRows(campaignId, params = {}) {
  return getCampaignAnalyticsForExport(campaignId, params);
}

module.exports = {
  getCampaignAnalytics,
  getCampaignAnalyticsExportRows,
  parseAnalyticsParams,
  buildCacheKey,
  ANALYTICS_CACHE_TTL,
};
