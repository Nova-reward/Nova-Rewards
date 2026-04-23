const router = require('express').Router();
const { getTransactions } = require('../db/transactionRepository');
const { getCampaigns } = require('../db/campaignRepository');

/**
 * @openapi
 * /transactions/history:
 *   get:
 *     tags: [Transactions]
 *     summary: Get paginated transaction history
 *     description: |
 *       Retrieve paginated transaction history with filtering support.
 *       Uses offset-based pagination with 20 transactions per page.
 *     parameters:
 *       - name: userId
 *         in: query
 *         required: true
 *         schema: { type: string }
 *         description: User ID
 *       - name: limit
 *         in: query
 *         schema: { type: integer, default: 20, maximum: 100 }
 *         description: Number of transactions per page
 *       - name: offset
 *         in: query
 *         schema: { type: integer, default: 0 }
 *         description: Number of transactions to skip
 *       - name: type
 *         in: query
 *         schema: { type: string, enum: [issuance, redemption, transfer] }
 *         description: Filter by transaction type
 *       - name: dateFrom
 *         in: query
 *         schema: { type: string, format: date-time }
 *         description: Filter transactions from this date
 *       - name: dateTo
 *         in: query
 *         schema: { type: string, format: date-time }
 *         description: Filter transactions until this date
 *       - name: campaignId
 *         in: query
 *         schema: { type: integer }
 *         description: Filter by campaign ID
 *     responses:
 *       200:
 *         description: Paginated transaction history
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/Transaction' }
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     limit: { type: integer }
 *                     offset: { type: integer }
 *                     total: { type: integer }
 *                     hasMore: { type: boolean }
 *       400:
 *         description: Invalid parameters
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get('/history', async (req, res, next) => {
  try {
    const { userId, limit = 20, offset = 0, type, dateFrom, dateTo, campaignId } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: 'userId is required',
      });
    }

    // Validate pagination parameters
    const parsedLimit = Math.min(Math.max(1, parseInt(limit) || 20), 100);
    const parsedOffset = Math.max(0, parseInt(offset) || 0);

    // Validate transaction type if provided
    const validTypes = ['issuance', 'redemption', 'transfer'];
    if (type && !validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: `Invalid type. Must be one of: ${validTypes.join(', ')}`,
      });
    }

    // Build filter object
    const filters = {
      userId,
      limit: parsedLimit,
      offset: parsedOffset,
    };

    if (type) filters.type = type;
    if (dateFrom) filters.dateFrom = new Date(dateFrom);
    if (dateTo) filters.dateTo = new Date(dateTo);
    if (campaignId) filters.campaignId = parseInt(campaignId);

    // Fetch transactions with filters
    const result = await getTransactions(filters);

    return res.status(200).json({
      success: true,
      data: result.transactions,
      pagination: {
        limit: parsedLimit,
        offset: parsedOffset,
        total: result.total,
        hasMore: parsedOffset + parsedLimit < result.total,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /transactions/stats:
 *   get:
 *     tags: [Transactions]
 *     summary: Get transaction statistics
 *     description: Get aggregated transaction statistics for a user
 *     parameters:
 *       - name: userId
 *         in: query
 *         required: true
 *         schema: { type: string }
 *         description: User ID
 *       - name: dateFrom
 *         in: query
 *         schema: { type: string, format: date-time }
 *       - name: dateTo
 *         in: query
 *         schema: { type: string, format: date-time }
 *     responses:
 *       200:
 *         description: Transaction statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalTransactions: { type: integer }
 *                     totalRewardsIssued: { type: number }
 *                     totalReedemptions: { type: number }
 *                     totalTransfers: { type: number }
 *                     breakdown:
 *                       type: object
 *                       properties:
 *                         byType: { type: object }
 *                         byStatus: { type: object }
 *                         byDate: { type: object }
 */
router.get('/stats', async (req, res, next) => {
  try {
    const { userId, dateFrom, dateTo } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: 'userId is required',
      });
    }

    const filters = { userId };
    if (dateFrom) filters.dateFrom = new Date(dateFrom);
    if (dateTo) filters.dateTo = new Date(dateTo);

    // Aggregate statistics
    const result = await getTransactions({ ...filters, limit: 10000, offset: 0 });
    const transactions = result.transactions;

    const stats = {
      totalTransactions: transactions.length,
      totalRewardsIssued: transactions
        .filter(t => t.type === 'issuance')
        .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0),
      totalRedemptions: transactions
        .filter(t => t.type === 'redemption')
        .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0),
      totalTransfers: transactions
        .filter(t => t.type === 'transfer')
        .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0),
      breakdown: {
        byType: {},
        byStatus: {},
      },
    };

    // Breakdown by type
    validTypes = ['issuance', 'redemption', 'transfer'];
    validTypes.forEach(type => {
      const typeTransactions = transactions.filter(t => t.type === type);
      stats.breakdown.byType[type] = {
        count: typeTransactions.length,
        total: typeTransactions.reduce((sum, t) => sum + parseFloat(t.amount || 0), 0),
      };
    });

    // Breakdown by status
    ['pending', 'confirmed', 'failed'].forEach(status => {
      const statusTransactions = transactions.filter(t => t.status === status);
      stats.breakdown.byStatus[status] = statusTransactions.length;
    });

    return res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /transactions/export/csv:
 *   get:
 *     tags: [Transactions]
 *     summary: Export transaction history as CSV
 *     description: Export filtered transaction history in CSV format
 *     parameters:
 *       - name: userId
 *         in: query
 *         required: true
 *         schema: { type: string }
 *       - name: type
 *         in: query
 *         schema: { type: string }
 *       - name: dateFrom
 *         in: query
 *         schema: { type: string, format: date-time }
 *       - name: dateTo
 *         in: query
 *         schema: { type: string, format: date-time }
 *       - name: campaignId
 *         in: query
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: CSV file
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 *       400:
 *         description: Invalid parameters
 *       401:
 *         description: Unauthorized
 */
router.get('/export/csv', async (req, res, next) => {
  try {
    const { userId, type, dateFrom, dateTo, campaignId } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: 'userId is required',
      });
    }

    const filters = { userId, limit: 10000, offset: 0 };
    if (type) filters.type = type;
    if (dateFrom) filters.dateFrom = new Date(dateFrom);
    if (dateTo) filters.dateTo = new Date(dateTo);
    if (campaignId) filters.campaignId = parseInt(campaignId);

    const result = await getTransactions(filters);
    const transactions = result.transactions;

    // Build CSV content
    const headers = ['Date', 'Type', 'Amount', 'Campaign', 'Status', 'TX Hash', 'Explorer Link'];
    const rows = transactions.map(tx => [
      new Date(tx.createdAt).toISOString(),
      tx.type,
      tx.amount,
      tx.campaign?.name || '',
      tx.status,
      tx.txHash || '',
      tx.txHash ? `https://stellar.expert/explorer/public/tx/${tx.txHash}` : '',
    ]);

    const csv = [
      headers.map(h => `"${h}"`).join(','),
      ...rows.map(row =>
        row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
      ),
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv;charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment;filename=transaction-history-${Date.now()}.csv`
    );
    res.send(csv);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
