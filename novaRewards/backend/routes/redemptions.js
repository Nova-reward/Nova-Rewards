const router = require('express').Router();
const { requireIdempotencyKey } = require('../src/middleware/idempotency');
const { redeemReward } = require('../src/controllers/redemptionController');

/**
 * POST /api/redemptions
 * Redeems a reward for a user.
 * X-Idempotency-Key header is REQUIRED — see API docs.
 * Issue #190: atomic, race-condition-safe redemption.
 */
router.post('/', requireIdempotencyKey, redeemReward);

module.exports = router;
