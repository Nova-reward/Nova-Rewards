const { query } = require('./index');

// ---------------------------------------------------------------------------
// Referral-related functions (Requirements: #181)
// ---------------------------------------------------------------------------

async function getUserByWallet(walletAddress) {
  const result = await query(
    'SELECT * FROM users WHERE wallet_address = $1',
    [walletAddress]
  );
  return result.rows[0] || null;
}

async function getUserById(userId) {
  const result = await query(
    'SELECT * FROM users WHERE id = $1',
    [userId]
  );
  return result.rows[0] || null;
}

async function createUser({ walletAddress, referredBy = null }) {
  const result = await query(
    `INSERT INTO users (wallet_address, referred_by, referred_at)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [walletAddress, referredBy, referredBy ? new Date() : null]
  );
  return result.rows[0];
}

async function markReferralBonusClaimed(userId) {
  const result = await query(
    `UPDATE users SET referral_bonus_claimed = TRUE WHERE id = $1 RETURNING *`,
    [userId]
  );
  return result.rows[0];
}

async function getReferredUsers(referrerId) {
  const result = await query(
    `SELECT id, wallet_address, referred_at, referral_bonus_claimed
     FROM users WHERE referred_by = $1 ORDER BY referred_at DESC`,
    [referrerId]
  );
  return result.rows;
}

async function getReferralPointsEarned(referrerId) {
  const result = await query(
    `SELECT COALESCE(SUM(amount), 0) AS total
     FROM point_transactions WHERE user_id = $1 AND type = 'referral'`,
    [referrerId]
  );
  return String(result.rows[0].total);
}

async function hasReferralBonusBeenClaimed(referrerId, referredUserId) {
  const result = await query(
    `SELECT id FROM point_transactions
     WHERE user_id = $1 AND type = 'referral' AND referred_user_id = $2`,
    [referrerId, referredUserId]
  );
  return result.rows.length > 0;
}

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

// ---------------------------------------------------------------------------
// Profile / admin functions (Requirements: 183.1, 183.2, 183.3)
// ---------------------------------------------------------------------------

async function findById(id) {
  const result = await query(
    `SELECT id, wallet_address, first_name, last_name, bio, stellar_public_key,
            role, created_at, updated_at
     FROM users WHERE id = $1 AND is_deleted = FALSE`,
    [id]
  );
  return result.rows[0] || null;
}

async function findByWalletAddress(walletAddress) {
  const result = await query(
    `SELECT id, wallet_address, first_name, last_name, bio, stellar_public_key,
            role, created_at, updated_at
     FROM users WHERE wallet_address = $1 AND is_deleted = FALSE`,
    [walletAddress]
  );
  return result.rows[0] || null;
}

async function getPublicProfile(id) {
  const result = await query(
    `SELECT id, wallet_address, first_name, last_name, bio, created_at
     FROM users WHERE id = $1 AND is_deleted = FALSE`,
    [id]
  );
  return result.rows[0] || null;
}

async function getPrivateProfile(id) {
  const result = await query(
    `SELECT id, wallet_address, first_name, last_name, bio, stellar_public_key,
            role, created_at, updated_at
     FROM users WHERE id = $1 AND is_deleted = FALSE`,
    [id]
  );
  return result.rows[0] || null;
}

async function updateUser(id, updates) {
  const allowedFields = ['first_name', 'last_name', 'bio', 'stellar_public_key'];
  const fields = [];
  const values = [];
  let paramCount = 1;

  for (const [key, value] of Object.entries(updates)) {
    if (allowedFields.includes(key)) {
      fields.push(`${key} = $${paramCount}`);
      values.push(value);
      paramCount++;
    }
  }

  if (fields.length === 0) return findById(id);

  fields.push('updated_at = NOW()');

  const result = await query(
    `UPDATE users SET ${fields.join(', ')}
     WHERE id = $${paramCount} AND is_deleted = FALSE
     RETURNING id, wallet_address, first_name, last_name, bio, stellar_public_key,
               role, created_at, updated_at`,
    [...values, id]
  );
  return result.rows[0] || null;
}

async function softDelete(id) {
  const result = await query(
    `UPDATE users
     SET is_deleted = TRUE, deleted_at = NOW(),
         first_name = NULL, last_name = NULL, bio = NULL,
         stellar_public_key = NULL, updated_at = NOW()
     WHERE id = $1 AND is_deleted = FALSE`,
    [id]
  );
  return result.rowCount > 0;
}

async function exists(id) {
  const result = await query(
    'SELECT 1 FROM users WHERE id = $1 AND is_deleted = FALSE',
    [id]
  );
  return result.rows.length > 0;
}

async function isAdmin(id) {
  const result = await query(
    'SELECT role FROM users WHERE id = $1 AND is_deleted = FALSE',
    [id]
  );
  return result.rows[0]?.role === 'admin';
}

module.exports = {
  // Referral functions
  getUserByWallet,
  getUserById,
  createUser,
  markReferralBonusClaimed,
  getReferredUsers,
  getReferralPointsEarned,
  hasReferralBonusBeenClaimed,
  getUnprocessedReferrals,
  // Profile functions
  findById,
  findByWalletAddress,
  getPublicProfile,
  getPrivateProfile,
  update: updateUser,
  softDelete,
  exists,
  isAdmin,
};
