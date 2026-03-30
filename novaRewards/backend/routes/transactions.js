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
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/transactions/user/history
 * Returns paginated transaction history for the requested user.
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
