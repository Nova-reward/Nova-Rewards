const { query } = require('./index');

/**
 * Validates campaign input fields before creation.
 * Requirements: 7.3
 *
 * @param {object} params
 * @param {number|string} params.rewardRate
 * @param {string} params.startDate  - ISO date string e.g. "2025-01-01"
 * @param {string} params.endDate    - ISO date string e.g. "2025-12-31"
 * @returns {{ valid: boolean, errors: string[] }}
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
 * Creates a new reward campaign in the database.
 * Requirements: 7.2
 *
 * @param {object} params
 * @param {number} params.merchantId
 * @param {string} params.name
 * @param {number|string} params.rewardRate
 * @param {string} params.startDate
 * @param {string} params.endDate
 * @returns {Promise<object>} The created campaign row
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
 * Returns all campaigns for a given merchant.
 * Requirements: 7.2, 10.1
 *
 * @param {number} merchantId
 * @returns {Promise<object[]>}
 */
async function getCampaignsByMerchant(merchantId) {
  const result = await query(
    'SELECT * FROM campaigns WHERE merchant_id = $1 ORDER BY created_at DESC',
    [merchantId]
  );
  return result.rows;
}

/**
 * Returns a campaign by id regardless of active/expired state.
 *
 * @param {number} campaignId
 * @returns {Promise<object|null>}
 */
async function getCampaignById(campaignId) {
  const result = await query(
    'SELECT * FROM campaigns WHERE id = $1',
    [campaignId]
  );
  return result.rows[0] || null;
}

/**
 * Returns a campaign only if it is active and not expired.
 * Requirements: 7.4, 7.5
 *
 * @param {number} campaignId
 * @returns {Promise<object|null>} Campaign row or null if inactive/expired
 */
async function getActiveCampaign(campaignId) {
  const result = await query(
    `SELECT * FROM campaigns
     WHERE id = $1
       AND is_active = TRUE
       AND end_date >= CURRENT_DATE`,
    [campaignId]
  );
  return result.rows[0] || null;
}

module.exports = {
  validateCampaign,
  createCampaign,
  getCampaignsByMerchant,
  getCampaignById,
  getActiveCampaign,
};
