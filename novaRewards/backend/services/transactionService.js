const { server, NOVA, isValidStellarAddress } = require('../../blockchain/stellarService');
const {
  recordTransaction: insertTransaction,
  getTransactionByHash,
  getTransactionsByUser,
  getTransactionHistory,
  processRefund: createRefundTransaction,
  reconcileTransactions: reconcileTransactionRecords,
  getTransactionReport,
} = require('../db/transactionRepository');
const { query } = require('../db/index');
const { getUserById } = require('../db/userRepository');

const TRANSACTION_TYPES = ['distribution', 'redemption', 'transfer', 'refund'];
const MUTABLE_STATUSES = ['pending', 'completed', 'failed', 'refunded', 'reconciled'];
const REPORTABLE_STATUSES = ['pending', 'completed', 'failed', 'refunded', 'reconciled'];

function createError(message, status, code) {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  return err;
}

function parsePositiveInteger(value, fieldName) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw createError(`${fieldName} must be a positive integer`, 400, 'validation_error');
  }

  return parsed;
}

function parsePagination(page, limit) {
  const parsedPage = page === undefined ? 1 : parsePositiveInteger(page, 'page');
  const parsedLimit = limit === undefined ? 20 : parsePositiveInteger(limit, 'limit');

  if (parsedLimit > 100) {
    throw createError('limit must be a positive integer between 1 and 100', 400, 'validation_error');
  }

  return { page: parsedPage, limit: parsedLimit };
}

function parseOptionalDate(value, fieldName, { endOfDay = false } = {}) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw createError(`${fieldName} must be a valid ISO date string`, 400, 'validation_error');
  }

  if (endOfDay && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    parsed.setUTCHours(23, 59, 59, 999);
  }

  return parsed;
}

function parseBoolean(value, fieldName) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (value === 'true') {
    return true;
  }

  if (value === 'false') {
    return false;
  }

  throw createError(`${fieldName} must be either true or false`, 400, 'validation_error');
}

function validateType(value, fieldName = 'type') {
  if (!value) {
    return undefined;
  }

  if (!TRANSACTION_TYPES.includes(value)) {
    throw createError(
      `${fieldName} must be one of: ${TRANSACTION_TYPES.join(', ')}`,
      400,
      'validation_error'
    );
  }

  return value;
}

function validateStatus(value) {
  if (!value) {
    return undefined;
  }

  if (!REPORTABLE_STATUSES.includes(value)) {
    throw createError(
      `status must be one of: ${REPORTABLE_STATUSES.join(', ')}`,
      400,
      'validation_error'
    );
  }

  return value;
}

function validateAmount(amount) {
  if (amount === undefined || amount === null || amount === '') {
    throw createError('amount is required', 400, 'validation_error');
  }

  if (!/^\d+(\.\d{1,7})?$/.test(String(amount))) {
    throw createError('amount must be a positive number with up to 7 decimal places', 400, 'validation_error');
  }

  if (Number(amount) <= 0) {
    throw createError('amount must be greater than zero', 400, 'validation_error');
  }

  return String(amount);
}

function validateWallet(value, fieldName, { required = false } = {}) {
  if (value === undefined || value === null || value === '') {
    if (required) {
      throw createError(`${fieldName} is required`, 400, 'validation_error');
    }
    return null;
  }

  if (!isValidStellarAddress(value)) {
    throw createError(`${fieldName} must be a valid Stellar public key`, 400, 'validation_error');
  }

  return value;
}

function validateMetadata(metadata) {
  if (metadata === undefined || metadata === null) {
    return {};
  }

  if (typeof metadata !== 'object' || Array.isArray(metadata)) {
    throw createError('metadata must be a JSON object', 400, 'validation_error');
  }

  return metadata;
}

function validateDateRange(startDate, endDate) {
  if (startDate && endDate && startDate > endDate) {
    throw createError('startDate must be before or equal to endDate', 400, 'validation_error');
  }
}

