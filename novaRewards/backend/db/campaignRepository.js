const { query } = require('./index');

/**
 * Validates campaign input fields before creation.
 * Requirements: 7.3
 */
function validateCampaign({ rewardRate, startDate, endDate }) {
  const errors = [];

  if (rewardRate === undefined || rewardRate === null || isNaN(Number(rewardRate))) {
    errors.push('rewardRate must be a number');
  } else if (Number(rewardRate) <= 0) {
    errors.push('rewardRate must be greater than 0');
  }

  if (!startDate || !endDate) {
    errors.push('startDate and endDate are required');
  } else {
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      errors.push('startDate and endDate must be valid dates');
    } else if (end <= start) {
      errors.push('endDate must be strictly after startDate');
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Creates a new campaign row (on_chain_status defaults to 'pending').
 * Requirements: 7.2
 */
async function createCampaign({ merchantId, name, rewardRate, startDate, endDate }) {
  const result = await query(
    `INSERT INTO campaigns (merchant_id, name, reward_rate, start_date, end_date)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [merchantId, name, rewardRate, startDate, endDate]
  );
  return result.rows[0];
}

/**
 * Stamps the on-chain fields after a successful Soroban transaction.
 */
async function confirmOnChain({ id, contractCampaignId, txHash }) {
  const result = await query(
    `UPDATE campaigns
     SET contract_campaign_id = $1,
         tx_hash              = $2,
         on_chain_status      = 'confirmed'
     WHERE id = $3
     RETURNING *`,
    [contractCampaignId, txHash, id]
  );
  return result.rows[0];
}

/**
 * Marks a campaign as on-chain failed (used for rollback).
 */
async function markOnChainFailed(id) {
  await query(
    `UPDATE campaigns SET on_chain_status = 'failed' WHERE id = $1`,
    [id]
  );
}

/**
 * Returns a single campaign by id, excluding soft-deleted rows.
 */
async function getCampaignById(campaignId) {
  const result = await query(
    'SELECT * FROM campaigns WHERE id = $1 AND deleted_at IS NULL',
    [campaignId]
  );
  return result.rows[0] || null;
}

/**
 * Returns all non-deleted campaigns for a merchant.
 */
async function getCampaignsByMerchant(merchantId) {
  const result = await query(
    `SELECT * FROM campaigns
     WHERE merchant_id = $1 AND deleted_at IS NULL
     ORDER BY created_at DESC`,
    [merchantId]
  );
  return result.rows;
}

/**
 * Returns a campaign only if it is active and not expired.
 * Requirements: 7.4, 7.5
 */
async function getActiveCampaign(campaignId) {
  const result = await query(
    `SELECT * FROM campaigns
     WHERE id = $1
       AND is_active = TRUE
       AND end_date >= CURRENT_DATE
       AND deleted_at IS NULL`,
    [campaignId]
  );
  return result.rows[0] || null;
}

/**
 * Updates mutable campaign fields and refreshes on-chain tracking columns.
 *
 * @param {number} id
 * @param {{ name?: string, rewardRate?: number, txHash?: string }} fields
 */
async function updateCampaign(id, { name, rewardRate, txHash }) {
  const setClauses = [];
  const values = [];
  let idx = 1;

  if (name !== undefined) {
    setClauses.push(`name = $${idx++}`);
    values.push(name);
  }
  if (rewardRate !== undefined) {
    setClauses.push(`reward_rate = $${idx++}`);
    values.push(rewardRate);
  }
  if (txHash !== undefined) {
    setClauses.push(`tx_hash = $${idx++}`);
    values.push(txHash);
    setClauses.push(`on_chain_status = 'confirmed'`);
  }

  if (setClauses.length === 0) return getCampaignById(id);

  values.push(id);
  const result = await query(
    `UPDATE campaigns SET ${setClauses.join(', ')} WHERE id = $${idx} AND deleted_at IS NULL RETURNING *`,
    values
  );
  return result.rows[0] || null;
}

/**
 * Soft-deletes a campaign and records the final tx_hash from the pause call.
 *
 * @param {number} id
 * @param {string} txHash
 */
async function softDeleteCampaign(id, txHash) {
  const result = await query(
    `UPDATE campaigns
     SET deleted_at      = NOW(),
         is_active       = FALSE,
         tx_hash         = $1,
         on_chain_status = 'confirmed'
     WHERE id = $2 AND deleted_at IS NULL
     RETURNING *`,
    [txHash, id]
  );
  return result.rows[0] || null;
}

module.exports = {
  validateCampaign,
  createCampaign,
  confirmOnChain,
  markOnChainFailed,
  getCampaignById,
  getCampaignsByMerchant,
  getActiveCampaign,
  updateCampaign,
  softDeleteCampaign,
};
