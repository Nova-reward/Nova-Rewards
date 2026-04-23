const { findMerchantByKeyHash, hashKey } = require('../db/apiKeyRepository');

/**
 * Middleware: validates the merchant API key from the x-api-key header.
 * Checks the merchant_api_keys table (hashed). Attaches req.merchant on success.
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

  try {
    const merchant = await findMerchantByKeyHash(hashKey(apiKey));
    if (!merchant) {
      return res.status(401).json({
        success: false,
        error: 'unauthorized',
        message: 'Invalid API key',
      });
    }
    req.merchant = merchant;
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { authenticateMerchant };
