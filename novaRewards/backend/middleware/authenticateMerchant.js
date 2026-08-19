'use strict';
const { createHash, timingSafeEqual } = require('crypto');
const merchantRepo = require('../db/merchantRepository');

/**
 * Middleware: validates the merchant API key from the x-api-key header.
 * Hashes the provided key and compares against the stored hash using timing-safe comparison.
 * Attaches the merchant record to req.merchant on success.
 */
async function authenticateMerchant(req, res, next) {
  try {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey || typeof apiKey !== 'string') {
      return res.status(401).json({ success: false, error: 'unauthorized', message: 'x-api-key header is required' });
    }

    const apiKeyHash = createHash('sha256').update(apiKey).digest('hex');
    const merchant = await merchantRepo.getMerchantByApiKeyHash(apiKeyHash);

    if (!merchant || !merchant.api_key) {
      return res.status(401).json({ success: false, error: 'unauthorized', message: 'Invalid API key' });
    }

    const computedBuffer = Buffer.from(apiKeyHash, 'utf8');
    const storedBuffer = Buffer.from(merchant.api_key, 'utf8');

    if (computedBuffer.length !== storedBuffer.length || !timingSafeEqual(computedBuffer, storedBuffer)) {
      return res.status(401).json({ success: false, error: 'unauthorized', message: 'Invalid API key' });
    }

    req.merchant = merchant;
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { authenticateMerchant };
