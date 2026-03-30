const router = require('express').Router();
const { isValidStellarAddress } = require('../../blockchain/stellarService');
const { verifyTrustline, buildTrustlineXDR } = require('../../blockchain/trustline');

/**
 * @openapi
 * /trustline/verify:
 *   post:
 *     tags: [Trustline]
 *     summary: Check whether a wallet has an active NOVA trustline
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
 *     responses:
 *       200:
 *         description: Trustline status.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     exists: { type: boolean, example: true }
 *       400:
 *         description: Invalid wallet address.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.post('/verify', async (req, res, next) => {
  try {
    const { walletAddress } = req.body || {};

    if (!walletAddress || !isValidStellarAddress(walletAddress)) {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: 'walletAddress must be a valid Stellar public key',
      });
    }

    const { exists } = await verifyTrustline(walletAddress);
    res.json({ success: true, data: { exists } });
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /trustline/build-xdr:
 *   post:
 *     tags: [Trustline]
 *     summary: Build an unsigned changeTrust XDR for the user to sign with Freighter
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
 *     responses:
 *       200:
 *         description: XDR envelope or already_exists status.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     status: { type: string, enum: [pending_signature, already_exists], example: pending_signature }
 *                     xdr: { type: string, nullable: true, example: "AAAAAgAAAAA..." }
 *       400:
 *         description: Invalid wallet address.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.post('/build-xdr', async (req, res, next) => {
  try {
    const { walletAddress } = req.body;

    if (!walletAddress || !isValidStellarAddress(walletAddress)) {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: 'walletAddress must be a valid Stellar public key',
      });
    }

    // Check if trustline already exists — avoid unnecessary XDR building
    const { exists } = await verifyTrustline(walletAddress);
    if (exists) {
      return res.json({
        success: true,
        data: { status: 'already_exists', xdr: null },
      });
    }

    const xdr = await buildTrustlineXDR(walletAddress);
    res.json({ success: true, data: { status: 'pending_signature', xdr } });
  } catch (err) {
    next(err);
  }
});

router.post('/build', async (req, res, next) => {
  try {
    const { walletAddress } = req.body;

    if (!walletAddress || !isValidStellarAddress(walletAddress)) {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: 'walletAddress must be a valid Stellar public key',
      });
    }

    const xdr = await buildTrustlineXDR(walletAddress);
    res.json({ xdr });
  } catch (err) {
    next(err);
  }
});

// Handle JSON parse errors for this router
router.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed' || err instanceof SyntaxError) {
    return res.status(400).json({
      success: false,
      error: 'validation_error',
      message: 'Invalid JSON in request body',
    });
  }
  next(err);
});

module.exports = router;
