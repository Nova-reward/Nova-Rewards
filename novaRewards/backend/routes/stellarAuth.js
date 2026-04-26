const router = require('express').Router();
const stellarAuthService = require('../services/stellarAuthService');
const { slidingAuth } = require('../middleware/rateLimiter');

/**
 * @openapi
 * /auth/challenge:
 *   post:
 *     tags: [Auth]
 *     summary: Request a challenge nonce for wallet-based authentication
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
 *                 description: Stellar Ed25519 public key (G...)
 *                 example: "GABC..."
 *     responses:
 *       200:
 *         description: Challenge nonce generated.
 *       400:
 *         description: Invalid wallet address.
 */
router.post('/challenge', slidingAuth, async (req, res, next) => {
  try {
    const { walletAddress } = req.body;

    if (!walletAddress) {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: 'walletAddress is required',
      });
    }

    const { nonce, expiresAt } = await stellarAuthService.createChallenge(walletAddress);

    return res.json({
      success: true,
      data: {
        walletAddress,
        nonce,
        expiresAt,
        message: stellarAuthService._buildChallengeMessage(walletAddress, nonce),
      },
    });
  } catch (err) {
    if (err.status === 400) {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: err.message,
      });
    }
    next(err);
  }
});

/**
 * @openapi
 * /auth/verify:
 *   post:
 *     tags: [Auth]
 *     summary: Verify a signed challenge and obtain a JWT
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [walletAddress, signedChallenge]
 *             properties:
 *               walletAddress:
 *                 type: string
 *                 description: Stellar Ed25519 public key
 *               signedChallenge:
 *                 type: string
 *                 description: Base64-encoded signature of the challenge message
 *     responses:
 *       200:
 *         description: Authentication successful, JWT returned.
 *       401:
 *         description: Invalid or expired challenge / invalid signature.
 */
router.post('/verify', slidingAuth, async (req, res, next) => {
  try {
    const { walletAddress, signedChallenge } = req.body;

    if (!walletAddress) {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: 'walletAddress is required',
      });
    }

    if (!signedChallenge) {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: 'signedChallenge is required',
      });
    }

    const result = await stellarAuthService.verifyChallenge(walletAddress, signedChallenge);

    return res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    if (err.status === 401) {
      return res.status(401).json({
        success: false,
        error: err.code || 'unauthorized',
        message: err.message,
      });
    }
    if (err.status === 400) {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: err.message,
      });
    }
    next(err);
  }
});

module.exports = router;
