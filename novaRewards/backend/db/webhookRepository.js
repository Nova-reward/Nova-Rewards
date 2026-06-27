const { query } = require('./index');
const { encrypt, decrypt } = require('../lib/encryption');

// ---------------------------------------------------------------------------
// Encryption helpers for the webhooks.secret column
// ---------------------------------------------------------------------------

/** Encrypts the secret field of a webhook row before persisting. */
function encryptWebhookSecret(secret) {
  return encrypt(secret);
}

/**
 * Decrypts the secret field of a webhook row after reading.
 * Safe to call on already-plaintext values (legacy rows) — decrypt() is
 * a no-op for values that don't look like encrypted blobs.
 */
function decryptWebhookRow(row) {
  if (!row) return row;
  if (row.secret !== undefined && row.secret !== null) {
    row.secret = decrypt(row.secret);
  }
  return row;
}

function decryptWebhookRows(rows) {
  return rows.map(decryptWebhookRow);
}

// ---------------------------------------------------------------------------
// Webhooks
// ---------------------------------------------------------------------------

async function createWebhook({ merchantId, url, secret, events }) {
  const { rows } = await query(
    `INSERT INTO webhooks (merchant_id, url, secret, events)
     VALUES ($1, $2, $3, $4)
     RETURNING id, merchant_id, url, events, is_active, created_at`,
    [merchantId, url, encryptWebhookSecret(secret), events]
  );
  // secret is not returned in the listing query — only on creation via the route
  return rows[0];
}

async function getWebhooksByMerchant(merchantId) {
  const { rows } = await query(
    `SELECT id, merchant_id, url, events, is_active, created_at, updated_at
     FROM webhooks WHERE merchant_id = $1 ORDER BY created_at DESC`,
    [merchantId]
  );
  return rows;
}

async function getWebhookById(id) {
  const { rows } = await query(
    `SELECT * FROM webhooks WHERE id = $1`,
    [id]
  );
  return decryptWebhookRow(rows[0] || null);
}

async function updateWebhook(id, merchantId, { url, events, isActive }) {
  const fields = [];
  const values = [];
  let idx = 1;

  if (url       !== undefined) { fields.push(`url = $${idx++}`);       values.push(url); }
  if (events    !== undefined) { fields.push(`events = $${idx++}`);    values.push(events); }
  if (isActive  !== undefined) { fields.push(`is_active = $${idx++}`); values.push(isActive); }

  if (!fields.length) return getWebhookById(id);

  fields.push(`updated_at = NOW()`);
  values.push(id, merchantId);

  const { rows } = await query(
    `UPDATE webhooks SET ${fields.join(', ')}
     WHERE id = $${idx++} AND merchant_id = $${idx}
     RETURNING id, merchant_id, url, events, is_active, updated_at`,
    values
  );
  return rows[0] || null;
}

async function deleteWebhook(id, merchantId) {
  const { rowCount } = await query(
    `DELETE FROM webhooks WHERE id = $1 AND merchant_id = $2`,
    [id, merchantId]
  );
  return rowCount > 0;
}

/**
 * Returns all active webhooks subscribed to a given event type.
 * Decrypts the secret so it can be used for HMAC signing.
 */
async function getActiveWebhooksForEvent(eventType) {
  const { rows } = await query(
    `SELECT * FROM webhooks
     WHERE is_active = TRUE AND ($1 = ANY(events) OR '*' = ANY(events))`,
    [eventType]
  );
  return decryptWebhookRows(rows);
}

// ---------------------------------------------------------------------------
// Deliveries
// ---------------------------------------------------------------------------

async function createDelivery({ webhookId, eventType, payload }) {
  const { rows } = await query(
    `INSERT INTO webhook_deliveries (webhook_id, event_type, payload)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [webhookId, eventType, JSON.stringify(payload)]
  );
  return rows[0];
}

async function updateDelivery(id, { status, httpStatus, responseBody, nextRetryAt, deliveredAt, attempt }) {
  const { rows } = await query(
    `UPDATE webhook_deliveries
     SET status        = COALESCE($2, status),
         http_status   = COALESCE($3, http_status),
         response_body = COALESCE($4, response_body),
         next_retry_at = $5,
         delivered_at  = $6,
         attempt       = COALESCE($7, attempt)
     WHERE id = $1
     RETURNING *`,
    [id, status, httpStatus, responseBody, nextRetryAt ?? null, deliveredAt ?? null, attempt]
  );
  return rows[0];
}

async function getDeliveriesByWebhook(webhookId, { page = 1, limit = 20 } = {}) {
  const offset = (page - 1) * limit;
  const { rows } = await query(
    `SELECT id, event_type, status, http_status, attempt, delivered_at, created_at
     FROM webhook_deliveries
     WHERE webhook_id = $1
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [webhookId, limit, offset]
  );
  const { rows: countRows } = await query(
    `SELECT COUNT(*) AS total FROM webhook_deliveries WHERE webhook_id = $1`,
    [webhookId]
  );
  return { deliveries: rows, total: parseInt(countRows[0].total) };
}

/**
 * Returns failed deliveries whose next_retry_at is due.
 * Decrypts the webhook secret so it can be used for HMAC signing on retry.
 */
async function getDueRetries(maxAttempts = 5) {
  const { rows } = await query(
    `SELECT d.*, w.url, w.secret
     FROM webhook_deliveries d
     JOIN webhooks w ON w.id = d.webhook_id
     WHERE d.status = 'failed'
       AND d.attempt < $1
       AND d.next_retry_at <= NOW()
       AND w.is_active = TRUE`,
    [maxAttempts]
  );
  return decryptWebhookRows(rows);
}

module.exports = {
  createWebhook,
  getWebhooksByMerchant,
  getWebhookById,
  updateWebhook,
  deleteWebhook,
  getActiveWebhooksForEvent,
  createDelivery,
  updateDelivery,
  getDeliveriesByWebhook,
  getDueRetries,
};
