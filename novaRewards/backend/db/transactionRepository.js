const { query } = require('./index');
const { client: redisClient } = require('../lib/redis');

/**
 * Records a completed Stellar transaction in the database.
 * Requirements: 3.4, 4.3, 5.4
 *
 * @param {object} params
 * @param {string} params.txHash
 * @param {string} params.txType        - 'distribution' | 'redemption' | 'transfer'
 * @param {string|number} params.amount
 * @param {string} [params.fromWallet]
 * @param {string} [params.toWallet]
 * @param {number} [params.merchantId]
 * @param {number} [params.campaignId]
 * @param {number} [params.stellarLedger]
 * @returns {Promise<object>} The inserted transaction row
 */
async function recordTransaction({
  txHash,
  txType,
  amount,
  fromWallet,
  toWallet,
  merchantId,
  campaignId,
  stellarLedger,
}) {
  const nullableCampaignId = campaignId ?? null;

  const result = await query(
    `INSERT INTO transactions
       (tx_hash, tx_type, amount, from_wallet, to_wallet, merchant_id, campaign_id, stellar_ledger)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [txHash, txType, amount, fromWallet, toWallet, merchantId, nullableCampaignId, stellarLedger]
  );

  // Invalidate leaderboard cache when a reward is earned (distribution maps to 'earned')
  if (txType === 'distribution') {
    await Promise.all([
      redisClient.del('leaderboard:weekly'),
      redisClient.del('leaderboard:alltime'),
    ]).catch((err) => console.error('[leaderboard] cache invalidation failed', err));
  }

  return result.rows[0];
}

/**
 * Retrieves a transaction record by its Stellar transaction hash.
 * Requirements: 3.4, 4.3, 5.4
 *
 * @param {string} txHash
 * @returns {Promise<object|null>}
 */
async function getTransactionByHash(txHash) {
  const result = await query(
    'SELECT * FROM transactions WHERE tx_hash = $1',
    [txHash]
  );
  return result.rows[0] || null;
}

/**
 * Returns all transactions associated with a given merchant.
 * Requirements: 6.2, 10.1
 *
 * @param {number} merchantId
 * @returns {Promise<object[]>}
 */
async function getTransactionsByMerchant(merchantId) {
  const result = await query(
    'SELECT * FROM transactions WHERE merchant_id = $1 ORDER BY created_at DESC',
    [merchantId]
  );
  return result.rows;
}

/**
 * Returns the total NOVA distributed and redeemed for a merchant.
 * Requirements: 10.2
 *
 * @param {number} merchantId
 * @returns {Promise<{ totalDistributed: string, totalRedeemed: string }>}
 */
async function getMerchantTotals(merchantId) {
  const result = await query(
    `SELECT tx_type, COALESCE(SUM(amount), 0) AS total
     FROM transactions
     WHERE merchant_id = $1
       AND tx_type IN ('distribution', 'redemption')
     GROUP BY tx_type`,
    [merchantId]
  );

  const totalsByType = result.rows.reduce((acc, row) => {
    acc[row.tx_type] = String(row.total);
    return acc;
  }, {});

  return {
    totalDistributed: totalsByType.distribution || '0',
    totalRedeemed: totalsByType.redemption || '0',
  };
}

/**
 * Returns paginated transactions for a user with optional filtering.
 * Requirements: #180
 *
 * @param {number} userId
 * @param {object} params
 * @param {string} [params.type] - Filter by transaction type
 * @param {string} [params.startDate] - ISO date string
 * @param {string} [params.endDate] - ISO date string
 * @param {number} params.page
 * @param {number} params.limit
 * @returns {Promise<{data: object[], total: number, page: number, limit: number}>}
 */
async function getTransactionsByUser(userId, { type, startDate, endDate, page = 1, limit = 20 }) {
  const offset = (page - 1) * limit;
  const conditions = ['t.user_id = $1'];
  const params = [userId];
  let paramIndex = 2;

  if (type) {
    conditions.push(`t.tx_type = $${paramIndex++}`);
    params.push(type);
  }

  if (startDate) {
    conditions.push(`t.created_at >= $${paramIndex++}`);
    params.push(new Date(startDate));
  }

  if (endDate) {
    conditions.push(`t.created_at <= $${paramIndex++}`);
    params.push(new Date(endDate));
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;

  // Get total count
  const countResult = await query(
    `SELECT COUNT(*) as total FROM transactions t ${whereClause}`,
    params
  );
  const total = parseInt(countResult.rows[0].total, 10);

  // Get paginated data with campaign name (no N+1 query)
  const dataResult = await query(
    `SELECT t.*, c.name as campaign_name
     FROM transactions t
     LEFT JOIN campaigns c ON t.campaign_id = c.id
     ${whereClause}
     ORDER BY t.created_at DESC
     LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
    [...params, limit, offset]
  );

  return {
    data: dataResult.rows,
    total,
    page,
    limit,
  };
}

module.exports = {
  recordTransaction,
  getTransactionByHash,
  getTransactionsByMerchant,
  getMerchantTotals,
  getTransactionsByUser,
};
