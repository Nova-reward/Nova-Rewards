const { query } = require('../db/index');

/**
 * Middleware: validates the merchant API key from the x-api-key header.
 * Attaches the merchant record to req.merchant on success.
 * Requirements: 3.1
 */
async function authenticateMerchant(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey) {
    return res.status(401).json({
      success: false,
      error: 'unauthorized',
      message: 'x-api-key header is required',
    });
  }

  const result = await query(
    'SELECT * FROM merchants WHERE api_key = $1',
    [apiKey]
  );

  if (!result.rows[0]) {
    return res.status(401).json({
      success: false,
      error: 'unauthorized',
      message: 'Invalid API key',
    });
  }

  req.merchant = result.rows[0];
  next();
}

module.exports = { authenticateMerchant };
