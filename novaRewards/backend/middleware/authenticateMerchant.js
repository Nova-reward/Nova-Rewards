'use strict';
const { createHash } = require('crypto');
const { getMerchantByApiKeyHash } = require('../db/merchantRepository');

/**
 * Middleware: validates the merchant API key from the x-api-key header.
 * Hashes the provided key and compares against the stored hash.
 * Attaches the merchant record to req.merchant on success.
 */
async function authenticateMerchant(req, res, next) {
  try {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey) {
      return res.status(401).json({ success: false, error: 'unauthorized', message: 'x-api-key header is required' });
    }

    const apiKeyHash = createHash('sha256').update(apiKey).digest('hex');
    const merchant = await getMerchantByApiKeyHash(apiKeyHash);

    if (!merchant) {
      return res.status(401).json({ success: false, error: 'unauthorized', message: 'Invalid API key' });
    }

    req.merchant = merchant;
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { authenticateMerchant };
