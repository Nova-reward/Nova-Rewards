const { query, pool } = require('./index');
const { client: redisClient } = require('../lib/redis');

const HISTORY_SELECT = `
  SELECT t.*, c.name AS campaign_name
  FROM transactions t
  LEFT JOIN campaigns c ON t.campaign_id = c.id
`;

async function invalidateLeaderboardCache(txType) {
  if (txType !== 'distribution' || !redisClient?.del) {
    return;
  }

  await Promise.all([
    redisClient.del('leaderboard:weekly'),
    redisClient.del('leaderboard:alltime'),
  ]).catch((err) => console.error('[leaderboard] cache invalidation failed', err));
}

function buildHistoryFilters({
  userId,
  merchantId,
  type,
  status,
  startDate,
  endDate,
  reconciled,
}) {
  const conditions = [];
  const params = [];

  if (userId !== undefined && userId !== null) {
    params.push(userId);
    conditions.push(`t.user_id = $${params.length}`);
  }

  if (merchantId !== undefined && merchantId !== null) {
    params.push(merchantId);
    conditions.push(`t.merchant_id = $${params.length}`);
  }

  if (type) {
    params.push(type);
    conditions.push(`t.tx_type = $${params.length}`);
  }

  if (status) {
    params.push(status);
    conditions.push(`t.status = $${params.length}`);
  }

  if (startDate) {
    params.push(startDate);
    conditions.push(`t.created_at >= $${params.length}`);
  }

  if (endDate) {
    params.push(endDate);
    conditions.push(`t.created_at <= $${params.length}`);
  }

  if (typeof reconciled === 'boolean') {
    conditions.push(reconciled ? 't.reconciled_at IS NOT NULL' : 't.reconciled_at IS NULL');
  }

  return {
    whereClause: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
    params,
  };
}

/**
 * Records a transaction in the database.
 *
 * @param {object} params
 * @param {string} params.txHash
 * @param {string} params.txType
 * @param {string|number} params.amount
 * @param {string|null} [params.fromWallet]
 * @param {string|null} [params.toWallet]
 * @param {number|null} [params.merchantId]
 * @param {number|null} [params.campaignId]
 * @param {number|null} [params.userId]
 * @param {number|null} [params.stellarLedger]
 * @param {string} [params.status]
 * @param {string|null} [params.referenceTxHash]
 * @param {string|null} [params.refundReason]
 * @param {object} [params.metadata]
 * @returns {Promise<object>}
 */
async function recordTransaction({
  txHash,
  txType,
  amount,
  fromWallet = null,
  toWallet = null,
  merchantId = null,
  campaignId = null,
  userId = null,
  stellarLedger = null,
  status = 'completed',
  referenceTxHash = null,
  refundReason = null,
  metadata = {},
}) {
  const result = await query(
    `INSERT INTO transactions
       (
         tx_hash,
         tx_type,
         amount,
         from_wallet,
         to_wallet,
         merchant_id,
         campaign_id,
         user_id,
         stellar_ledger,
         status,
         reference_tx_hash,
         refund_reason,
         metadata
       )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb)
     RETURNING *`,
    [
      txHash,
      txType,
      amount,
      fromWallet,
      toWallet,
      merchantId,
      campaignId,
      userId,
      stellarLedger,
      status,
      referenceTxHash,
      refundReason,
      JSON.stringify(metadata || {}),
    ]
  );

  await invalidateLeaderboardCache(txType);
  return result.rows[0];
}

/**
 * Retrieves a transaction by hash.
 *
 * @param {string} txHash
 * @returns {Promise<object|null>}
 */
async function getTransactionByHash(txHash) {
  const result = await query(
    `${HISTORY_SELECT}
     WHERE t.tx_hash = $1`,
    [txHash]
  );
  return result.rows[0] || null;
}

/**
 * Returns transactions associated with a merchant.
 *
 * @param {number} merchantId
 * @param {object} [options]
 * @returns {Promise<object[]>}
 */
async function getTransactionsByMerchant(merchantId, options = {}) {
  const { whereClause, params } = buildHistoryFilters({
    merchantId,
    type: options.type,
    status: options.status,
    startDate: options.startDate,
    endDate: options.endDate,
    reconciled: options.reconciled,
  });

  const result = await query(
    `${HISTORY_SELECT}
     ${whereClause}
     ORDER BY t.created_at DESC`,
    params
  );
  return result.rows;
}

/**
 * Returns the total distributed and redeemed amounts for a merchant.
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
       AND status <> 'failed'
     GROUP BY tx_type`,
    [merchantId]
  );

  const totalsByType = result.rows.reduce((accumulator, row) => {
    accumulator[row.tx_type] = String(row.total);
    return accumulator;
  }, {});

  return {
    totalDistributed: totalsByType.distribution || '0',
    totalRedeemed: totalsByType.redemption || '0',
  };
}

/**
 * Returns paginated transactions for a user with optional filters.
 *
 * @param {number} userId
 * @param {object} params
 * @returns {Promise<{data: object[], total: number, page: number, limit: number}>}
 */
