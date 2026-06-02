const router = require('express').Router();
const { EventEmitter } = require('events');
const { authenticateUser } = require('../middleware/authenticateUser');
const { getDropById } = require('../db/dropRepository');
const { getEligibleDrops, processClaim } = require('../services/dropService');

const dropEvents = new EventEmitter();

// Forward drop.claimed to any registered listeners (frontend SSE, email service, etc.)
dropEvents.on('drop.claimed', ({ drop, user, claim }) => {
  console.log(`[drop.claimed] drop=${drop.id} user=${user.id} claim=${claim.id}`);
});

/**
 * @openapi
 * /drops/eligible:
 *   get:
 *     tags: [Drops]
 *     summary: List active drops the authenticated user qualifies for
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Eligible drops.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/Drop' }
 *       401:
 *         description: Unauthenticated.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.get('/eligible', authenticateUser, async (req, res, next) => {
  try {
    const drops = await getEligibleDrops(req.user);
    res.json({ success: true, data: drops });
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /drops/{id}/claim:
 *   post:
 *     tags: [Drops]
 *     summary: Claim a drop for the authenticated user
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer, example: 1 }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               proof:
 *                 type: array
 *                 items: { type: string }
 *                 example: ["0xabc...", "0xdef..."]
 *                 description: Merkle proof (required when drop has a merkle_root)
 *     responses:
 *       201:
 *         description: Drop claimed.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { type: object }
 *       400:
 *         description: Ineligible or invalid drop id.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       401:
 *         description: Unauthenticated.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       404:
 *         description: Drop not found.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.post('/:id/claim', authenticateUser, async (req, res, next) => {
  try {
    const dropId = parseInt(req.params.id, 10);
    if (isNaN(dropId) || dropId <= 0) {
      return res.status(400).json({ success: false, error: 'validation_error', message: 'Invalid drop id' });
    }

    const drop = await getDropById(dropId);
    if (!drop) {
      return res.status(404).json({ success: false, error: 'not_found', message: 'Drop not found' });
    }

    const { proof = [] } = req.body;
    const result = await processClaim(drop, req.user, proof, dropEvents);

    if (!result.success) {
      return res.status(result.status).json({
        success: false,
        error: 'ineligible',
        message: result.reason,
      });
    }

    res.status(201).json({ success: true, data: result.claim });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
