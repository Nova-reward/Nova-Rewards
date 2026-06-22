'use strict';

const logger = require('../lib/logger');

// ---------------------------------------------------------------------------
// AppError — structured error with code + statusCode
// ---------------------------------------------------------------------------
class AppError extends Error {
  /**
   * @param {string} message   Human-readable description
   * @param {string} code      Machine-readable error code
   * @param {number} statusCode HTTP status code
   */
  constructor(message, code, statusCode = 500) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

// ---------------------------------------------------------------------------
// Downstream-unavailability detection
// Map error signatures from DB (pg), Redis, and Stellar → 503
// ---------------------------------------------------------------------------
const DOWNSTREAM_PATTERNS = [
  /ECONNREFUSED/,
  /ETIMEDOUT/,
  /ENOTFOUND/,
  /connection.*refused/i,
  /connection.*terminated/i,
  /the database system is starting up/i,
  /redis/i,
  /horizon/i,
  /stellarSdk/i,
  /ECONNRESET/,
  /socket hang up/i,
];

function isDownstreamError(err) {
  const msg = err.message || '';
  const code = err.code || '';
  return DOWNSTREAM_PATTERNS.some((p) => p.test(msg) || p.test(code));
}

// ---------------------------------------------------------------------------
// Consistent error response shape
// { error: string, code: string, statusCode: number }
// ---------------------------------------------------------------------------
function sendError(res, statusCode, code, error) {
  return res.status(statusCode).json({ error, code, statusCode });
}

// ---------------------------------------------------------------------------
// 404 catch-all — mount AFTER all routes
// ---------------------------------------------------------------------------
function notFoundHandler(req, res) {
  sendError(res, 404, 'not_found', `Cannot ${req.method} ${req.path}`);
}

// ---------------------------------------------------------------------------
// Global error handler — mount LAST (4-argument signature required)
// ---------------------------------------------------------------------------
// eslint-disable-next-line no-unused-vars
function globalErrorHandler(err, req, res, next) {
  // Already sent? Let Express handle it.
  if (res.headersSent) return next(err);

  // JSON parse errors from express.json()
  if (err.type === 'entity.parse.failed') {
    return sendError(res, 400, 'invalid_json', 'Invalid JSON in request body');
  }

  // AppError — intentional, structured
  if (err instanceof AppError || (err.code && err.statusCode)) {
    logger.warn(err.message, { code: err.code, statusCode: err.statusCode });
    return sendError(res, err.statusCode, err.code, err.message);
  }

  // Downstream service unavailable
  if (isDownstreamError(err)) {
    logger.error('Downstream service unavailable', { message: err.message, stack: err.stack });
    return sendError(res, 503, 'service_unavailable', 'A downstream service is temporarily unavailable');
  }

  // Unhandled / unexpected error
  logger.error(err.message || 'Unhandled error', { stack: err.stack });
  sendError(res, 500, 'internal_error', 'An unexpected error occurred');
}

module.exports = { AppError, globalErrorHandler, notFoundHandler, sendError, isDownstreamError };