async function fetchStellarLedger(txHash) {
  try {
    const txRecord = await server.transactions().transaction(txHash).call();
    return txRecord.ledger_attr || txRecord.ledger || null;
  } catch {
    throw createError('Transaction not found on Stellar network', 400, 'tx_not_found');
  }
}

/**
 * Records a validated transaction after confirming it exists on Stellar.
 *
 * @param {object} payload
 * @returns {Promise<object>}
 */
async function recordTransaction(payload) {
  const txHash = typeof payload.txHash === 'string' ? payload.txHash.trim() : '';
  if (!txHash) {
    throw createError('txHash is required', 400, 'validation_error');
  }

  const txType = validateType(payload.txType, 'txType');
  const amount = validateAmount(payload.amount);
  const fromWallet = validateWallet(payload.fromWallet, 'fromWallet');
  const toWallet = validateWallet(payload.toWallet, 'toWallet');
  const merchantId = parsePositiveInteger(payload.merchantId, 'merchantId');
  const campaignId = parsePositiveInteger(payload.campaignId, 'campaignId');
  const userId = parsePositiveInteger(payload.userId, 'userId');
  const status = payload.status ? validateStatus(payload.status) : 'completed';
  const referenceTxHash = payload.referenceTxHash ? String(payload.referenceTxHash).trim() : null;
  const refundReason = payload.refundReason ? String(payload.refundReason).trim() : null;
  const metadata = validateMetadata(payload.metadata);

  if (txType === 'refund' && !referenceTxHash) {
    throw createError('referenceTxHash is required for refund transactions', 400, 'validation_error');
  }

  const stellarLedger = await fetchStellarLedger(txHash);

  return insertTransaction({
    txHash,
    txType,
    amount,
    fromWallet,
    toWallet,
    merchantId,
    campaignId,
    userId,
    stellarLedger,
    status,
    referenceTxHash,
    refundReason,
    metadata,
  });
}

/**
 * Returns wallet payment history from Horizon with database fallback.
 *
 * @param {string} walletAddress
 * @returns {Promise<{data: object[], source: string}>}
 */
async function getWalletHistory(walletAddress) {
  const validWalletAddress = validateWallet(walletAddress, 'walletAddress', { required: true });

  try {
    const transactions = [];
    let page = await server
      .payments()
      .forAccount(validWalletAddress)
      .order('desc')
      .limit(100)
      .call();

    while (page.records.length > 0) {
      const novaPayments = page.records.filter(
        (record) =>
          record.type === 'payment' &&
          record.asset_code === NOVA.code &&
          record.asset_issuer === NOVA.issuer
      );
      transactions.push(...novaPayments);

      if (transactions.length >= 500) {
        break;
      }

      page = await page.next();
    }

    return { data: transactions, source: 'horizon' };
  } catch {
    const result = await query(
      `SELECT *
       FROM transactions
       WHERE from_wallet = $1 OR to_wallet = $1
       ORDER BY created_at DESC`,
      [validWalletAddress]
    );
    return { data: result.rows, source: 'database' };
  }
}

function buildHistoryOptions(query) {
  const { page, limit } = parsePagination(query.page, query.limit);
  const type = validateType(query.type);
  const status = validateStatus(query.status);
  const startDate = parseOptionalDate(query.startDate, 'startDate');
  const endDate = parseOptionalDate(query.endDate, 'endDate', { endOfDay: true });
  const reconciled = parseBoolean(query.reconciled, 'reconciled');

  validateDateRange(startDate, endDate);

  return {
    type,
    status,
    startDate,
    endDate,
    reconciled,
    page,
    limit,
  };
}

/**
 * Returns paginated transaction history for a user.
 *
 * @param {object} query
 * @returns {Promise<{data: object[], total: number, page: number, limit: number}>}
 */
async function getUserHistory(query) {
  const userId = parsePositiveInteger(query.userId, 'userId');
  if (!userId) {
    throw createError('userId query parameter is required', 400, 'validation_error');
  }

  const user = await getUserById(userId);
  if (!user) {
    throw createError('User not found', 404, 'not_found');
  }

  return getTransactionsByUser(userId, buildHistoryOptions(query));
}

