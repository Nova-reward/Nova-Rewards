const router = require('express').Router();
const { server, NOVA, isValidStellarAddress } = require('../../blockchain/stellarService');
const { recordTransaction, getTransactionsByMerchant, getMerchantTotals, getTransactionsByUser } = require('../db/transactionRepository');
const { query } = require('../db/index');
const { authenticateMerchant } = require('../middleware/authenticateMerchant');
const { getUserByWallet } = require('../db/userRepository');

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
            r.asset_code === NOVA.code &&
            r.asset_issuer === NOVA.issuer
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

/**
 * GET /api/transactions/user/history
 * Returns paginated transaction history for the authenticated user.
 * Requirements: #180
 */
router.get('/user/history', async (req, res, next) => {
  try {
    const { userId, page = 1, limit = 20, type, startDate, endDate } = req.query;

    // Validate required userId parameter
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: 'userId query parameter is required',
      });
    }

    // Validate userId is a positive integer
    const userIdNum = parseInt(userId, 10);
    if (isNaN(userIdNum) || userIdNum <= 0) {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: 'userId must be a positive integer',
      });
    }

    // Validate page parameter
    const pageNum = parseInt(page, 10);
    if (isNaN(pageNum) || pageNum <= 0) {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: 'page must be a positive integer',
      });
    }

    // Validate limit parameter
    const limitNum = parseInt(limit, 10);
    if (isNaN(limitNum) || limitNum <= 0 || limitNum > 100) {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: 'limit must be a positive integer between 1 and 100',
      });
    }

    // Validate type parameter if provided
    const validTypes = ['distribution', 'redemption', 'transfer'];
    if (type && !validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: `type must be one of: ${validTypes.join(', ')}`,
      });
    }

    // Validate date parameters if provided
    if (startDate && isNaN(Date.parse(startDate))) {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: 'startDate must be a valid ISO date string',
      });
    }

    if (endDate && isNaN(Date.parse(endDate))) {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: 'endDate must be a valid ISO date string',
      });
    }

    // Check if user exists
    const user = await getUserByWallet(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'not_found',
        message: 'User not found',
      });
    }

    // Get paginated transactions
    const result = await getTransactionsByUser(userIdNum, {
      type,
      startDate,
      endDate,
      page: pageNum,
      limit: limitNum,
    });

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
