const router = require('express').Router();
const { isValidStellarAddress } = require('../../blockchain/stellarService');
const { verifyTrustline, buildTrustlineXDR } = require('../../blockchain/trustline');

/**
 * POST /api/trustline/verify
 * Checks whether a wallet has an active NOVA trustline.
 * Requirements: 2.3, 2.4
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
 * POST /api/trustline/build-xdr
 * Builds an unsigned changeTrust XDR for the customer to sign with Freighter.
 * Requirements: 2.1
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
