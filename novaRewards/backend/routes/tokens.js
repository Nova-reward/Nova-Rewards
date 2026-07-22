const router = require('express').Router();
const { authenticateUser } = require('../middleware/authenticateUser');
const tokenTransferService = require('../services/tokenTransferService');

/**
 * @openapi
 * /tokens/transfer:
 *   post:
 *     tags: [Tokens]
 *     summary: Transfer NOVA tokens to another wallet
 *     description: >
 *       Validates the destination address and amount, checks the sender's
 *       on-chain NOVA balance, submits a Stellar payment operation, waits
 *       for ledger confirmation, and records the transfer in the
 *       transactions table.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [destination, amount, signerSecret]
 *             properties:
 *               destination:
 *                 type: string
 *                 description: Recipient's Stellar public key
 *               amount:
 *                 type: string
 *                 description: Amount of NOVA to transfer (up to 7 decimal places)
 *               signerSecret:
 *                 type: string
 *                 description: Secret key of the sender's linked wallet
 *               memo:
 *                 type: string
 *     responses:
 *       200:
 *         description: Transfer submitted and confirmed on-chain.
 *       400:
 *         description: Validation error or insufficient balance.
 *       401:
 *         description: Unauthorized.
 *       403:
 *         description: signerSecret does not match the authenticated user's wallet.
 */
router.post('/transfer', authenticateUser, async (req, res, next) => {
  try {
    const { destination, amount, signerSecret, memo } = req.body;

    const result = await tokenTransferService.transferTokens({
      userId: req.user.id,
      walletAddress: req.user.stellar_public_key,
      destination,
      amount,
      signerSecret,
      memo,
    });

    return res.json({
      success: true,
      data: {
        txHash: result.txHash,
        ledger: result.ledger,
        status: result.status,
        amount: result.amount,
        fromWallet: result.fromWallet,
        toWallet: result.toWallet,
        balance: result.balance,
      },
    });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({
        success: false,
        error: err.code || 'transfer_failed',
        message: err.message,
      });
    }
    next(err);
  }
});

module.exports = router;
