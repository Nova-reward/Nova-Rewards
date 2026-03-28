const router = require('express').Router();
const { authenticateUser } = require('../middleware/authenticateUser');
const { redeemReward, getRedemptionById, getUserRedemptions } = require('../db/redemptionRepository');
const { getUserById } = require('../db/userRepository');
const { getRewardById } = require('../db/adminRepository');
const appEvents = require('../services/eventEmitter');

// All redemption routes require an authenticated user
router.use(authenticateUser);

/**
 * POST /api/redemptions
 *
 * Redeems a reward for the authenticated user.
 *
 * Headers:
 *   X-Idempotency-Key  (required) – client-generated UUID to prevent duplicate
 *                                   submissions on network retry
 *
 * Body:
 *   { userId: number, rewardId: number }
 *
 * Responses:
 *   201  – redemption created
 *   200  – idempotent replay (same key, same result)
 *   400  – validation error
 *   403  – userId in body does not match authenticated user
 *   404  – reward not found
 *   409  – out of stock | insufficient points | reward inactive
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
    const { userId, rewardId } = req.body;

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

    const userIdNum   = Number(userId);
    const rewardIdNum = Number(rewardId);

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
 * GET /api/redemptions
 * Returns paginated redemption history for the authenticated user.
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
 * GET /api/redemptions/:id
 * Returns a single redemption, scoped to the authenticated user.
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
