const { query } = require('./index');

/**
 * Records a point transaction.
 * Requirements: #181
 *
 * @param {object} params
 * @param {number} params.userId
 * @param {string} params.type - 'earned' | 'redeemed' | 'referral' | 'bonus'
 * @param {string|number} params.amount
 * @param {string} [params.description]
 * @param {number} [params.referredUserId]
 * @param {number} [params.campaignId]
 * @returns {Promise<object>} The inserted transaction row
 */
async function recordPointTransaction({
  userId,
  type,
  amount,
  description,
  referredUserId,
  campaignId,
}) {
  const result = await query(
    `INSERT INTO point_transactions
       (user_id, type, amount, description, referred_user_id, campaign_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [userId, type, amount, description, referredUserId, campaignId]
  );
  return result.rows[0];
}

/**
 * Gets all point transactions for a user.
 * Requirements: #181
 *
 * @param {number} userId
 * @param {object} params
 * @param {number} params.page
 * @param {number} params.limit
 * @returns {Promise<{data: object[], total: number, page: number, limit: number}>}
 */
async function getUserPointTransactions(userId, { page = 1, limit = 20 }) {
  const offset = (page - 1) * limit;

  // Get total count
  const countResult = await query(
    'SELECT COUNT(*) as total FROM point_transactions WHERE user_id = $1',
    [userId]
  );
  const total = parseInt(countResult.rows[0].total, 10);

  // Get paginated data
  const dataResult = await query(
    `SELECT pt.*, u.wallet_address as referred_user_wallet
     FROM point_transactions pt
     LEFT JOIN users u ON pt.referred_user_id = u.id
     WHERE pt.user_id = $1
     ORDER BY pt.created_at DESC
     LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  );

  return {
    data: dataResult.rows,
    total,
    page,
    limit,
  };
}

/**
 * Gets total points earned by a user.
 * Requirements: #181
 *
 * @param {number} userId
 * @returns {Promise<string>}
 */
async function getUserTotalPoints(userId) {
  const result = await query(
    `SELECT COALESCE(SUM(amount), 0) as total
     FROM point_transactions
     WHERE user_id = $1 AND type IN ('earned', 'referral', 'bonus')`,
    [userId]
  );
  return String(result.rows[0].total);
}

/**
 * Gets total referral points earned by a user.
 * Requirements: #181
 *
 * @param {number} userId
 * @returns {Promise<string>}
 */
async function getUserReferralPoints(userId) {
  const result = await query(
    `SELECT COALESCE(SUM(amount), 0) as total
     FROM point_transactions
     WHERE user_id = $1 AND type = 'referral'`,
    [userId]
  );
  return String(result.rows[0].total);
}

module.exports = {
  recordPointTransaction,
  getUserPointTransactions,
  getUserTotalPoints,
  getUserReferralPoints,
};
