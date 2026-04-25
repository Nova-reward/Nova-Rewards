const router = require("express").Router();
const walletService = require("../services/walletService");
const { authenticateUser } = require("../middleware/authenticateUser");

/**
 * Wallet Integration API Routes
 * Provides endpoints for wallet connection, verification, and transaction management
 * Requirements: 8.1, 8.2, 8.3, 8.4
 */

/**
 * GET /api/wallet/supported
 * Returns list of supported wallet types
 * Requirements: 8.1
 */
router.get("/supported", (req, res) => {
  try {
    const supportedWallets = walletService.getSupportedWallets();
    res.json({
      success: true,
      wallets: supportedWallets,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "server_error",
      message: error.message,
    });
  }
});

/**
 * POST /api/wallet/verify
 * Verifies wallet connection and returns wallet information
 * Requirements: 8.2
 */
router.post("/verify", async (req, res) => {
  try {
    const { publicKey, walletType } = req.body;

    if (!publicKey) {
      return res.status(400).json({
        success: false,
        error: "validation_error",
        message: "publicKey is required",
      });
    }

    const result = await walletService.verifyWalletConnection(
      publicKey,
      walletType,
    );

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "server_error",
      message: error.message,
    });
  }
});

/**
 * GET /api/wallet/balances/:publicKey
 * Retrieves balance information for a wallet
 * Requirements: 8.3
 */
router.get("/balances/:publicKey", async (req, res) => {
  try {
    const { publicKey } = req.params;

    const result = await walletService.getBalances(publicKey);

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "server_error",
      message: error.message,
    });
  }
});

/**
 * POST /api/wallet/submit
 * Submits a signed transaction to the Stellar network
 * Requirements: 8.2, 8.4
 */
router.post("/submit", authenticateUser, async (req, res) => {
  try {
    const { signedXDR, metadata } = req.body;

    if (!signedXDR) {
      return res.status(400).json({
        success: false,
        error: "validation_error",
        message: "signedXDR is required",
      });
    }

    const result = await walletService.submitTransaction(signedXDR, metadata);

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "server_error",
      message: error.message,
    });
  }
});

/**
 * GET /api/wallet/history/:publicKey
 * Retrieves transaction history for a wallet
 * Requirements: 8.3
 */
router.get("/history/:publicKey", async (req, res) => {
  try {
    const { publicKey } = req.params;
    const { limit, cursor } = req.query;

    const options = {
      limit: limit ? parseInt(limit) : 100,
      cursor,
    };

    const result = await walletService.getTransactionHistory(
      publicKey,
      options,
    );

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "server_error",
      message: error.message,
    });
  }
});

/**
 * POST /api/wallet/trustline
 * Creates a trustline transaction for NOVA token
 * Requirements: 8.2
 */
router.post("/trustline", authenticateUser, async (req, res) => {
  try {
    const { publicKey, limit } = req.body;

    if (!publicKey) {
      return res.status(400).json({
        success: false,
        error: "validation_error",
        message: "publicKey is required",
      });
    }

    const result = await walletService.createTrustlineTransaction(
      publicKey,
      limit,
    );

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "server_error",
      message: error.message,
    });
  }
});

/**
 * GET /api/wallet/status/:publicKey
 * Gets wallet connection status
 * Requirements: 8.2
 */
router.get("/status/:publicKey", async (req, res) => {
  try {
    const { publicKey } = req.params;

    const status = walletService.getConnectionStatus(publicKey);

    if (status) {
      res.json({
        success: true,
        status: "connected",
        connection: status,
      });
    } else {
      res.json({
        success: true,
        status: "not_connected",
        connection: null,
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "server_error",
      message: error.message,
    });
  }
});

/**
 * POST /api/wallet/activity
 * Updates wallet activity timestamp (for connection tracking)
 * Requirements: 8.2
 */
router.post("/activity", authenticateUser, async (req, res) => {
  try {
    const { publicKey } = req.body;

    if (!publicKey) {
      return res.status(400).json({
        success: false,
        error: "validation_error",
        message: "publicKey is required",
      });
    }

    walletService.updateActivity(publicKey);

    res.json({
      success: true,
      message: "Activity updated",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "server_error",
      message: error.message,
    });
  }
});

/**
 * POST /api/wallet/disconnect
 * Disconnects wallet and cleans up connection data
 * Requirements: 8.2
 */
router.post("/disconnect", authenticateUser, async (req, res) => {
  try {
    const { publicKey } = req.body;

    if (!publicKey) {
      return res.status(400).json({
        success: false,
        error: "validation_error",
        message: "publicKey is required",
      });
    }

    walletService.disconnectWallet(publicKey);

    res.json({
      success: true,
      message: "Wallet disconnected",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "server_error",
      message: error.message,
    });
  }
});

/**
 * POST /api/wallet/validate
 * Validates a Stellar public key format
 * Requirements: 8.1
 */
router.post("/validate", (req, res) => {
  try {
    const { address } = req.body;

    if (!address) {
      return res.status(400).json({
        success: false,
        error: "validation_error",
        message: "address is required",
      });
    }

    const isValid = walletService.validateAddress(address);

    res.json({
      success: true,
      valid: isValid,
      address,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "server_error",
      message: error.message,
    });
  }
});

module.exports = router;
