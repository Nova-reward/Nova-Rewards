'use strict';

/**
 * Fee Estimation Route
 *
 * POST /api/fee-estimate
 *
 * Accepts a contract ID, function name, and optional arguments,
 * simulates the invocation via Stellar RPC, and returns a fee breakdown
 * so the frontend/merchant can display accurate costs before submission.
 */

const router = require('express').Router();
const { estimate_fee } = require('../lib/feeEstimator');
const { authenticateUser } = require('../middleware/authenticateUser');
const { slidingGlobal } = require('../middleware/rateLimiter');

/**
 * @openapi
 * /fee-estimate:
 *   post:
 *     tags: [Transactions]
 *     summary: Estimate Soroban contract invocation fees
 *     description: >
 *       Simulates a Soroban contract call via the Stellar RPC simulateTransaction
 *       endpoint and returns a breakdown of resource fee, inclusion fee, and total
 *       fee in stroops. No transaction is submitted.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [contractId, functionName]
 *             properties:
 *               contractId:
 *                 type: string
 *                 description: Strkey-encoded Soroban contract address (C…)
 *                 example: CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM
 *               functionName:
 *                 type: string
 *                 description: Contract function to simulate
 *                 example: issue_reward
 *               args:
 *                 type: array
 *                 description: >
 *                   Function arguments as native JS values (strings, numbers, bigints).
 *                   Pass pre-encoded XDR ScVal base64 strings for complex types.
 *                 items: {}
 *                 example: ["GABC123", 1000, 42]
 *               inclusionFee:
 *                 type: string
 *                 description: Network inclusion fee in stroops (default 100)
 *                 example: "100"
 *     responses:
 *       200:
 *         description: Fee estimate returned successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     resourceFee:
 *                       type: string
 *                       description: Soroban resource fee in stroops
 *                     inclusionFee:
 *                       type: string
 *                       description: Network inclusion fee in stroops
 *                     totalFee:
 *                       type: string
 *                       description: Total fee in stroops
 *                     contractId:
 *                       type: string
 *                     functionName:
 *                       type: string
 *       400:
 *         description: Validation error (missing contractId or functionName).
 *       502:
 *         description: Soroban simulation failed.
 */
router.post('/', authenticateUser, slidingGlobal, async (req, res, next) => {
  try {
    const { contractId, functionName, args, inclusionFee } = req.body;

    if (!contractId) {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: 'contractId is required',
      });
    }

    if (!functionName) {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: 'functionName is required',
      });
    }

    const estimate = await estimate_fee({
      contractId,
      functionName,
      args: Array.isArray(args) ? args : [],
      inclusionFee: inclusionFee ?? undefined,
    });

    return res.json({ success: true, data: estimate });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({
        success: false,
        error: err.code || 'fee_estimate_error',
        message: err.message,
      });
    }
    next(err);
  }
});

module.exports = router;
