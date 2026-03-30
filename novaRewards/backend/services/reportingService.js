const { query } = require('../db/index');
const { client: redisClient } = require('../lib/redis');

const REPORT_CACHE_TTL = Number(process.env.REPORT_CACHE_TTL) || 300; // 5 min default

/**
 * Builds a Redis cache key from report type + query params.
 * @param {string} type
 * @param {object} params
 * @returns {string}
 */
function cacheKey(type, params = {}) {
  const sorted = Object.keys(params)
    .sort()
    .filter((k) => params[k] !== undefined && params[k] !== null)
    .map((k) => `${k}=${params[k]}`)
    .join('&');
  return `report:${type}${sorted ? ':' + sorted : ''}`;
}

/**
 * Wraps a report generator with Redis caching.
 * @param {string} key
 * @param {Function} generator
 * @returns {Promise<object>}
 */
async function withCache(key, generator) {
  const cached = await redisClient.get(key);
  if (cached) return JSON.parse(cached);

  const data = await generator();
  await redisClient.setEx(key, REPORT_CACHE_TTL, JSON.stringify(data));
  return data;
}

/**
 * User report: total users, new signups in range, referral counts.
 * @param {{ startDate?: string, endDate?: string }} params
 */
async function generateUserReport(params = {}) {
  const { startDate, endDate } = params;
  const conditions = ['is_deleted = FALSE'];
  const values = [];
  let i = 1;

  if (startDate) { conditions.push(`created_at >= $${i++}`); values.push(startDate); }
  if (endDate)   { conditions.push(`created_at <= $${i++}`); values.push(endDate); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const [totals, referrals] = await Promise.all([
    query(
      `SELECT COUNT(*) AS total_users,
              COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days') AS new_last_30d
       FROM users ${where}`,
      values
    ),
    query(
      `SELECT COUNT(*) AS total_referrals
       FROM users
       WHERE referred_by IS NOT NULL ${startDate ? `AND created_at >= $1` : ''} ${endDate ? `AND created_at <= $${startDate ? 2 : 1}` : ''}`,
      values
    ),
  ]);

  return {
    type: 'user',
    generatedAt: new Date().toISOString(),
    params,
    data: {
      ...totals.rows[0],
      ...referrals.rows[0],
    },
  };
}

/**
 * Campaign report: all campaigns with transaction counts and totals.
 * @param {{ merchantId?: number, startDate?: string, endDate?: string }} params
 */
async function generateCampaignReport(params = {}) {
  const { merchantId, startDate, endDate } = params;
  const conditions = [];
  const values = [];
  let i = 1;

  if (merchantId) { conditions.push(`c.merchant_id = $${i++}`); values.push(merchantId); }
  if (startDate)  { conditions.push(`c.created_at >= $${i++}`); values.push(startDate); }
  if (endDate)    { conditions.push(`c.created_at <= $${i++}`); values.push(endDate); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await query(
    `SELECT c.id, c.name, c.reward_rate, c.start_date, c.end_date, c.is_active,
            COUNT(t.id)            AS transaction_count,
            COALESCE(SUM(t.amount), 0) AS total_distributed
     FROM campaigns c
     LEFT JOIN transactions t ON t.campaign_id = c.id AND t.tx_type = 'distribution'
     ${where}
     GROUP BY c.id
     ORDER BY c.created_at DESC`,
    values
  );

  return {
    type: 'campaign',
    generatedAt: new Date().toISOString(),
    params,
    data: result.rows,
  };
}

/**
 * Transaction report: aggregated by type with optional date/merchant filters.
 * @param {{ merchantId?: number, startDate?: string, endDate?: string, txType?: string }} params
 */
async function generateTransactionReport(params = {}) {
  const { merchantId, startDate, endDate, txType } = params;
  const conditions = [];
  const values = [];
  let i = 1;

  if (merchantId) { conditions.push(`merchant_id = $${i++}`); values.push(merchantId); }
  if (startDate)  { conditions.push(`created_at >= $${i++}`); values.push(startDate); }
  if (endDate)    { conditions.push(`created_at <= $${i++}`); values.push(endDate); }
  if (txType)     { conditions.push(`tx_type = $${i++}`);     values.push(txType); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const [summary, rows] = await Promise.all([
    query(
      `SELECT tx_type,
              COUNT(*)               AS count,
              COALESCE(SUM(amount), 0) AS total_amount
       FROM transactions ${where}
       GROUP BY tx_type`,
      values
    ),
    query(
      `SELECT * FROM transactions ${where} ORDER BY created_at DESC LIMIT 500`,
      values
    ),
  ]);

  return {
    type: 'transaction',
    generatedAt: new Date().toISOString(),
    params,
    data: { summary: summary.rows, transactions: rows.rows },
  };
}

/**
 * Revenue report: total distributed vs redeemed, grouped by merchant.
 * @param {{ startDate?: string, endDate?: string }} params
 */
async function generateRevenueReport(params = {}) {
  const { startDate, endDate } = params;
  const conditions = [`tx_type IN ('distribution', 'redemption')`];
  const values = [];
  let i = 1;

  if (startDate) { conditions.push(`t.created_at >= $${i++}`); values.push(startDate); }
  if (endDate)   { conditions.push(`t.created_at <= $${i++}`); values.push(endDate); }

  const where = `WHERE ${conditions.join(' AND ')}`;

  const result = await query(
    `SELECT m.id AS merchant_id, m.name AS merchant_name,
            COALESCE(SUM(t.amount) FILTER (WHERE t.tx_type = 'distribution'), 0) AS total_distributed,
            COALESCE(SUM(t.amount) FILTER (WHERE t.tx_type = 'redemption'),   0) AS total_redeemed
     FROM transactions t
     JOIN merchants m ON t.merchant_id = m.id
     ${where}
     GROUP BY m.id, m.name
     ORDER BY total_distributed DESC`,
    values
  );

  const totals = result.rows.reduce(
    (acc, r) => {
      acc.total_distributed += parseFloat(r.total_distributed);
      acc.total_redeemed    += parseFloat(r.total_redeemed);
      return acc;
    },
    { total_distributed: 0, total_redeemed: 0 }
  );

  return {
    type: 'revenue',
    generatedAt: new Date().toISOString(),
    params,
    data: { byMerchant: result.rows, totals },
  };
}

const GENERATORS = {
  user:        generateUserReport,
  campaign:    generateCampaignReport,
  transaction: generateTransactionReport,
  revenue:     generateRevenueReport,
};

/**
 * Generates (or returns cached) a report by type.
 * @param {string} type - 'user' | 'campaign' | 'transaction' | 'revenue'
 * @param {object} params
 * @returns {Promise<object>}
 */
async function getReport(type, params = {}) {
  const generator = GENERATORS[type];
  if (!generator) throw Object.assign(new Error(`Unknown report type: ${type}`), { status: 400 });
  return withCache(cacheKey(type, params), () => generator(params));
}

module.exports = { getReport, cacheKey, REPORT_CACHE_TTL };
