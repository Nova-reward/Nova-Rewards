const router = require('express').Router();
const { getUserByWallet, getUserById, createUser } = require('../db/userRepository');
const { getUserReferralStats, processReferralBonus } = require('../services/referralService');
const { getUserTotalPoints, getUserReferralPoints } = require('../db/pointTransactionRepository');
const { sendWelcome } = require('../services/emailService');

/**
 * POST /api/users
 * Creates a new user with optional referral tracking.
 * Requirements: #181
 */
router.post('/', async (req, res, next) => {
  try {
    const { walletAddress, referralCode } = req.body;

    if (!walletAddress) {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: 'walletAddress is required',
      });
    }

    // Check if user already exists
    const existingUser = await getUserByWallet(walletAddress);
    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: 'duplicate_user',
        message: 'User with this wallet address already exists',
      });
    }

    // If referral code provided, find the referrer
    let referredBy = null;
    if (referralCode) {
      // For simplicity, using wallet address as referral code
      // In production, you might want a separate referral code system
      const referrer = await getUserByWallet(referralCode);
      if (referrer) {
        referredBy = referrer.id;
      }
    }

    // Create the user
    const user = await createUser({
      walletAddress,
      referredBy,
    });

    // Send welcome email (async, don't wait for it)
    sendWelcome({
      to: walletAddress, // In production, you'd have user email
      userName: walletAddress,
      referralCode: walletAddress,
    }).catch(err => console.error('Failed to send welcome email:', err));

    res.status(201).json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/users/:id
 * Gets user information by ID.
 * Requirements: #181
 */
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = parseInt(id, 10);

    if (isNaN(userId) || userId <= 0) {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: 'id must be a positive integer',
      });
    }

    const user = await getUserById(userId);
    if (!user) {
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

    // Get user's total points
    const totalPoints = await getUserTotalPoints(userId);
    const referralPoints = await getUserReferralPoints(userId);

    res.json({
      success: true,
      data: {
        ...user,
        total_points: totalPoints,
        referral_points: referralPoints,
      },
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
 * GET /api/users/:id/referrals
 * Returns the list of referred users and total points earned from referrals.
 * Requirements: #181
 */
router.get('/:id/referrals', async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = parseInt(id, 10);

    if (isNaN(userId) || userId <= 0) {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: 'id must be a positive integer',
      });
    }

    // Check if user exists
    const user = await getUserById(userId);
    if (!user) {
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

    // Get referral statistics
    const referralStats = await getUserReferralStats(userId);

    res.json({
      success: true,
      data: referralStats,
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
 * POST /api/users/:id/referrals/process
 * Manually processes a referral bonus for a specific user.
 * Requirements: #181
 */
router.post('/:id/referrals/process', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { referredUserId } = req.body;
    const referrerId = parseInt(id, 10);

    if (isNaN(referrerId) || referrerId <= 0) {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: 'id must be a positive integer',
      });
    }

    if (!referredUserId) {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: 'referredUserId is required',
      });
    }

    const result = await processReferralBonus(referrerId, referredUserId);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: 'referral_error',
        message: result.message,
      });
    }

    res.json({
      success: true,
      data: result.bonus,
      message: result.message,
    });
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
