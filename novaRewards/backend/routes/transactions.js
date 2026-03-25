const router = require('express').Router();
const { server, NOVA } = require('../../blockchain/stellarService');
const { recordTransaction, getTransactionsByMerchant, getMerchantTotals } = require('../db/transactionRepository');
const { isValidStellarAddress } = require('../../blockchain/stellarService');
const { query } = require('../db/index');
const { authenticateMerchant } = require('../middleware/authenticateMerchant');

/**
 * POST /api/transactions/record
 * Verifies a Stellar transaction on Horizon then records it in the database.
 * Used for client-signed transactions (redemptions, transfers).
 * Requirements: 4.3, 5.4
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

    // Verify the transaction exists on Horizon before recording
    let stellarLedger = null;
    try {
      const txRecord = await server.transactions().transaction(txHash).call();
      stellarLedger = txRecord.ledger_attr || txRecord.ledger;
    } catch {
      return res.status(400).json({
        success: false,
        error: 'tx_not_found',
        message: 'Transaction not found on Stellar network',
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
    if (err.code === '23505') {
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
 * GET /api/transactions/:walletAddress
 * Returns NOVA transaction history for a wallet.
 * Queries Horizon first; falls back to PostgreSQL if Horizon is unavailable.
 * Requirements: 6.1, 6.4, 6.5
 */
router.get('/:walletAddress', async (req, res, next) => {
  try {
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
      const transactions = [];
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
            r.asset_code === 'NOVA' &&
            r.asset_issuer === process.env.ISSUER_PUBLIC
        );
        transactions.push(...novaPayments);

        // Stop after 500 records to avoid runaway pagination
        if (transactions.length >= 500) break;
        page = await page.next();
      }

      return res.json({ success: true, data: transactions, source: 'horizon' });
    } catch {
      // Horizon unavailable — fall back to PostgreSQL records
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

module.exports = router;

/**
 * GET /api/transactions/merchant-totals
 * Returns total NOVA distributed and redeemed for the authenticated merchant.
 * Requirements: 10.2
 */
router.get('/merchant-totals', authenticateMerchant, async (req, res, next) => {
  try {
    const totals = await getMerchantTotals(req.merchant.id);
    res.json({ success: true, data: totals });
  } catch (err) {
    next(err);
  }
});
