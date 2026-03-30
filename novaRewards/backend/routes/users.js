const router = require('express').Router();
const { query } = require('../db/index');
const { getUserByWallet, getUserById, createUser } = require('../db/userRepository');
const userRepository = require('../db/userRepository');
const { getUserReferralStats, processReferralBonus } = require('../services/referralService');
const { getUserBalance, getUserTotalPoints, getUserReferralPoints } = require('../db/pointTransactionRepository');
const { getUserRedemptions } = require('../db/redemptionRepository');
const { getTransactionsByUser } = require('../db/transactionRepository');
const { sendWelcome } = require('../services/emailService');
const { authenticateUser, requireAdmin, requireOwnershipOrAdmin } = require('../middleware/authenticateUser');
const { validateUpdateUserDto } = require('../middleware/validateDto');
const { isValidStellarAddress, getNOVABalance } = require('../../blockchain/stellarService');
const { client: redisClient } = require('../lib/redis');

function parsePositiveInteger(value) {
  const parsed = parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function parsePagination(query) {
  const page = query.page === undefined ? 1 : parseInt(query.page, 10);
  const limit = query.limit === undefined ? 20 : parseInt(query.limit, 10);

  if (!Number.isInteger(page) || page <= 0) {
    return { error: 'page must be a positive integer' };
  }

  if (!Number.isInteger(limit) || limit <= 0 || limit > 100) {
    return { error: 'limit must be a positive integer between 1 and 100' };
  }

  return { page, limit };
}

function ensureSelfOrAdmin(req, res, userId) {
  if (req.user.id !== userId && req.user.role !== 'admin') {
    res.status(403).json({ success: false, error: 'forbidden', message: 'Forbidden' });
    return false;
  }
  return true;
}

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

    const existingUser = await getUserByWallet(walletAddress);
    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: 'duplicate_user',
        message: 'User with this wallet address already exists',
      });
    }

    let referredBy = null;
    if (referralCode) {
      const referrer = await getUserByWallet(referralCode);
      if (referrer) referredBy = referrer.id;
    }

    const user = await createUser({ walletAddress, referredBy });

    sendWelcome({ to: walletAddress, userName: walletAddress, referralCode: walletAddress })
      .catch(err => console.error('Failed to send welcome email:', err));

    res.status(201).json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/users
 * Returns a paginated user list for admins.
 */
