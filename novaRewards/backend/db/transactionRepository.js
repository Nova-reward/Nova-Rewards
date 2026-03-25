const { query } = require('./index');

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
 * @returns {Promise<{ totalDistributed: number, totalRedeemed: number }>}
 */
async function getMerchantTotals(merchantId) {
  const result = await query(
    `SELECT
       COALESCE(SUM(CASE WHEN tx_type = 'distribution' THEN amount ELSE 0 END), 0) AS "totalDistributed",
       COALESCE(SUM(CASE WHEN tx_type = 'redemption'   THEN amount ELSE 0 END), 0) AS "totalRedeemed"
     FROM transactions
     WHERE merchant_id = $1`,
    [merchantId]
  );
  return {
    totalDistributed: parseFloat(result.rows[0].totalDistributed),
    totalRedeemed: parseFloat(result.rows[0].totalRedeemed),
  };
}

module.exports = {
  recordTransaction,
  getTransactionByHash,
  getTransactionsByMerchant,
  getMerchantTotals,
};
