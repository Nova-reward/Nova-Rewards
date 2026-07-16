const { query } = require('./index');

/**
 * Creates a new reward issuance record (status = 'pending').
 * Returns null if the idempotency key already exists (duplicate).
 */
async function createIssuance({ idempotencyKey, campaignId, userId, walletAddress, amount }) {
  try {
    const { rows } = await query(
      `INSERT INTO reward_issuances
         (idempotency_key, campaign_id, user_id, wallet_address, amount)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [idempotencyKey, campaignId || null, userId || null, walletAddress, amount]
    );
    return rows[0];
  } catch (err) {
    if (err.code === '23505') return null; // unique_violation — duplicate key
    throw err;
  }
}

async function getIssuanceByKey(idempotencyKey) {
  const { rows } = await query(
    'SELECT * FROM reward_issuances WHERE idempotency_key = $1',
    [idempotencyKey]
  );
  return rows[0] || null;
}

async function markConfirmed(id, txHash) {
  const { rows } = await query(
    `UPDATE reward_issuances
     SET status = 'confirmed', tx_hash = $1, updated_at = NOW()
     WHERE id = $2 RETURNING *`,
    [txHash, id]
  );
  return rows[0];
}

async function markFailed(id, errorMessage) {
  const { rows } = await query(
    `UPDATE reward_issuances
     SET status = 'failed', error_message = $1, updated_at = NOW()
     WHERE id = $2 RETURNING *`,
    [errorMessage, id]
  );
  return rows[0];
}

async function incrementAttempts(id) {
  await query(
    `UPDATE reward_issuances SET attempts = attempts + 1, updated_at = NOW() WHERE id = $1`,
    [id]
  );
}

module.exports = { createIssuance, getIssuanceByKey, markConfirmed, markFailed, incrementAttempts };
