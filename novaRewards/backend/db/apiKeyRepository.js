const { query } = require('../db/index');
const { createHash } = require('crypto');

async function createApiKey(merchantId, keyHash, label) {
  const result = await query(
    `INSERT INTO merchant_api_keys (merchant_id, key_hash, label)
     VALUES ($1, $2, $3)
     RETURNING id, merchant_id, label, is_active, created_at`,
    [merchantId, keyHash, label || null]
  );
  return result.rows[0];
}

async function revokeApiKey(id, merchantId) {
  const result = await query(
    `UPDATE merchant_api_keys
     SET is_active = FALSE, revoked_at = NOW()
     WHERE id = $1 AND merchant_id = $2 AND is_active = TRUE
     RETURNING id`,
    [id, merchantId]
  );
  return result.rows[0] || null;
}

async function listApiKeys(merchantId) {
  const result = await query(
    `SELECT id, merchant_id, label, is_active, created_at, revoked_at
     FROM merchant_api_keys
     WHERE merchant_id = $1
     ORDER BY created_at DESC`,
    [merchantId]
  );
  return result.rows;
}

async function findMerchantByKeyHash(keyHash) {
  const result = await query(
    `SELECT m.*
     FROM merchants m
     JOIN merchant_api_keys k ON k.merchant_id = m.id
     WHERE k.key_hash = $1 AND k.is_active = TRUE`,
    [keyHash]
  );
  return result.rows[0] || null;
}

function hashKey(plaintext) {
  return createHash('sha256').update(plaintext).digest('hex');
}

module.exports = { createApiKey, revokeApiKey, listApiKeys, findMerchantByKeyHash, hashKey };
