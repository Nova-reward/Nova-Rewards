const { query } = require('./index');

/**
 * Records a point transaction with balance tracking.
 *
 * Fetches the current balance inside a transaction, computes balance_before /
 * balance_after, enforces the non-negative balance invariant, then inserts the
 * row.  The DB trigger on point_transactions keeps user_balance in sync
 * automatically.
 *
 * @param {object} params
 * @param {number}  params.userId
 * @param {string}  params.type          - 'earned' | 'redeemed' | 'expired' | 'bonus' | 'referral'
 * @param {number}  params.amount        - Positive integer (sign is derived from type)
 * @param {string}  [params.description]
 * @param {number}  [params.referredUserId]
 * @param {number}  [params.campaignId]
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
  const DEBIT_TYPES = new Set(['redeemed', 'expired']);
  const intAmount = Math.round(Number(amount));

  if (!Number.isInteger(intAmount) || intAmount === 0) {
    throw Object.assign(new Error('amount must be a non-zero integer'), { status: 400 });
  }

  const client = await require('./index').pool.connect();
  try {
    await client.query('BEGIN');

    // Lock the user_balance row (or create it) to prevent race conditions
    await client.query(
      `INSERT INTO user_balance (user_id, balance) VALUES ($1, 0)
       ON CONFLICT (user_id) DO NOTHING`,
      [userId]
    );

    const { rows: balRows } = await client.query(
      'SELECT balance FROM user_balance WHERE user_id = $1 FOR UPDATE',
      [userId]
    );

    const balanceBefore = balRows[0]?.balance ?? 0;
    const delta = DEBIT_TYPES.has(type) ? -intAmount : intAmount;
    const balanceAfter = balanceBefore + delta;

    if (balanceAfter < 0) {
      throw Object.assign(
        new Error(`Insufficient balance: current ${balanceBefore}, attempted debit ${intAmount}`),
        { status: 422 }
      );
    }

    const { rows } = await client.query(
      `INSERT INTO point_transactions
         (user_id, type, amount, balance_before, balance_after, description, referred_user_id, campaign_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [userId, type, intAmount, balanceBefore, balanceAfter, description ?? null, referredUserId ?? null, campaignId ?? null]
    );

    await client.query('COMMIT');
    return rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Gets paginated point transactions for a user.
 *
 * @param {number} userId
 * @param {{ page?: number, limit?: number }} opts
 * @returns {Promise<{ data: object[], total: number, page: number, limit: number }>}
 */
async function getUserPointTransactions(userId, { page = 1, limit = 20 } = {}) {
  const offset = (page - 1) * limit;

  const { rows: countRows } = await query(
    'SELECT COUNT(*) AS total FROM point_transactions WHERE user_id = $1',
    [userId]
  );
  const total = parseInt(countRows[0].total, 10);

  const { rows } = await query(
    `SELECT pt.*, u.wallet_address AS referred_user_wallet
     FROM point_transactions pt
     LEFT JOIN users u ON pt.referred_user_id = u.id
     WHERE pt.user_id = $1
     ORDER BY pt.created_at DESC
     LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  );

  return { data: rows, total, page, limit };
}

/**
 * Returns the current balance for a user from the user_balance table.
 *
 * @param {number} userId
 * @returns {Promise<number>}
 */
async function getUserBalance(userId) {
  const { rows } = await query(
    'SELECT balance FROM user_balance WHERE user_id = $1',
    [userId]
  );
  return rows[0]?.balance ?? 0;
}

/**
 * Gets total points earned by a user (earned + referral + bonus).
 *
 * @param {number} userId
 * @returns {Promise<string>}
 */
async function getUserTotalPoints(userId) {
  const { rows } = await query(
    `SELECT COALESCE(SUM(amount), 0) AS total
     FROM point_transactions
     WHERE user_id = $1 AND type IN ('earned', 'referral', 'bonus')`,
    [userId]
  );
  return String(rows[0].total);
}

/**
 * Gets total referral points earned by a user.
 *
 * @param {number} userId
 * @returns {Promise<string>}
 */
async function getUserReferralPoints(userId) {
  const { rows } = await query(
    `SELECT COALESCE(SUM(amount), 0) AS total
     FROM point_transactions
     WHERE user_id = $1 AND type = 'referral'`,
    [userId]
  );
  return String(rows[0].total);
}

module.exports = {
  recordPointTransaction,
  getUserPointTransactions,
  getUserBalance,
  getUserTotalPoints,
  getUserReferralPoints,
};
