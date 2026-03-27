const { query } = require('./index');

/**
 * Finds a user by their wallet address.
 * Requirements: #181
 *
 * @param {string} walletAddress
 * @returns {Promise<object|null>}
 */
async function getUserByWallet(walletAddress) {
  const result = await query(
    'SELECT * FROM users WHERE wallet_address = $1',
    [walletAddress]
  );
  return result.rows[0] || null;
}

/**
 * Finds a user by their ID.
 * Requirements: #181
 *
 * @param {number} userId
 * @returns {Promise<object|null>}
 */
async function getUserById(userId) {
  const result = await query(
    'SELECT * FROM users WHERE id = $1',
    [userId]
  );
  return result.rows[0] || null;
}

/**
 * Creates a new user with optional referral tracking.
 * Requirements: #181
 *
 * @param {object} params
 * @param {string} params.walletAddress
 * @param {number} [params.referredBy]
 * @returns {Promise<object>} The created user row
 */
async function createUser({ walletAddress, referredBy = null }) {
  const result = await query(
    `INSERT INTO users (wallet_address, referred_by, referred_at)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [walletAddress, referredBy, referredBy ? new Date() : null]
  );
  return result.rows[0];
}

/**
 * Marks a user's referral bonus as claimed.
 * Requirements: #181
 *
 * @param {number} userId
 * @returns {Promise<object>}
 */
async function markReferralBonusClaimed(userId) {
  const result = await query(
    `UPDATE users 
     SET referral_bonus_claimed = TRUE
     WHERE id = $1
     RETURNING *`,
    [userId]
  );
  return result.rows[0];
}

/**
 * Gets all users referred by a specific user.
 * Requirements: #181
 *
 * @param {number} referrerId
 * @returns {Promise<object[]>}
 */
async function getReferredUsers(referrerId) {
  const result = await query(
    `SELECT id, wallet_address, referred_at, referral_bonus_claimed
     FROM users
     WHERE referred_by = $1
     ORDER BY referred_at DESC`,
    [referrerId]
  );
  return result.rows;
}

/**
 * Gets total points earned from referrals for a user.
 * Requirements: #181
 *
 * @param {number} referrerId
 * @returns {Promise<string>}
 */
async function getReferralPointsEarned(referrerId) {
  const result = await query(
    `SELECT COALESCE(SUM(amount), 0) AS total
     FROM point_transactions
     WHERE user_id = $1 AND type = 'referral'`,
    [referrerId]
  );
  return String(result.rows[0].total);
}

/**
 * Checks if a user has already received a referral bonus for a specific referred user.
 * Requirements: #181
 *
 * @param {number} referrerId
 * @param {number} referredUserId
 * @returns {Promise<boolean>}
 */
async function hasReferralBonusBeenClaimed(referrerId, referredUserId) {
  const result = await query(
    `SELECT id FROM point_transactions
     WHERE user_id = $1 AND type = 'referral' AND referred_user_id = $2`,
    [referrerId, referredUserId]
  );
  return result.rows.length > 0;
}

/**
 * Gets users who signed up with referral but haven't had bonus credited.
 * Requirements: #181
 *
 * @param {number} hoursAgo - Number of hours to look back
 * @returns {Promise<object[]>}
 */
async function getUnprocessedReferrals(hoursAgo = 24) {
  const result = await query(
    `SELECT u.id, u.wallet_address, u.referred_by, u.referred_at
     FROM users u
     WHERE u.referred_by IS NOT NULL
       AND u.referral_bonus_claimed = FALSE
       AND u.referred_at <= NOW() - INTERVAL '${hoursAgo} hours'
       AND NOT EXISTS (
         SELECT 1 FROM point_transactions pt
         WHERE pt.user_id = u.referred_by
           AND pt.type = 'referral'
           AND pt.referred_user_id = u.id
       )
     ORDER BY u.referred_at ASC`,
    []
  );
  return result.rows;
}

module.exports = {
  getUserByWallet,
  getUserById,
  createUser,
  markReferralBonusClaimed,
  getReferredUsers,
  getReferralPointsEarned,
  hasReferralBonusBeenClaimed,
  getUnprocessedReferrals,
};
