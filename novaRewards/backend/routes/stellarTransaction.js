const router = require('express').Router();
const { Operation, Asset, Keypair, Memo } = require('stellar-sdk');
const stellarTxService = require('../services/stellarTransactionService');
const { authenticateUser } = require('../middleware/authenticateUser');
const { slidingGlobal } = require('../middleware/rateLimiter');

/**
 * @openapi
 * /transactions/submit:
 *   post:
 *     tags: [Transactions]
 *     summary: Build, sign, and submit a Stellar transaction
 *     description: >
 *       Constructs a transaction from the provided operation parameters,
 *       signs it with the supplied signer secret, and submits to the
 *       Stellar network. Sequence number is fetched fresh from Horizon.
 *       If the transaction is stuck, a fee-bump is automatically attempted.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [sourceAddress, signerSecret, operations]
 *             properties:
 *               sourceAddress:
 *                 type: string
 *                 description: Source account public key
 *               signerSecret:
 *                 type: string
 *                 description: Secret key of the signing account
 *               operations:
 *                 type: array
 *                 description: Array of operation descriptors
 *                 items:
 *                   type: object
 *                   required: [type]
 *                   properties:
 *                     type:
 *                       type: string
 *                       enum: [payment, changeTrust, createAccount, accountMerge, manageData]
 *                     destination:
 *                       type: string
 *                     assetCode:
 *                       type: string
 *                     assetIssuer:
 *                       type: string
 *                     amount:
 *                       type: string
 *                     startingBalance:
 *                       type: string
 *                     limit:
 *                       type: string
 *                     name:
 *                       type: string
 *                     value:
 *                       type: string
 *               timeout:
 *                 type: number
 *                 default: 180
 *               memo:
 *                 type: string
 *               feeSourceSecret:
 *                 type: string
 *                 description: Secret key for fee-bump fee source
 *               txType:
 *                 type: string
 *                 default: transfer
 *               amount:
 *                 type: string
 *               fromWallet:
 *                 type: string
 *               toWallet:
 *                 type: string
 *               merchantId:
 *                 type: integer
 *               campaignId:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Transaction submitted successfully.
 *       400:
 *         description: Validation or submission error.
 *       401:
 *         description: Unauthorized.
 */
router.post('/submit', authenticateUser, async (req, res, next) => {
  try {
    const {
      sourceAddress,
      signerSecret,
      operations: operationDescriptors,
      timeout,
      memo,
      feeSourceSecret,
      txType,
      amount,
      fromWallet,
      toWallet,
      merchantId,
      campaignId,
    } = req.body;

    // --- Validation ---
    if (!sourceAddress) {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: 'sourceAddress is required',
      });
    }

    if (!signerSecret) {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: 'signerSecret is required',
      });
    }

    if (!operationDescriptors || !Array.isArray(operationDescriptors) || operationDescriptors.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: 'operations must be a non-empty array',
      });
    }

    // Build Stellar operations from descriptors
    const operations = buildOperations(operationDescriptors);
    const signers = [Keypair.fromSecret(signerSecret)];

    const result = await stellarTxService.submit({
      sourceAddress,
      operations,
      signers,
      options: {
        timeout,
        memo,
        feeSourceSecret,
        txType,
        amount,
        fromWallet,
        toWallet,
        merchantId,
        campaignId,
        userId: req.user?.id,
      },
    });

    return res.json({
      success: true,
      data: {
        txHash: result.txHash,
        ledger: result.ledger,
        status: result.status,
        resultXdr: result.resultXdr,
      },
    });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({
        success: false,
        error: err.code || 'submission_error',
        message: err.message,
      });
    }
    next(err);
  }
});

