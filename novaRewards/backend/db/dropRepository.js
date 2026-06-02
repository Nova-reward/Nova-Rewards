const { query } = require('./index');

/**
 * Returns all active, non-expired drops.
 * @returns {Promise<object[]>}
 */
async function getActiveDrops() {
  const result = await query(
    `SELECT * FROM drops WHERE is_active = TRUE AND expires_at > NOW()`,
    []
  );
  return result.rows;
}

/**
 * Returns a single drop by ID.
 * @param {number} dropId
 * @returns {Promise<object|null>}
 */
async function getDropById(dropId) {
  const result = await query('SELECT * FROM drops WHERE id = $1', [dropId]);
  return result.rows[0] || null;
}

/**
 * Counts how many times a user has claimed a specific drop.
 * @param {number} dropId
 * @param {number} userId
 * @returns {Promise<number>}
 */
async function getClaimCount(dropId, userId) {
  const result = await query(
    'SELECT COUNT(*) AS cnt FROM drop_claims WHERE drop_id = $1 AND user_id = $2',
    [dropId, userId]
  );
  return parseInt(result.rows[0].cnt, 10);
}

/**
 * Records a claim for a user on a drop.
 * @param {number} dropId
 * @param {number} userId
 * @returns {Promise<object>}
 */
async function recordClaim(dropId, userId) {
  const result = await query(
    `INSERT INTO drop_claims (drop_id, user_id) VALUES ($1, $2) RETURNING *`,
    [dropId, userId]
  );
  return result.rows[0];
}

module.exports = { getActiveDrops, getDropById, getClaimCount, recordClaim };