router.get('/', authenticateUser, requireAdmin, async (req, res, next) => {
  try {
    const pagination = parsePagination(req.query);
    if (pagination.error) {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: pagination.error,
      });
    }

    const { users, total } = await userRepository.listUsers({
      search: req.query.search,
      page: pagination.page,
      limit: pagination.limit,
    });

    res.json({
      success: true,
      data: {
        users,
        total,
        page: pagination.page,
        limit: pagination.limit,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/users/:walletAddress/points
 * Returns the current point balance for a wallet address.
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
      data: { walletAddress, balance: balance < 0 ? 0 : balance },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /users/{id}/token-balance:
 *   get:
 *     summary: Get user's on-chain token balance
 *     description: Reads the user's linked Stellar public key and returns token balance from Horizon/Soroban.
 *     tags:
 *       - Users
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID
 *     responses:
 *       200:
 *         description: Token balance retrieved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       404:
 *         description: User not found or no linked Stellar public key.
 *       400:
 *         description: Validation error on input.
 */
router.get('/:id/token-balance', async (req, res, next) => {
  try {
    const userId = parseInt(req.params.id, 10);
    if (Number.isNaN(userId) || userId <= 0) {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: 'id must be a positive integer',
      });
    }

    const user = await getUserById(userId);
    if (!user) {
      return res.status(404).json({ success: false, error: 'not_found', message: 'User not found' });
    }

    if (!user.stellar_public_key) {
      return res.status(404).json({
        success: false,
        error: 'not_found',
        message: 'User does not have a linked Stellar public key',
      });
    }

    const cacheKey = `tokenBalance:${userId}`;
    let tokenBalance;

    if (redisClient && redisClient.isOpen) {
      const cachedBalance = await redisClient.get(cacheKey);
      if (cachedBalance) {
        return res.json({
          success: true,
          data: {
            userId,
            stellarPublicKey: user.stellar_public_key,
            tokenBalance: cachedBalance,
            cached: true,
          },
        });
      }
    }

    tokenBalance = await getNOVABalance(user.stellar_public_key);

    if (redisClient && redisClient.isOpen) {
      try {
        await redisClient.setEx(cacheKey, 30, tokenBalance);
      } catch (cacheErr) {
        console.warn('Redis cache set failed', cacheErr);
      }
    }

    return res.json({
      success: true,
      data: {
        userId,
        stellarPublicKey: user.stellar_public_key,
        tokenBalance,
        cached: false,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/users/:id
 * Returns public profile for non-owners, private profile for owners/admins.
 * Requirements: 183.1
 */
router.get('/:id', authenticateUser, requireOwnershipOrAdmin, async (req, res, next) => {
  try {
    const userId = parseInt(req.params.id, 10);

    if (isNaN(userId) || userId <= 0) {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: 'id must be a positive integer',
      });
    }

    const userExists = await userRepository.exists(userId);
    if (!userExists) {
      return res.status(404).json({ success: false, error: 'not_found', message: 'User not found' });
    }

    const currentUserId = req.user.id;
    const isAdminUser = req.user.role === 'admin';

    const profile = (currentUserId === userId || isAdminUser)
      ? await userRepository.getPrivateProfile(userId)
      : await userRepository.getPublicProfile(userId);

    res.json({ success: true, data: profile });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/users/:id/rewards
 * Returns reward summary and redemption history for a user.
 */
router.get('/:id/rewards', authenticateUser, async (req, res, next) => {
  try {
    const userId = parsePositiveInteger(req.params.id);
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: 'id must be a positive integer',
      });
    }

    const userExists = await userRepository.exists(userId);
    if (!userExists) {
      return res.status(404).json({ success: false, error: 'not_found', message: 'User not found' });
    }

    if (!ensureSelfOrAdmin(req, res, userId)) return;

    const pagination = parsePagination(req.query);
    if (pagination.error) {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: pagination.error,
      });
    }

    const [balance, totalPoints, referralPoints, redemptions] = await Promise.all([
      getUserBalance(userId),
      getUserTotalPoints(userId),
      getUserReferralPoints(userId),
      getUserRedemptions(userId, pagination),
    ]);

    res.json({
      success: true,
      data: {
        summary: {
          balance,
          totalPoints,
          referralPoints,
        },
        rewards: redemptions.data,
        total: redemptions.total,
        page: redemptions.page,
        limit: redemptions.limit,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/users/:id/transactions
 * Returns paginated transactions for a user.
 */
router.get('/:id/transactions', authenticateUser, async (req, res, next) => {
  try {
    const userId = parsePositiveInteger(req.params.id);
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: 'id must be a positive integer',
      });
    }

    const userExists = await userRepository.exists(userId);
    if (!userExists) {
      return res.status(404).json({ success: false, error: 'not_found', message: 'User not found' });
    }

    if (!ensureSelfOrAdmin(req, res, userId)) return;

    const pagination = parsePagination(req.query);
    if (pagination.error) {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: pagination.error,
      });
    }

    const validTypes = ['distribution', 'redemption', 'transfer'];
    const { type, startDate, endDate } = req.query;

    if (type && !validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: `type must be one of: ${validTypes.join(', ')}`,
      });
    }

    if (startDate && Number.isNaN(Date.parse(startDate))) {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: 'startDate must be a valid ISO date string',
      });
    }

    if (endDate && Number.isNaN(Date.parse(endDate))) {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: 'endDate must be a valid ISO date string',
      });
    }

    const result = await getTransactionsByUser(userId, {
      type,
      startDate,
      endDate,
      page: pagination.page,
      limit: pagination.limit,
    });

    res.json({
      success: true,
      data: result.data,
      total: result.total,
      page: result.page,
      limit: result.limit,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/users/:id/referrals
 * Returns referral statistics for a user.
 * Requirements: #181
 */
router.get('/:id/referrals', async (req, res, next) => {
  try {
    const userId = parseInt(req.params.id, 10);

    if (isNaN(userId) || userId <= 0) {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: 'id must be a positive integer',
      });
    }

    const user = await getUserById(userId);
    if (!user) {
      return res.status(404).json({ success: false, error: 'not_found', message: 'User not found' });
    }

    const referralStats = await getUserReferralStats(userId);
    res.json({ success: true, data: referralStats });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/users/:id
 * Partial profile update.
 * Requirements: 183.2, 183.4
 */
async function updateUserProfile(req, res, next) {
  try {
    const userId = parseInt(req.params.id, 10);
    const currentUserId = req.user.id;
    const isAdminUser = req.user.role === 'admin';

    // Check ownership before hitting the DB
    if (currentUserId !== userId && !isAdminUser) {
      return res.status(403).json({ success: false, error: 'forbidden', message: 'Forbidden' });
    }

    const userExists = await userRepository.exists(userId);
    if (!userExists) {
      return res.status(404).json({ success: false, error: 'not_found', message: 'User not found' });
    }

    const updates = {};
    if (req.body.firstName !== undefined) updates.first_name = req.body.firstName;
    if (req.body.lastName !== undefined) updates.last_name = req.body.lastName;
    if (req.body.bio !== undefined) updates.bio = req.body.bio;
    if (req.body.stellarPublicKey !== undefined) updates.stellar_public_key = req.body.stellarPublicKey;

    const updatedUser = await userRepository.update(userId, updates);
    res.json({ success: true, data: updatedUser });
  } catch (err) {
    next(err);
  }
}

router.put('/:id', authenticateUser, validateUpdateUserDto, updateUserProfile);
router.patch('/:id', authenticateUser, validateUpdateUserDto, updateUserProfile);

/**
 * DELETE /api/users/:id
 * Soft-delete and anonymise PII.
 * Requirements: 183.3
 */
router.delete('/:id', authenticateUser, async (req, res, next) => {
  try {
    const userId = parseInt(req.params.id, 10);
    const currentUserId = req.user.id;
    const isAdminUser = req.user.role === 'admin';

    // Check existence first (404 takes priority over 403)
    const userExists = await userRepository.exists(userId);
    if (!userExists) {
      return res.status(404).json({ success: false, error: 'not_found', message: 'User not found' });
    }

    if (currentUserId !== userId && !isAdminUser) {
      return res.status(403).json({ success: false, error: 'forbidden', message: 'Forbidden' });
    }

    await userRepository.softDelete(userId);
    res.json({ success: true, message: 'User account deleted successfully' });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/users/:id/referrals/process
 * Manually processes a referral bonus.
 * Requirements: #181
 */
router.post('/:id/referrals/process', async (req, res, next) => {
  try {
    const referrerId = parseInt(req.params.id, 10);
    const { referredUserId } = req.body;

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
      return res.status(400).json({ success: false, error: 'referral_error', message: result.message });
    }

    res.json({ success: true, data: result.bonus, message: result.message });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
