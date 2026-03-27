const { query } = require('./index');

/**
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