/**
 * Returns paginated transaction history for a merchant.
 *
 * @param {number} merchantId
 * @param {object} query
 * @returns {Promise<{data: object[], total: number, page: number, limit: number}>}
 */
async function getMerchantHistory(merchantId, query) {
  const validMerchantId = parsePositiveInteger(merchantId, 'merchantId');
  return getTransactionHistory({
    merchantId: validMerchantId,
    ...buildHistoryOptions(query),
  });
}

/**
 * Processes a full refund for a merchant-owned transaction.
 *
 * @param {number} merchantId
 * @param {object} payload
 * @returns {Promise<{originalTransaction: object, refundTransaction: object}>}
 */
async function refundTransaction(merchantId, payload) {
  const validMerchantId = parsePositiveInteger(merchantId, 'merchantId');
  const txHash = typeof payload.txHash === 'string' ? payload.txHash.trim() : '';
  const refundTxHash = typeof payload.refundTxHash === 'string' ? payload.refundTxHash.trim() : '';
  const refundReason = typeof payload.reason === 'string' ? payload.reason.trim() : '';
  const metadata = validateMetadata(payload.metadata);

  if (!txHash) {
    throw createError('txHash is required', 400, 'validation_error');
  }

  if (!refundTxHash) {
    throw createError('refundTxHash is required', 400, 'validation_error');
  }

  if (!refundReason) {
    throw createError('reason is required', 400, 'validation_error');
  }

  if (txHash === refundTxHash) {
    throw createError('refundTxHash must be different from txHash', 400, 'validation_error');
  }

  const originalTransaction = await getTransactionByHash(txHash);
  if (!originalTransaction) {
    throw createError('Transaction not found', 404, 'not_found');
  }

  if (originalTransaction.merchant_id !== validMerchantId) {
    throw createError('You may only refund transactions that belong to your account', 403, 'forbidden');
  }

  if (!['completed', 'reconciled'].includes(originalTransaction.status)) {
    throw createError(
      'Only completed or reconciled transactions can be refunded',
      409,
      'invalid_transaction_status'
    );
  }

  const stellarLedger = await fetchStellarLedger(refundTxHash);

  return createRefundTransaction({
    txHash,
    refundTxHash,
    refundReason,
    stellarLedger,
    metadata,
  });
}

/**
 * Reconciles unreconciled merchant transactions matching the supplied filters.
 *
 * @param {number} merchantId
 * @param {object} filters
 * @returns {Promise<{count: number, totalAmount: string, transactions: object[]}>}
 */
async function reconcileMerchantTransactions(merchantId, filters) {
  const validMerchantId = parsePositiveInteger(merchantId, 'merchantId');
  const status = filters.status ? validateStatus(filters.status) : undefined;

  if (status && !MUTABLE_STATUSES.includes(status)) {
    throw createError('status is not eligible for reconciliation', 400, 'validation_error');
  }

  const startDate = parseOptionalDate(filters.startDate, 'startDate');
  const endDate = parseOptionalDate(filters.endDate, 'endDate', { endOfDay: true });
  validateDateRange(startDate, endDate);

  return reconcileTransactionRecords({
    merchantId: validMerchantId,
    status,
    startDate,
    endDate,
  });
}

/**
 * Generates an aggregate report for a merchant's transactions.
 *
 * @param {number} merchantId
 * @param {object} query
 * @returns {Promise<object>}
 */
async function getMerchantTransactionReport(merchantId, query) {
  const validMerchantId = parsePositiveInteger(merchantId, 'merchantId');
  const options = buildHistoryOptions(query);

  return getTransactionReport({
    merchantId: validMerchantId,
    type: options.type,
    status: options.status,
    startDate: options.startDate,
    endDate: options.endDate,
    reconciled: options.reconciled,
  });
}

module.exports = {
  TRANSACTION_TYPES,
  REPORTABLE_STATUSES,
  recordTransaction,
  getWalletHistory,
  getUserHistory,
  getMerchantHistory,
  refundTransaction,
  reconcileMerchantTransactions,
  getMerchantTransactionReport,
};
