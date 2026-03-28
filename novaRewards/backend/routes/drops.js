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
 * GET /api/drops/eligible
 * Returns all active drops the authenticated user qualifies for.
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
 * POST /api/drops/:id/claim
 * Claims a drop for the authenticated user.
 * Body: { proof: string[] }  — Merkle proof (required when drop has a merkle_root)
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
