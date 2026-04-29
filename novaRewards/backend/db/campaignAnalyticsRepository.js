'use strict';
const { query } = require('./index');

/**
 * Builds a date-truncation expression for the given granularity.
 * @param {'daily'|'weekly'|'monthly'} granularity
 * @param {string} column - SQL column reference
 * @returns {string}
 */
function dateTrunc(granularity, column) {
  const map = { daily: 'day', weekly: 'week', monthly: 'month' };
  const unit = map[granularity] || 'day';
  return `DATE_TRUNC('${unit}', ${column})`;
}

/**
 * Returns top-level KPI aggregates for a campaign.
 *
 * Metrics:
 *   - total_issued      : sum of 'earned' point transactions
 *   - total_redeemed    : sum of 'redeemed' point transactions
 *   - unique_users      : distinct users who earned points
 *   - avg_reward_value  : average earned transaction amount
 *   - redemption_rate   : total_redeemed / total_issued (0 if no issuances)
 *
 * Uses the index on point_transactions(campaign_id, created_at) for speed.
 *
 * @param {number} campaignId
 * @param {{ startDate?: string, endDate?: string }} [dateRange]
 * @returns {Promise<object>}
 */
async function getCampaignKPIs(campaignId, { startDate, endDate } = {}) {
  const values = [campaignId];
  let i = 2;
  const dateConds = [];

  if (startDate) { dateConds.push(`created_at >= $${i++}`); values.push(startDate); }
  if (endDate)   { dateConds.push(`created_at <= $${i++}`); values.push(endDate); }

  const dateWhere = dateConds.length ? `AND ${dateConds.join(' AND ')}` : '';

  const result = await query(
    `SELECT
       COALESCE(SUM(amount) FILTER (WHERE type = 'earned'),   0)::bigint   AS total_issued,
       COALESCE(SUM(amount) FILTER (WHERE type = 'redeemed'), 0)::bigint   AS total_redeemed,
       COUNT(DISTINCT user_id)                                              AS unique_users,
       COALESCE(AVG(amount)  FILTER (WHERE type = 'earned'),  0)::numeric  AS avg_reward_value,
       CASE
         WHEN SUM(amount) FILTER (WHERE type = 'earned') > 0
         THEN ROUND(
           SUM(amount) FILTER (WHERE type = 'redeemed')::numeric /
           SUM(amount) FILTER (WHERE type = 'earned')::numeric * 100, 2
         )
         ELSE 0
       END AS redemption_rate
     FROM point_transactions
     WHERE campaign_id = $1
       ${dateWhere}`,
    values
  );

  return result.rows[0];
}

/**
 * Returns time-series data for a campaign, bucketed by granularity.
 *
 * Each row contains:
 *   - period            : truncated timestamp
 *   - issued            : points earned in that period
 *   - redeemed          : points redeemed in that period
 *   - active_users      : distinct users active in that period
 *
 * @param {number} campaignId
 * @param {{ startDate?: string, endDate?: string, granularity?: 'daily'|'weekly'|'monthly' }} [opts]
 * @returns {Promise<object[]>}
 */
async function getCampaignTimeSeries(campaignId, { startDate, endDate, granularity = 'daily' } = {}) {
  const values = [campaignId];
  let i = 2;
  const dateConds = [];

  if (startDate) { dateConds.push(`created_at >= $${i++}`); values.push(startDate); }
  if (endDate)   { dateConds.push(`created_at <= $${i++}`); values.push(endDate); }

  const dateWhere = dateConds.length ? `AND ${dateConds.join(' AND ')}` : '';
  const bucket = dateTrunc(granularity, 'created_at');

  const result = await query(
    `SELECT
       ${bucket}                                                            AS period,
       COALESCE(SUM(amount) FILTER (WHERE type = 'earned'),   0)::bigint   AS issued,
       COALESCE(SUM(amount) FILTER (WHERE type = 'redeemed'), 0)::bigint   AS redeemed,
       COUNT(DISTINCT user_id)                                              AS active_users
     FROM point_transactions
     WHERE campaign_id = $1
       ${dateWhere}
     GROUP BY ${bucket}
     ORDER BY ${bucket} ASC`,
    values
  );

  return result.rows;
}

/**
 * Returns a flat row array suitable for CSV export.
 * Combines KPIs + time-series into one exportable structure.
 *
 * @param {number} campaignId
 * @param {{ startDate?: string, endDate?: string, granularity?: string }} [opts]
 * @returns {Promise<object[]>}
 */
async function getCampaignAnalyticsForExport(campaignId, opts = {}) {
  const [kpis, timeSeries] = await Promise.all([
    getCampaignKPIs(campaignId, opts),
    getCampaignTimeSeries(campaignId, opts),
  ]);

  // Flatten: one row per time-series bucket, with KPI columns repeated for context
  return timeSeries.map((row) => ({
    campaign_id:      campaignId,
    period:           row.period,
    issued:           row.issued,
    redeemed:         row.redeemed,
    active_users:     row.active_users,
    total_issued:     kpis.total_issued,
    total_redeemed:   kpis.total_redeemed,
    unique_users:     kpis.unique_users,
    avg_reward_value: kpis.avg_reward_value,
    redemption_rate:  kpis.redemption_rate,
  }));
}

module.exports = { getCampaignKPIs, getCampaignTimeSeries, getCampaignAnalyticsForExport };
