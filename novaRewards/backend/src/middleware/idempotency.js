/**
 * Middleware: extracts and validates the X-Idempotency-Key header.
 * Attaches it to req.idempotencyKey for downstream use.
 * Issue #190 — required on all state-changing redemption requests.
 */
function requireIdempotencyKey(req, res, next) {
  const key = req.headers['x-idempotency-key'];
  if (!key || typeof key !== 'string' || key.trim() === '') {
    return res.status(400).json({
      success: false,
      error: 'missing_idempotency_key',
      message: 'X-Idempotency-Key header is required',
    });
  }
  req.idempotencyKey = key.trim();
  next();
}

module.exports = { requireIdempotencyKey };
