const router = require('express').Router();
const { authenticateMerchant } = require('../middleware/authenticateMerchant');
const { getMerchantTotals } = require('../db/transactionRepository');
const {
  recordTransaction,
  getWalletHistory,
  getUserHistory,
  getMerchantHistory,
  refundTransaction,
  reconcileMerchantTransactions,
  getMerchantTransactionReport,
} = require('../services/transactionService');

/**
 * POST /api/transactions/record
 * Verifies a Stellar transaction on Horizon, validates the payload,
 * and stores the canonical database record.
 */
router.post('/record', async (req, res, next) => {
  try {
    const transaction = await recordTransaction(req.body);
    res.status(201).json({ success: true, data: transaction });
const { getUserByWallet } = require('../db/userRepository');
const circuitBreakerService = require('../services/circuitBreakerService');
const { logSpan } = require('../middleware/tracingMiddleware');

/**
 * @openapi
 * /transactions/record:
 *   post:
 *     tags: [Transactions]
 *     summary: Verify and record a Stellar transaction
 *     description: Verifies the transaction exists on Horizon then persists it in the database.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [txHash, txType]
 *             properties:
 *               txHash:
 *                 type: string
 *                 example: a1b2c3d4e5f6789abcdef0123456789abcdef0123456789abcdef0123456789
 *               txType:
 *                 type: string
 *                 enum: [distribution, redemption, transfer]
 *                 example: distribution
 *               amount:
 *                 type: number
 *                 example: 50
 *               fromWallet:
 *                 type: string
 *                 example: GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN
 *               toWallet:
 *                 type: string
 *                 example: GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5
 *               merchantId:
 *                 type: integer
 *                 example: 7
 *               campaignId:
 *                 type: integer
 *                 example: 3
 *     responses:
 *       201:
 *         description: Transaction recorded.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { $ref: '#/components/schemas/Transaction' }
 *       400:
 *         description: Validation error or transaction not found on Stellar.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       409:
 *         description: Transaction already recorded.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.post('/record', async (req, res, next) => {
  try {
    const { txHash, txType, amount, fromWallet, toWallet, merchantId, campaignId } = req.body;

    if (!txHash) {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: 'txHash is required',
      });
    }

    const validTypes = ['distribution', 'redemption', 'transfer'];
    if (!txType || !validTypes.includes(txType)) {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: `txType must be one of: ${validTypes.join(', ')}`,
      });
    }

    if (fromWallet && !isValidStellarAddress(fromWallet)) {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: 'fromWallet must be a valid Stellar public key',
      });
    }

    if (toWallet && !isValidStellarAddress(toWallet)) {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: 'toWallet must be a valid Stellar public key',
      });
    }

    // Verify the transaction exists on Horizon before recording
    let stellarLedger = null;
    try {
      const txRecord = await circuitBreakerService.execute(
        'horizon_transaction',
        () => server.transactions().transaction(txHash).call(),
        () => {
          console.warn(`[Horizon] Circuit breaker executing fallback for txHash=${txHash}`);
          return { ledger_attr: null }; // Minimal valid object for recording with warnings
        },
        { retries: 3 }
      );
      stellarLedger = txRecord.ledger_attr || txRecord.ledger;
      logSpan(req, 'horizon_tx_verification', { txHash, success: true });
    } catch (err) {
      logSpan(req, 'horizon_tx_verification', { txHash, success: false, error: err.message });
      return res.status(400).json({
        success: false,
        error: 'tx_not_found',
        message: 'Transaction not found on Stellar network or Horizon is unavailable',
      });
    }

    const tx = await recordTransaction({
      txHash,
      txType,
      amount,
      fromWallet,
      toWallet,
      merchantId: merchantId || null,
      campaignId: campaignId || null,
      stellarLedger,
    });

    res.status(201).json({ success: true, data: tx });
  } catch (err) {
    if (err.code === '23505' || err.code === 'duplicate_transaction') {
      return res.status(409).json({
        success: false,
        error: 'duplicate_transaction',
        message: 'This transaction has already been recorded',
      });
    }

    next(err);
  }
});

/**
 * GET /api/transactions/merchant-totals
 * Returns total distributed and redeemed amounts for the authenticated merchant.
 * @openapi
 * /transactions/merchant-totals:
 *   get:
 *     tags: [Transactions]
 *     summary: Get total NOVA distributed and redeemed for the authenticated merchant
 *     security:
 *       - merchantApiKey: []
 *     responses:
 *       200:
 *         description: Merchant totals.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     total_distributed: { type: number, example: 12500 }
 *                     total_redeemed: { type: number, example: 3200 }
 *       401:
 *         description: Missing or invalid API key.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.get('/merchant-totals', authenticateMerchant, async (req, res, next) => {
  try {
    const totals = await getMerchantTotals(req.merchant.id);
    res.json({ success: true, data: totals });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/transactions/merchant/history
 * Returns paginated transaction history for the authenticated merchant.
 * @openapi
 * /transactions/{walletAddress}:
 *   get:
 *     tags: [Transactions]
 *     summary: Get NOVA transaction history for a wallet
 *     description: Queries Horizon first; falls back to PostgreSQL if Horizon is unavailable.
 *     parameters:
 *       - in: path
 *         name: walletAddress
 *         required: true
 *         schema: { type: string, example: GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5 }
 *     responses:
 *       200:
 *         description: Transaction list.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/Transaction' }
 *                 source: { type: string, enum: [horizon, database], example: horizon }
 *       400:
 *         description: Invalid wallet address.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.get('/merchant/history', authenticateMerchant, async (req, res, next) => {
  try {
    const result = await getMerchantHistory(req.merchant.id, req.query);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/transactions/report
 * Returns aggregate reporting data for the authenticated merchant.
 */
router.get('/report', authenticateMerchant, async (req, res, next) => {
  try {
    const report = await getMerchantTransactionReport(req.merchant.id, req.query);
    res.json({ success: true, data: report });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/transactions/refund
 * Processes a full refund for an existing merchant transaction.
 */
router.post('/refund', authenticateMerchant, async (req, res, next) => {
  try {
    const result = await refundTransaction(req.merchant.id, req.body);
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/transactions/reconcile
 * Marks matching merchant transactions as reconciled.
 */
router.post('/reconcile', authenticateMerchant, async (req, res, next) => {
  try {
    const reconciliation = await reconcileMerchantTransactions(req.merchant.id, req.body || {});
    res.json({ success: true, data: reconciliation });
    const { walletAddress } = req.params;

    if (!isValidStellarAddress(walletAddress)) {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: 'walletAddress must be a valid Stellar public key',
      });
    }

    try {
      // Fetch all NOVA payments from Horizon with pagination
      const transactions = await circuitBreakerService.execute(
        'horizon_payments',
        async () => {
          const results = [];
          let page = await server
            .payments()
            .forAccount(walletAddress)
            .order('desc')
            .limit(100)
            .call();

          while (page.records.length > 0) {
            const novaPayments = page.records.filter(
              (r) =>
                r.type === 'payment' &&
                r.asset_code === NOVA.code &&
                r.asset_issuer === NOVA.issuer
            );
            results.push(...novaPayments);

            // Stop after 500 records to avoid runaway pagination
            if (results.length >= 500) break;
            page = await page.next();
          }
          return results;
        }
      );

      logSpan(req, 'horizon_payments_fetch', { walletAddress, success: true });
      return res.json({ success: true, data: transactions, source: 'horizon' });
    } catch (err) {
      // Horizon unavailable — fall back to PostgreSQL records
      logSpan(req, 'horizon_payments_fetch', { walletAddress, success: false, error: err.message, fallback: true });
      const result = await query(
        `SELECT * FROM transactions
         WHERE from_wallet = $1 OR to_wallet = $1
         ORDER BY created_at DESC`,
        [walletAddress]
      );
      return res.json({ success: true, data: result.rows, source: 'database' });
    }
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/transactions/user/history
 * Returns paginated transaction history for the requested user.
 * @openapi
 * /transactions/user/history:
 *   get:
 *     tags: [Transactions]
 *     summary: Paginated transaction history for a user
 *     parameters:
 *       - in: query
 *         name: userId
 *         required: true
 *         schema: { type: integer, example: 42 }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1, example: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 100, example: 20 }
 *       - in: query
 *         name: type
 *         schema: { type: string, enum: [distribution, redemption, transfer] }
 *       - in: query
 *         name: startDate
 *         schema: { type: string, format: date, example: "2025-01-01" }
 *       - in: query
 *         name: endDate
 *         schema: { type: string, format: date, example: "2025-12-31" }
 *     responses:
 *       200:
 *         description: Paginated transaction history.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/Transaction' }
 *                 total: { type: integer, example: 85 }
 *                 page: { type: integer, example: 1 }
 *                 limit: { type: integer, example: 20 }
 *       400:
 *         description: Validation error.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       404:
 *         description: User not found.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.get('/user/history', async (req, res, next) => {
  try {
    const result = await getUserHistory(req.query);
    res.json({
      success: true,
      data: result.data,
      total: result.total,
      page: result.page,
      limit: result.limit,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/transactions/:walletAddress
 * Returns NOVA transaction history for a wallet, preferring Horizon.
 */
router.get('/:walletAddress', async (req, res, next) => {
  try {
    const result = await getWalletHistory(req.params.walletAddress);
    res.json({ success: true, data: result.data, source: result.source });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
