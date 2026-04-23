const router = require('express').Router();
const { authenticateUser } = require('../middleware/authenticateUser');
const { redeemReward, getRedemptionById, getUserRedemptions } = require('../db/redemptionRepository');
const { getUserById } = require('../db/userRepository');
const { getRewardById } = require('../db/adminRepository');
const appEvents = require('../services/eventEmitter');
const { logAudit } = require('../db/auditLogRepository');

// All redemption routes require an authenticated user
router.use(authenticateUser);

/**
 * @openapi
 * /redemptions:
 *   post:
 *     tags: [Redemptions]
 *     summary: Redeem a reward
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: header
 *         name: X-Idempotency-Key
 *         required: true
 *         schema: { type: string, format: uuid, example: "550e8400-e29b-41d4-a716-446655440000" }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [userId, rewardId]
 *             properties:
 *               userId: { type: integer, example: 42 }
 *               rewardId: { type: integer, example: 12 }
 *     responses:
 *       201:
 *         description: Redemption created.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     redemption: { $ref: '#/components/schemas/Redemption' }
 *       200:
 *         description: Idempotent replay — same result returned.
 *       400:
 *         description: Validation error or missing idempotency key.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       401:
 *         description: Unauthenticated.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       403:
 *         description: Redeeming for another user.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       404:
 *         description: Reward not found.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       409:
 *         description: Out of stock, insufficient points, or reward inactive.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.post('/', async (req, res, next) => {
  try {
    // ── Idempotency key ───────────────────────────────────────────────────
    const idempotencyKey = req.headers['x-idempotency-key'];
    if (!idempotencyKey || typeof idempotencyKey !== 'string' || idempotencyKey.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: 'X-Idempotency-Key header is required',
      });
    }

    // ── Body validation ───────────────────────────────────────────────────
    const { userId, rewardId, campaignId } = req.body;

    if (!userId || !Number.isInteger(Number(userId)) || Number(userId) <= 0) {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: 'userId must be a positive integer',
      });
    }

    if (!rewardId || !Number.isInteger(Number(rewardId)) || Number(rewardId) <= 0) {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: 'rewardId must be a positive integer',
      });
    }

    if (campaignId !== undefined && campaignId !== null &&
        (!Number.isInteger(Number(campaignId)) || Number(campaignId) <= 0)) {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: 'campaignId must be a positive integer',
      });
    }

    const userIdNum     = Number(userId);
    const rewardIdNum   = Number(rewardId);
    const campaignIdNum = campaignId != null ? Number(campaignId) : null;

    // ── Authorisation: users may only redeem for themselves ───────────────
    if (req.user.id !== userIdNum) {
      return res.status(403).json({
        success: false,
        error: 'forbidden',
        message: 'You may only redeem rewards for your own account',
      });
    }

    // ── Execute atomic redemption ─────────────────────────────────────────
    const { redemption, pointTx, idempotent } = await redeemReward({
      userId: userIdNum,
      rewardId: rewardIdNum,
      campaignId: campaignIdNum,
      idempotencyKey: idempotencyKey.trim(),
    });

    // ── Emit event (fire-and-forget) ──────────────────────────────────────
    // Only emit on a fresh redemption, not on idempotent replays
    if (!idempotent) {
      // Fetch user and reward for the event payload — non-blocking
      Promise.all([
        getUserById(userIdNum),
        getRewardById(rewardIdNum),
      ]).then(([user, reward]) => {
        appEvents.emit('redemption.created', { redemption, user, reward });
      }).catch((err) => {
        console.error('[redemptions] event emit failed:', err.message);
      });

      // Explicit audit log for redemption
      logAudit({
        entityType: 'redemption',
        entityId: redemption.id,
        action: 'redeem_reward',
        performedBy: req.user.id,
        actorType: req.user.role === 'admin' ? 'admin' : 'user',
        details: { rewardId: rewardIdNum, userId: userIdNum, pointsSpent: redemption.points_spent },
        source: 'POST /api/redemptions',
      }).catch((err) => console.error('[audit] redeem_reward:', err.message));
    }

    const statusCode = idempotent ? 200 : 201;
    return res.status(statusCode).json({
      success: true,
      data: { redemption, pointTx: pointTx ?? null },
      ...(idempotent && { idempotent: true }),
    });
  } catch (err) {
    // Map business-rule errors to the correct HTTP status
    if (err.code === 'not_found')          return res.status(404).json({ success: false, error: err.code, message: err.message });
    if (err.code === 'out_of_stock')       return res.status(409).json({ success: false, error: err.code, message: err.message });
    if (err.code === 'insufficient_points') return res.status(409).json({ success: false, error: err.code, message: err.message });
    if (err.code === 'reward_inactive')    return res.status(409).json({ success: false, error: err.code, message: err.message });
    next(err);
  }
});

/**
 * @openapi
 * /redemptions:
 *   get:
 *     tags: [Redemptions]
 *     summary: List redemption history for the authenticated user
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1, example: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 100, example: 20 }
 *     responses:
 *       200:
 *         description: Paginated redemption list.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/Redemption' }
 *       401:
 *         description: Unauthenticated.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.get('/', async (req, res, next) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);

    const result = await getUserRedemptions(req.user.id, { page, limit });
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /redemptions/{id}:
 *   get:
 *     tags: [Redemptions]
 *     summary: Get a single redemption by ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer, example: 55 }
 *     responses:
 *       200:
 *         description: Redemption record.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { $ref: '#/components/schemas/Redemption' }
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
 *         description: Redemption not found.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.get('/:id', async (req, res, next) => {
  try {
    const redemptionId = parseInt(req.params.id, 10);
    if (isNaN(redemptionId) || redemptionId <= 0) {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: 'id must be a positive integer',
      });
    }

    const redemption = await getRedemptionById(redemptionId, req.user.id);
    if (!redemption) {
      return res.status(404).json({ success: false, error: 'not_found', message: 'Redemption not found' });
    }

    res.json({ success: true, data: redemption });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
