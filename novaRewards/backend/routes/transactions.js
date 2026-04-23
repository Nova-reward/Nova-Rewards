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
const { getUserByWallet } = require('../db/userRepository');
const circuitBreakerService = require('../services/circuitBreakerService');
const { logSpan } = require('../middleware/tracingMiddleware');
const { isValidStellarAddress, server, NOVA } = require('../../blockchain/stellarService');
const { query } = require('../db/index');

/**
 * @openapi
 * /transactions/record:
 *   post:
 *     tags: [Transactions]
 *     summary: Verify and record a Stellar transaction
 */
router.post('/record', async (req, res, next) => {
  try {
    const { txHash, txType, amount, fromWallet, toWallet, merchantId, campaignId } = req.body;

    if (!txHash) {
      return res.status(400).json({ success: false, error: 'validation_error', message: 'txHash is required' });
    }

    const validTypes = ['distribution', 'redemption', 'transfer'];
    if (!txType || !validTypes.includes(txType)) {
      return res.status(400).json({ success: false, error: 'validation_error', message: `txType must be one of: ${validTypes.join(', ')}` });
    }

    if (fromWallet && !isValidStellarAddress(fromWallet)) {
      return res.status(400).json({ success: false, error: 'validation_error', message: 'fromWallet must be a valid Stellar public key' });
    }

    if (toWallet && !isValidStellarAddress(toWallet)) {
      return res.status(400).json({ success: false, error: 'validation_error', message: 'toWallet must be a valid Stellar public key' });
    }

    let stellarLedger = null;
    try {
      const txRecord = await circuitBreakerService.execute(
        'horizon_transaction',
        () => server.transactions().transaction(txHash).call(),
        () => { console.warn(`[Horizon] Circuit breaker fallback for txHash=${txHash}`); return { ledger_attr: null }; },
        { retries: 3 }
      );
      stellarLedger = txRecord.ledger_attr || txRecord.ledger;
      logSpan(req, 'horizon_tx_verification', { txHash, success: true });
    } catch (err) {
      logSpan(req, 'horizon_tx_verification', { txHash, success: false, error: err.message });
      return res.status(400).json({ success: false, error: 'tx_not_found', message: 'Transaction not found on Stellar network or Horizon is unavailable' });
    }

    const tx = await recordTransaction({ txHash, txType, amount, fromWallet, toWallet, merchantId: merchantId || null, campaignId: campaignId || null, stellarLedger });
    res.status(201).json({ success: true, data: tx });
  } catch (err) {
    if (err.code === '23505' || err.code === 'duplicate_transaction') {
      return res.status(409).json({ success: false, error: 'duplicate_transaction', message: 'This transaction has already been recorded' });
    }
    next(err);
  }
});

router.get('/merchant-totals', authenticateMerchant, async (req, res, next) => {
  try {
    const totals = await getMerchantTotals(req.merchant.id);
    res.json({ success: true, data: totals });
  } catch (err) { next(err); }
});

router.get('/merchant/history', authenticateMerchant, async (req, res, next) => {
  try {
    const result = await getMerchantHistory(req.merchant.id, req.query);
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
});

router.get('/report', authenticateMerchant, async (req, res, next) => {
  try {
    const report = await getMerchantTransactionReport(req.merchant.id, req.query);
    res.json({ success: true, data: report });
  } catch (err) { next(err); }
});

router.post('/refund', authenticateMerchant, async (req, res, next) => {
  try {
    const result = await refundTransaction(req.merchant.id, req.body);
    res.status(201).json({ success: true, data: result });
  } catch (err) { next(err); }
});

router.post('/reconcile', authenticateMerchant, async (req, res, next) => {
  try {
    const reconciliation = await reconcileMerchantTransactions(req.merchant.id, req.body || {});
    res.json({ success: true, data: reconciliation });
  } catch (err) { next(err); }
});

router.get('/user/history', async (req, res, next) => {
  try {
    const result = await getUserHistory(req.query);
    res.json({ success: true, data: result.data, total: result.total, page: result.page, limit: result.limit });
  } catch (err) { next(err); }
});

router.get('/:walletAddress', async (req, res, next) => {
  try {
    const result = await getWalletHistory(req.params.walletAddress);
    res.json({ success: true, data: result.data, source: result.source });
  } catch (err) { next(err); }
});

module.exports = router;
