const router = require('express').Router();
const { query } = require('../db/index');
const { isValidStellarAddress } = require('../../blockchain/stellarService');

/**
 * GET /api/users/:walletAddress/points
 * Calculates and returns the current point balance for a user.
 * Points = Sum(distributions) - Sum(redemptions)
 */
router.get('/:walletAddress/points', async (req, res, next) => {
  try {
    const { walletAddress } = req.params;

    if (!isValidStellarAddress(walletAddress)) {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: 'walletAddress must be a valid Stellar public key',
      });
    }

    // Calculate balance from transactions table
    const result = await query(
      `SELECT
         COALESCE(SUM(CASE WHEN tx_type = 'distribution' AND to_wallet = $1 THEN amount ELSE 0 END), 0) -
         COALESCE(SUM(CASE WHEN tx_type = 'redemption'   AND from_wallet = $1 THEN amount ELSE 0 END), 0) AS balance
       FROM transactions
       WHERE to_wallet = $1 OR from_wallet = $1`,
      [walletAddress]
    );

    const balance = parseFloat(result.rows[0].balance || 0);

    res.json({
      success: true,
      data: {
        walletAddress,
        balance: balance < 0 ? 0 : balance, // Points shouldn't be negative in this context
      },
const userRepository = require('../db/userRepository');
const { authenticateUser, requireOwnershipOrAdmin } = require('../middleware/authenticateUser');
const { validateUpdateUserDto } = require('../middleware/validateDto');

/**
 * GET /api/users/:id
 * Return user's public profile fields.
 * Private fields are gated behind ownership or admin role.
 * Requirements: 183.1
 */
router.get('/:id', authenticateUser, requireOwnershipOrAdmin, async (req, res, next) => {
  try {
    const userId = parseInt(req.params.id);
    const currentUserId = req.user.id;
    const isAdmin = req.user.role === 'admin';

    // Check if user exists
    const userExists = await userRepository.exists(userId);
    if (!userExists) {
      return res.status(404).json({
        success: false,
        error: 'not_found',
        message: 'User not found',
      });
    }

    // Return public profile for non-owners, private profile for owners/admins
    let profile;
    if (currentUserId === userId || isAdmin) {
      profile = await userRepository.getPrivateProfile(userId);
    } else {
      profile = await userRepository.getPublicProfile(userId);
    }

    res.json({
      success: true,
      data: profile,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/users/:id
 * Accept partial updates (firstName, lastName, bio, stellarPublicKey).
 * Validates with UpdateUserDto.
 * Requirements: 183.2, 183.4
 */
router.patch('/:id', authenticateUser, requireOwnershipOrAdmin, validateUpdateUserDto, async (req, res, next) => {
  try {
    const userId = parseInt(req.params.id);

    // Check if user exists
    const userExists = await userRepository.exists(userId);
    if (!userExists) {
      return res.status(404).json({
        success: false,
        error: 'not_found',
        message: 'User not found',
      });
    }

    // Map camelCase to snake_case for database
    const updates = {};
    if (req.body.firstName !== undefined) updates.first_name = req.body.firstName;
    if (req.body.lastName !== undefined) updates.last_name = req.body.lastName;
    if (req.body.bio !== undefined) updates.bio = req.body.bio;
    if (req.body.stellarPublicKey !== undefined) updates.stellar_public_key = req.body.stellarPublicKey;

    // Update user profile
    const updatedUser = await userRepository.update(userId, updates);

    res.json({
      success: true,
      data: updatedUser,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/users/:id
 * Soft-delete by setting isDeleted = true and anonymising PII fields.
 * Requirements: 183.3
 */
router.delete('/:id', authenticateUser, requireOwnershipOrAdmin, async (req, res, next) => {
  try {
    const userId = parseInt(req.params.id);

    // Check if user exists
    const userExists = await userRepository.exists(userId);
    if (!userExists) {
      return res.status(404).json({
        success: false,
        error: 'not_found',
        message: 'User not found',
      });
    }

    // Soft delete user
    const deleted = await userRepository.softDelete(userId);

    if (deleted) {
      res.json({
        success: true,
        message: 'User account deleted successfully',
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'delete_failed',
        message: 'Failed to delete user account',
      });
    }
  } catch (err) {
    next(err);
  }
});

module.exports = router;
