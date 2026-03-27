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
  } catch (err) {
    next(err);
  }
});

module.exports = router;
