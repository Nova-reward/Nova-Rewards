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
 * User repository for database operations
 * Requirements: 183.1, 183.2, 183.3
 */
const userRepository = {
  /**
   * Find a user by ID (excludes soft-deleted users)
   * @param {number} id - User ID
   * @returns {Promise<Object|null>}
   */
  async findById(id) {
    const result = await query(
      `SELECT id, wallet_address, first_name, last_name, bio, stellar_public_key, 
              role, created_at, updated_at
       FROM users 
       WHERE id = $1 AND is_deleted = FALSE`,
      [id]
    );
    return result.rows[0] || null;
  },

  /**
   * Find a user by wallet address (excludes soft-deleted users)
   * @param {string} walletAddress - Stellar wallet address
   * @returns {Promise<Object|null>}
   */
  async findByWalletAddress(walletAddress) {
    const result = await query(
      `SELECT id, wallet_address, first_name, last_name, bio, stellar_public_key, 
              role, created_at, updated_at
       FROM users 
       WHERE wallet_address = $1 AND is_deleted = FALSE`,
      [walletAddress]
    );
    return result.rows[0] || null;
  },

  /**
   * Get user's public profile (limited fields)
   * @param {number} id - User ID
   * @returns {Promise<Object|null>}
   */
  async getPublicProfile(id) {
    const result = await query(
      `SELECT id, wallet_address, first_name, last_name, bio, created_at
       FROM users 
       WHERE id = $1 AND is_deleted = FALSE`,
      [id]
    );
    return result.rows[0] || null;
  },

  /**
   * Get user's private profile (all fields except sensitive data)
   * @param {number} id - User ID
   * @returns {Promise<Object|null>}
   */
  async getPrivateProfile(id) {
    const result = await query(
      `SELECT id, wallet_address, first_name, last_name, bio, stellar_public_key, 
              role, created_at, updated_at
       FROM users 
       WHERE id = $1 AND is_deleted = FALSE`,
      [id]
    );
    return result.rows[0] || null;
  },

  /**
   * Update user profile
   * @param {number} id - User ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object|null>}
   */
  async update(id, updates) {
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

    if (fields.length === 0) {
      return this.findById(id);
    }

    fields.push(`updated_at = NOW()`);

    const result = await query(
      `UPDATE users 
       SET ${fields.join(', ')}
       WHERE id = $${paramCount} AND is_deleted = FALSE
       RETURNING id, wallet_address, first_name, last_name, bio, stellar_public_key, 
                 role, created_at, updated_at`,
      [...values, id]
    );

    return result.rows[0] || null;
  },

  /**
   * Soft delete a user (anonymize PII)
   * @param {number} id - User ID
   * @returns {Promise<boolean>}
   */
  async softDelete(id) {
    const result = await query(
      `UPDATE users 
       SET is_deleted = TRUE,
           deleted_at = NOW(),
           first_name = NULL,
           last_name = NULL,
           bio = NULL,
           stellar_public_key = NULL,
           updated_at = NOW()
       WHERE id = $1 AND is_deleted = FALSE`,
      [id]
    );

    return result.rowCount > 0;
  },

  /**
   * Check if user exists and is not deleted
   * @param {number} id - User ID
   * @returns {Promise<boolean>}
   */
  async exists(id) {
    const result = await query(
      'SELECT 1 FROM users WHERE id = $1 AND is_deleted = FALSE',
      [id]
    );
    return result.rows.length > 0;
  },

  /**
   * Check if user is admin
   * @param {number} id - User ID
   * @returns {Promise<boolean>}
   */
  async isAdmin(id) {
    const result = await query(
      'SELECT role FROM users WHERE id = $1 AND is_deleted = FALSE',
      [id]
    );
    return result.rows[0]?.role === 'admin';
  },
};

module.exports = userRepository;
