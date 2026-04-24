/**
 * Merchant API Key Management
 *
 * POST   /merchants/:id/api-keys          — generate a new key (plaintext returned once)
 * GET    /merchants/:id/api-keys          — list keys (no plaintext)
 * DELETE /merchants/:id/api-keys/:keyId   — revoke a key
 * POST   /merchants/:id/api-keys/rotate   — atomic: generate new + revoke old
 */

const router = require('express').Router({ mergeParams: true });
const { v4: uuidv4 } = require('uuid');
const { authenticateMerchant } = require('../middleware/authenticateMerchant');
const { createApiKey, revokeApiKey, listApiKeys, hashKey } = require('../db/apiKeyRepository');
const { pool } = require('../db/index');

/** Verify the :id param matches the authenticated merchant */
function assertOwner(req, res) {
  if (String(req.merchant.id) !== String(req.params.id)) {
    res.status(403).json({ success: false, error: 'forbidden', message: 'Access denied' });
    return false;
  }
  return true;
}

/** Generate a new API key and return the plaintext exactly once */
router.post('/', authenticateMerchant, async (req, res, next) => {
  try {
    if (!assertOwner(req, res)) return;
    const plaintext = uuidv4().replace(/-/g, '');
    const record = await createApiKey(req.merchant.id, hashKey(plaintext), req.body.label);
    res.status(201).json({ success: true, data: { ...record, key: plaintext } });
  } catch (err) {
    next(err);
  }
});

/** List all keys for the merchant (no plaintext) */
router.get('/', authenticateMerchant, async (req, res, next) => {
  try {
    if (!assertOwner(req, res)) return;
    const keys = await listApiKeys(req.merchant.id);
    res.json({ success: true, data: keys });
  } catch (err) {
    next(err);
  }
});

/** Revoke a specific key */
router.delete('/:keyId', authenticateMerchant, async (req, res, next) => {
  try {
    if (!assertOwner(req, res)) return;
    const revoked = await revokeApiKey(req.params.keyId, req.merchant.id);
    if (!revoked) {
      return res.status(404).json({ success: false, error: 'not_found', message: 'Key not found or already revoked' });
    }
    res.json({ success: true, data: { id: revoked.id, revoked: true } });
  } catch (err) {
    next(err);
  }
});

/**
 * Atomic rotation: generate a new key and revoke the specified old key in one transaction.
 * Body: { oldKeyId: number, label?: string }
 */
router.post('/rotate', authenticateMerchant, async (req, res, next) => {
  const client = await pool.connect();
  try {
    if (!assertOwner(req, res)) return;
    const { oldKeyId, label } = req.body;
    if (!oldKeyId) {
      return res.status(400).json({ success: false, error: 'validation_error', message: 'oldKeyId is required' });
    }

    const plaintext = uuidv4().replace(/-/g, '');
    const merchantId = req.merchant.id;

    await client.query('BEGIN');

    const revoked = await client.query(
      `UPDATE merchant_api_keys
       SET is_active = FALSE, revoked_at = NOW()
       WHERE id = $1 AND merchant_id = $2 AND is_active = TRUE
       RETURNING id`,
      [oldKeyId, merchantId]
    );
    if (!revoked.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'not_found', message: 'Old key not found or already revoked' });
    }

    const newKey = await client.query(
      `INSERT INTO merchant_api_keys (merchant_id, key_hash, label)
       VALUES ($1, $2, $3)
       RETURNING id, merchant_id, label, is_active, created_at`,
      [merchantId, hashKey(plaintext), label || null]
    );

    await client.query('COMMIT');
    res.status(201).json({
      success: true,
      data: { ...newKey.rows[0], key: plaintext, revokedKeyId: revoked.rows[0].id },
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    next(err);
  } finally {
    client.release();
  }
});

module.exports = router;
