'use strict';
/**
 * Transaction Export Endpoint
 * GET /api/v1/transactions/export/user     — user-scoped
 * GET /api/v1/transactions/export/merchant — merchant-scoped
 *
 * Exports transactions as CSV or JSON with optional date / campaign filters.
 * Hard limit: 10,000 rows per export.
 */

const router = require('express').Router();
const { query } = require('../db/index');
const { authenticateUser } = require('../middleware/authenticateUser');
const { authenticateMerchant } = require('../middleware/authenticateMerchant');
const { toCSV } = require('../services/reportExporter');
const logger = require('../lib/logger');

const MAX_EXPORT_ROWS = 10_000;

// ---------------------------------------------------------------------------
// Param validation
// ---------------------------------------------------------------------------
function parseExportParams(q) {
  const { format = 'json', start_date, end_date, campaign_id, tx_type } = q;
  const errors = [];

  if (!['csv', 'json'].includes(format)) errors.push('format must be "csv" or "json"');

  let parsedStart = null;
  let parsedEnd = null;

  if (start_date) {
    parsedStart = new Date(start_date);
    if (isNaN(parsedStart.getTime())) errors.push('start_date must be a valid ISO date');
  }
  if (end_date) {
    parsedEnd = new Date(end_date);
    if (isNaN(parsedEnd.getTime())) errors.push('end_date must be a valid ISO date');
  }
  if (parsedStart && parsedEnd && parsedStart > parsedEnd)
    errors.push('start_date must be before end_date');

  const validTxTypes = ['distribution', 'redemption', 'transfer', 'all'];
  if (tx_type && !validTxTypes.includes(tx_type))
    errors.push(`tx_type must be one of: ${validTxTypes.join(', ')}`);

  return {
    format,
    parsedStart,
    parsedEnd,
    campaignId: campaign_id ? parseInt(campaign_id, 10) : null,
    txType: tx_type && tx_type !== 'all' ? tx_type : null,
    errors,
  };
}

// ---------------------------------------------------------------------------
// DB query
// ---------------------------------------------------------------------------
async function fetchTransactions({ walletAddress, merchantId, parsedStart, parsedEnd, campaignId, txType }) {
  const conditions = [];
  const params = [];
  let idx = 1;

  if (walletAddress) {
    conditions.push(`(t.from_wallet = $${idx} OR t.to_wallet = $${idx})`);
    params.push(walletAddress);
    idx++;
  } else if (merchantId) {
    conditions.push(`t.merchant_id = $${idx++}`);
    params.push(merchantId);
  }

  if (parsedStart)  { conditions.push(`t.created_at >= $${idx++}`); params.push(parsedStart.toISOString()); }
  if (parsedEnd)    { conditions.push(`t.created_at <= $${idx++}`); params.push(parsedEnd.toISOString()); }
  if (campaignId)   { conditions.push(`t.campaign_id = $${idx++}`); params.push(campaignId); }
  if (txType)       { conditions.push(`t.tx_type = $${idx++}`);     params.push(txType); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const sql = `
    SELECT t.id, t.tx_hash, t.tx_type, t.amount,
           t.from_wallet, t.to_wallet,
           t.merchant_id, t.campaign_id,
           t.stellar_ledger, t.created_at
    FROM transactions t
    ${where}
    ORDER BY t.created_at DESC
    LIMIT ${MAX_EXPORT_ROWS + 1}
  `;
  const result = await query(sql, params);
  const truncated = result.rows.length > MAX_EXPORT_ROWS;
  return { rows: result.rows.slice(0, MAX_EXPORT_ROWS), truncated };
}

const EMPTY_ROW = { id: '', tx_hash: '', tx_type: '', amount: '', from_wallet: '', to_wallet: '', merchant_id: '', campaign_id: '', stellar_ledger: '', created_at: '' };

function sendExport(res, { rows, truncated, format, filename, filters }) {
  if (format === 'csv') {
    const csv = toCSV(rows.length > 0 ? rows : [EMPTY_ROW]);
    res.set('Content-Type', 'text/csv; charset=utf-8');
    res.set('Content-Disposition', `attachment; filename="${filename}"`);
    if (truncated) res.set('X-Export-Truncated', 'true');
    return res.send(csv);
  }
  return res.json({
    success: true,
    data: { transactions: rows, count: rows.length, truncated, exported_at: new Date().toISOString(), filters },
  });
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

/** @openapi
 * /transactions/export/user:
 *   get:
 *     tags: [Transactions]
 *     summary: Export the authenticated user's transactions
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { name: format,      in: query, schema: { type: string, enum: [json, csv] } }
 *       - { name: start_date,  in: query, schema: { type: string, format: date } }
 *       - { name: end_date,    in: query, schema: { type: string, format: date } }
 *       - { name: campaign_id, in: query, schema: { type: integer } }
 *       - { name: tx_type,     in: query, schema: { type: string, enum: [distribution, redemption, transfer, all] } }
 */
router.get('/export/user', authenticateUser, async (req, res, next) => {
  try {
    const p = parseExportParams(req.query);
    if (p.errors.length) return res.status(400).json({ success: false, error: 'validation_error', message: p.errors.join('; ') });

    const { rows, truncated } = await fetchTransactions({ walletAddress: req.user?.wallet_address, ...p });
    logger.info('[TransactionExport] user', { userId: req.user?.id, format: p.format, count: rows.length, truncated });

    return sendExport(res, { rows, truncated, format: p.format, filename: `transactions-${Date.now()}.csv`, filters: { start_date: p.parsedStart?.toISOString() ?? null, end_date: p.parsedEnd?.toISOString() ?? null, campaign_id: p.campaignId, tx_type: p.txType } });
  } catch (err) { next(err); }
});

/** Merchant-scoped export */
router.get('/export/merchant', authenticateMerchant, async (req, res, next) => {
  try {
    const p = parseExportParams(req.query);
    if (p.errors.length) return res.status(400).json({ success: false, error: 'validation_error', message: p.errors.join('; ') });

    const { rows, truncated } = await fetchTransactions({ merchantId: req.merchant.id, ...p });
    logger.info('[TransactionExport] merchant', { merchantId: req.merchant.id, format: p.format, count: rows.length, truncated });

    return sendExport(res, { rows, truncated, format: p.format, filename: `merchant-transactions-${Date.now()}.csv`, filters: { merchant_id: req.merchant.id, start_date: p.parsedStart?.toISOString() ?? null, end_date: p.parsedEnd?.toISOString() ?? null, campaign_id: p.campaignId, tx_type: p.txType } });
  } catch (err) { next(err); }
});

module.exports = router;
