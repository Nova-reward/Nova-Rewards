'use strict';

const router = require('express').Router();
const { getAllProposals } = require('../services/governanceService');
const { getRedisClient } = require('../cache/redisClient');

const CACHE_TTL = 60;
const CACHE_KEY = 'governance:proposals';

/**
 * @openapi
 * /api/governance/proposals:
 *   get:
 *     tags: [Governance]
 *     summary: List all governance proposals with vote tallies
 *     description: >
 *       Fetches proposal data from the Soroban governance contract via Horizon
 *       RPC.  Results are cached in Redis for 60 seconds.
 *     responses:
 *       200:
 *         description: Array of proposals (empty array when none exist).
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       title:
 *                         type: string
 *                       description:
 *                         type: string
 *                       votesFor:
 *                         type: integer
 *                       votesAgainst:
 *                         type: integer
 *                       status:
 *                         type: string
 *                         enum: [Active, Passed, Rejected, Executed]
 *                       endTime:
 *                         type: integer
 *                         description: Ending ledger sequence number
 *       502:
 *         description: RPC error when fetching from Soroban.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: false }
 *                 error: { type: string, example: 'rpc_error' }
 *                 message: { type: string }
 */
router.get('/proposals', async (req, res, next) => {
  try {
    const redis = getRedisClient();

    if (redis) {
      const cached = await redis.get(CACHE_KEY);
      if (cached) {
        return res.json({ success: true, data: JSON.parse(cached) });
      }
    }

    const proposals = await getAllProposals();

    if (redis) {
      await redis.setex(CACHE_KEY, CACHE_TTL, JSON.stringify(proposals));
    }

    res.json({ success: true, data: proposals });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