async function getTransactionsByUser(userId, params = {}) {
  return getTransactionHistory({
    userId,
    type: params.type,
    status: params.status,
    startDate: params.startDate,
    endDate: params.endDate,
    page: params.page,
    limit: params.limit,
    reconciled: params.reconciled,
  });
}

/**
 * Returns paginated transaction history for the supplied filters.
 *
 * @param {object} filters
 * @returns {Promise<{data: object[], total: number, page: number, limit: number}>}
 */
async function getTransactionHistory(filters = {}) {
  const page = filters.page || 1;
  const limit = filters.limit || 20;
  const offset = (page - 1) * limit;
  const { whereClause, params } = buildHistoryFilters(filters);

  const countResult = await query(
    `SELECT COUNT(*) AS total
     FROM transactions t
     ${whereClause}`,
    params
  );

  const dataResult = await query(
    `${HISTORY_SELECT}
     ${whereClause}
     ORDER BY t.created_at DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  );

  return {
    data: dataResult.rows,
    total: parseInt(countResult.rows[0].total, 10),
    page,
    limit,
  };
}

/**
 * Updates a transaction's lifecycle fields.
 *
 * @param {string} txHash
 * @param {object} updates
 * @returns {Promise<object|null>}
 */
async function updateTransaction(txHash, updates = {}) {
  const allowedFields = ['status', 'refund_reason', 'reference_tx_hash', 'reconciled_at', 'metadata'];
  const assignments = [];
  const params = [];

  for (const field of allowedFields) {
    if (updates[field] === undefined) {
      continue;
    }

    params.push(field === 'metadata' ? JSON.stringify(updates[field] || {}) : updates[field]);
    const valueExpression = field === 'metadata' ? `$${params.length}::jsonb` : `$${params.length}`;
    assignments.push(`${field} = ${valueExpression}`);
  }

  if (assignments.length === 0) {
    return getTransactionByHash(txHash);
  }

  params.push(txHash);
  const result = await query(
    `UPDATE transactions
     SET ${assignments.join(', ')}, updated_at = NOW()
     WHERE tx_hash = $${params.length}
     RETURNING *`,
    params
  );

  return result.rows[0] || null;
}

/**
 * Processes a full refund in a single database transaction.
 *
 * @param {object} params
 * @returns {Promise<{originalTransaction: object, refundTransaction: object}>}
 */
async function processRefund({
  txHash,
  refundTxHash,
  refundReason,
  stellarLedger = null,
  metadata = {},
}) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const existingRefundResult = await client.query(
      `${HISTORY_SELECT}
       WHERE t.tx_hash = $1`,
      [refundTxHash]
    );
    if (existingRefundResult.rows[0]) {
      const duplicateError = new Error('Refund transaction has already been recorded');
      duplicateError.status = 409;
      duplicateError.code = 'duplicate_transaction';
      throw duplicateError;
    }

    const originalResult = await client.query(
      `${HISTORY_SELECT}
       WHERE t.tx_hash = $1
       FOR UPDATE`,
      [txHash]
    );
    const originalTransaction = originalResult.rows[0] || null;

    if (!originalTransaction) {
      const missingError = new Error('Transaction not found');
      missingError.status = 404;
      missingError.code = 'not_found';
      throw missingError;
    }

    if (originalTransaction.tx_type === 'refund') {
      const invalidError = new Error('Refund transactions cannot be refunded again');
      invalidError.status = 409;
      invalidError.code = 'invalid_refund_target';
      throw invalidError;
    }

    if (originalTransaction.status === 'refunded') {
      const refundedError = new Error('Transaction has already been refunded');
      refundedError.status = 409;
      refundedError.code = 'already_refunded';
      throw refundedError;
    }

    const refundInsert = await client.query(
      `INSERT INTO transactions
         (
           tx_hash,
           tx_type,
           amount,
           from_wallet,
           to_wallet,
           merchant_id,
           campaign_id,
           user_id,
           stellar_ledger,
           status,
           reference_tx_hash,
           refund_reason,
           metadata
         )
       VALUES ($1, 'refund', $2, $3, $4, $5, $6, $7, $8, 'completed', $9, $10, $11::jsonb)
       RETURNING *`,
      [
        refundTxHash,
        originalTransaction.amount,
        originalTransaction.to_wallet,
        originalTransaction.from_wallet,
        originalTransaction.merchant_id,
        originalTransaction.campaign_id,
        originalTransaction.user_id,
        stellarLedger,
        originalTransaction.tx_hash,
        refundReason,
        JSON.stringify(metadata || {}),
      ]
    );

    const originalUpdate = await client.query(
      `UPDATE transactions
       SET status = 'refunded',
           refund_reason = $1,
           updated_at = NOW()
       WHERE tx_hash = $2
       RETURNING *`,
      [refundReason, txHash]
    );

    await client.query('COMMIT');

    await invalidateLeaderboardCache(refundInsert.rows[0].tx_type);

    return {
      originalTransaction: originalUpdate.rows[0],
      refundTransaction: refundInsert.rows[0],
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Marks matching transactions as reconciled and returns a summary.
 *
 * @param {object} filters
 * @returns {Promise<{count: number, totalAmount: string, transactions: object[]}>}
 */
async function reconcileTransactions(filters = {}) {
  const { whereClause, params } = buildHistoryFilters(filters);
  const effectiveWhere = whereClause
    ? `${whereClause} AND t.reconciled_at IS NULL`
    : 'WHERE t.reconciled_at IS NULL';

  const result = await query(
    `UPDATE transactions t
     SET reconciled_at = NOW(),
         updated_at = NOW(),
         status = CASE WHEN t.status = 'completed' THEN 'reconciled' ELSE t.status END
     ${effectiveWhere}
     RETURNING *`,
    params
  );

  const totalAmount = result.rows.reduce(
    (sum, row) => (Number(sum) + Number(row.amount)).toFixed(7),
    '0.0000000'
  );

  return {
    count: result.rows.length,
    totalAmount,
    transactions: result.rows,
  };
}

/**
 * Builds an aggregate report for the supplied filters.
 *
 * @param {object} filters
 * @returns {Promise<object>}
 */
async function getTransactionReport(filters = {}) {
  const { whereClause, params } = buildHistoryFilters(filters);
  const summaryResult = await query(
    `SELECT
       COUNT(*) AS total_transactions,
       COALESCE(SUM(amount), 0) AS total_amount,
       COALESCE(SUM(CASE WHEN tx_type = 'refund' THEN amount ELSE 0 END), 0) AS refunded_amount,
       COALESCE(SUM(CASE WHEN status = 'reconciled' THEN amount ELSE 0 END), 0) AS reconciled_amount
     FROM transactions t
     ${whereClause}`,
    params
  );

  const groupedResult = await query(
    `SELECT tx_type, status, COUNT(*) AS transaction_count, COALESCE(SUM(amount), 0) AS total_amount
     FROM transactions t
     ${whereClause}
     GROUP BY tx_type, status
     ORDER BY tx_type ASC, status ASC`,
    params
  );

  return {
    summary: summaryResult.rows[0],
    breakdown: groupedResult.rows,
  };
}

/**
 * Cursor-based rewards history for a user.
 * Cursor is the base64-encoded `created_at::id` of the last seen row.
 *
 * @param {number} userId
 * @param {{ limit?: number, cursor?: string }} opts
 * @returns {Promise<{ data: object[], nextCursor: string|null }>}
 */
async function getRewardsHistoryCursor(userId, { limit = 20, cursor } = {}) {
  const safeLimit = Math.min(Math.max(1, parseInt(limit, 10) || 20), 100);
  const params = [userId];
  let cursorClause = '';

  if (cursor) {
    try {
      const decoded = Buffer.from(cursor, 'base64').toString('utf8');
      const [ts, id] = decoded.split('::');
      params.push(ts, parseInt(id, 10));
      cursorClause = `AND (t.created_at, t.id) < ($${params.length - 1}::timestamptz, $${params.length})`;
    } catch (_) {
      // invalid cursor — ignore and start from the beginning
    }
  }

  const result = await query(
    `SELECT t.id,
            t.tx_hash,
            t.tx_type   AS action_type,
            t.amount,
            t.created_at AS timestamp,
            t.status,
            c.name       AS campaign_name,
            c.id         AS campaign_id
     FROM transactions t
     LEFT JOIN campaigns c ON t.campaign_id = c.id
     WHERE t.user_id = $1
       ${cursorClause}
     ORDER BY t.created_at DESC, t.id DESC
     LIMIT $${params.length + 1}`,
    [...params, safeLimit + 1]
  );

  const rows = result.rows;
  const hasMore = rows.length > safeLimit;
  const data = hasMore ? rows.slice(0, safeLimit) : rows;

  const nextCursor = hasMore
    ? Buffer.from(`${data[data.length - 1].timestamp}::${data[data.length - 1].id}`).toString('base64')
    : null;

  return { data, nextCursor };
}

module.exports = {
  recordTransaction,
  getTransactionByHash,
  getTransactionsByMerchant,
  getMerchantTotals,
  getTransactionsByUser,
  getTransactionHistory,
  getRewardsHistoryCursor,
  updateTransaction,
  processRefund,
  reconcileTransactions,
  getTransactionReport,
};