/**
 * @openapi
 * /transactions/fee-bump:
 *   post:
 *     tags: [Transactions]
 *     summary: Submit a fee-bump transaction for a stuck transaction
 *     description: >
 *       Wraps an existing signed transaction in a fee-bump envelope
 *       and submits it to the Stellar network.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [innerTxXDR, feeSourceSecret]
 *             properties:
 *               innerTxXDR:
 *                 type: string
 *                 description: XDR of the original (stuck) signed transaction
 *               feeSourceSecret:
 *                 type: string
 *                 description: Secret key of the account paying the higher fee
 *               baseFee:
 *                 type: string
 *                 description: Custom base fee (default: 2x network base fee)
 *     responses:
 *       200:
 *         description: Fee-bump transaction submitted.
 *       400:
 *         description: Validation or submission error.
 *       401:
 *         description: Unauthorized.
 */
router.post('/fee-bump', authenticateUser, async (req, res, next) => {
  try {
    const { innerTxXDR, feeSourceSecret, baseFee } = req.body;

    if (!innerTxXDR) {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: 'innerTxXDR is required',
      });
    }

    if (!feeSourceSecret) {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: 'feeSourceSecret is required',
      });
    }

    const result = await stellarTxService.submitFeeBump({
      innerTxXDR,
      feeSourceSecret,
      baseFee,
    });

    return res.json({
      success: true,
      data: {
        txHash: result.txHash,
        ledger: result.ledger,
        status: result.status,
        resultXdr: result.resultXdr,
      },
    });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({
        success: false,
        error: err.code || 'fee_bump_error',
        message: err.message,
      });
    }
    next(err);
  }
});

/**
 * @openapi
 * /transactions/sequence/:publicKey:
 *   get:
 *     tags: [Transactions]
 *     summary: Get current sequence number for a Stellar account
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: publicKey
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Sequence number returned.
 */
router.get('/sequence/:publicKey', authenticateUser, async (req, res, next) => {
  try {
    const { publicKey } = req.params;
    const sequence = await stellarTxService.getSequenceNumber(publicKey);

    return res.json({
      success: true,
      data: { publicKey, sequence },
    });
  } catch (err) {
    if (err.response?.status === 404 || err.message?.toLowerCase().includes('not found')) {
      return res.status(404).json({
        success: false,
        error: 'account_not_found',
        message: 'Account not found on Stellar network',
      });
    }
    next(err);
  }
});

// ---------------------------------------------------------------------------
// Operation builder
// ---------------------------------------------------------------------------

/**
 * Converts operation descriptor objects into Stellar SDK Operation instances.
 */
function buildOperations(descriptors) {
  return descriptors.map((desc) => {
    switch (desc.type) {
      case 'payment': {
        const asset = buildAsset(desc.assetCode, desc.assetIssuer);
        return Operation.payment({
          destination: desc.destination,
          asset,
          amount: String(desc.amount),
        });
      }
      case 'changeTrust': {
        const asset = buildAsset(desc.assetCode, desc.assetIssuer);
        return Operation.changeTrust({
          asset,
          limit: desc.limit || undefined,
        });
      }
      case 'createAccount': {
        return Operation.createAccount({
          destination: desc.destination,
          startingBalance: String(desc.startingBalance || '1'),
        });
      }
      case 'accountMerge': {
        return Operation.accountMerge({
          destination: desc.destination,
        });
      }
      case 'manageData': {
        return Operation.manageData({
          name: desc.name,
          value: desc.value,
        });
      }
      default:
        throw Object.assign(
          new Error(`Unsupported operation type: ${desc.type}`),
          { status: 400, code: 'validation_error' },
        );
    }
  });
}

/**
 * Builds a Stellar Asset from code and issuer. Returns native if no code provided.
 */
function buildAsset(code, issuer) {
  if (!code || code === 'XLM' || code === 'native') {
    return Asset.native();
  }
  if (!issuer) {
    throw Object.assign(
      new Error(`assetIssuer is required for non-native asset: ${code}`),
      { status: 400, code: 'validation_error' },
    );
  }
  return new Asset(code, issuer);
}

module.exports = router;
