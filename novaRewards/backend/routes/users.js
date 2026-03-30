const router = require('express').Router();
const { query } = require('../db/index');
const { getUserByWallet, getUserById, createUser } = require('../db/userRepository');
const userRepository = require('../db/userRepository');
const { getUserReferralStats, processReferralBonus } = require('../services/referralService');
const { getUserTotalPoints, getUserReferralPoints } = require('../db/pointTransactionRepository');
const { sendWelcome } = require('../services/emailService');
const { authenticateUser, requireOwnershipOrAdmin } = require('../middleware/authenticateUser');
const { validateUpdateUserDto } = require('../middleware/validateDto');
const { isValidStellarAddress, getNOVABalance } = require('../../blockchain/stellarService');
const { client: redisClient } = require('../lib/redis');

/**
 * @openapi
 * /users:
 *   post:
 *     tags: [Users]
 *     summary: Create a new user with optional referral tracking
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [walletAddress]
 *             properties:
 *               walletAddress:
 *                 type: string
 *                 example: GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5
 *               referralCode:
 *                 type: string
 *                 example: GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN
 *     responses:
 *       201:
 *         description: User created.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { $ref: '#/components/schemas/User' }
 *       400:
 *         description: Validation error.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       409:
 *         description: Wallet address already registered.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
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
 * @openapi
 * /users/{walletAddress}/points:
 *   get:
 *     tags: [Users]
 *     summary: Get current point balance for a wallet address
 *     parameters:
 *       - in: path
 *         name: walletAddress
 *         required: true
 *         schema: { type: string, example: GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5 }
 *     responses:
 *       200:
 *         description: Point balance.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     walletAddress: { type: string, example: GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5 }
 *                     balance: { type: number, example: 1250.5 }
 *       400:
 *         description: Invalid wallet address.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
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
 * @openapi
 * /users/{id}:
 *   get:
 *     tags: [Users]
 *     summary: Get user profile (public or private depending on ownership)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer, example: 42 }
 *     responses:
 *       200:
 *         description: User profile.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { $ref: '#/components/schemas/User' }
 *       400:
 *         description: Invalid id.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       401:
 *         description: Unauthenticated.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       404:
 *         description: User not found.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
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
 * @openapi
 * /users/{id}/referrals:
 *   get:
 *     tags: [Users]
 *     summary: Get referral statistics for a user
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer, example: 42 }
 *     responses:
 *       200:
 *         description: Referral stats.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     total_referrals: { type: integer, example: 5 }
 *                     total_bonus_earned: { type: number, example: 250 }
 *       400:
 *         description: Invalid id.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       404:
 *         description: User not found.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
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
 * @openapi
 * /users/{id}:
 *   patch:
 *     tags: [Users]
 *     summary: Partial profile update
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer, example: 42 }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               firstName: { type: string, example: Alice }
 *               lastName: { type: string, example: Smith }
 *               bio: { type: string, example: "Stellar enthusiast" }
 *               stellarPublicKey: { type: string, example: GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5 }
 *     responses:
 *       200:
 *         description: Updated user profile.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { $ref: '#/components/schemas/User' }
 *       401:
 *         description: Unauthenticated.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       403:
 *         description: Forbidden — not owner or admin.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       404:
 *         description: User not found.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.patch('/:id', authenticateUser, validateUpdateUserDto, async (req, res, next) => {
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
});

/**
 * @openapi
 * /users/{id}:
 *   delete:
 *     tags: [Users]
 *     summary: Soft-delete and anonymise a user account
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer, example: 42 }
 *     responses:
 *       200:
 *         description: Account deleted.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "User account deleted successfully" }
 *       401:
 *         description: Unauthenticated.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       403:
 *         description: Forbidden.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       404:
 *         description: User not found.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
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
 * @openapi
 * /users/{id}/referrals/process:
 *   post:
 *     tags: [Users]
 *     summary: Manually process a referral bonus
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer, example: 42 }
 *         description: Referrer user ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [referredUserId]
 *             properties:
 *               referredUserId: { type: integer, example: 99 }
 *     responses:
 *       200:
 *         description: Referral bonus processed.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     bonus: { type: number, example: 50 }
 *       400:
 *         description: Validation or referral error.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
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
