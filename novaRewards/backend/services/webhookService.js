/**
 * Webhook Service
 *
 * - HMAC-SHA256 signature generation & verification
 * - HTTP delivery with timeout
 * - Exponential-backoff retry scheduling
 * - Event dispatch to all subscribed webhooks
 */

const crypto = require('crypto');
const https  = require('https');
const http   = require('http');
const {
  getActiveWebhooksForEvent,
  createDelivery,
  updateDelivery,
} = require('../db/webhookRepository');

// ---------------------------------------------------------------------------
// Supported event types
// ---------------------------------------------------------------------------

const EVENT_TYPES = [
  'reward.distributed',
  'reward.redeemed',
  'campaign.created',
  'campaign.updated',
  'campaign.expired',
  'user.registered',
  'user.referral_bonus',
  'drop.claimed',
  'transaction.recorded',
  '*',                        // wildcard — receive all events
];

// ---------------------------------------------------------------------------
// Signature
// ---------------------------------------------------------------------------

const SIGNATURE_HEADER = 'x-nova-signature';
const TIMESTAMP_HEADER = 'x-nova-timestamp';
const TOLERANCE_MS     = 5 * 60 * 1000; // 5 minutes

/**
 * Generates a signing secret (32 random bytes, hex-encoded).
 */
function generateSecret() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Builds the HMAC-SHA256 signature for a payload.
 * Format: HMAC(secret, `${timestamp}.${rawBody}`)
 */
function signPayload(secret, timestamp, rawBody) {
  return crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${rawBody}`)
    .digest('hex');
}

/**
 * Verifies an incoming webhook signature.
 * Returns true if valid and within the replay-attack tolerance window.
 *
 * @param {string} secret
 * @param {string} receivedSig   - value of x-nova-signature header
 * @param {string} timestamp     - value of x-nova-timestamp header
 * @param {string} rawBody       - raw request body string
 */
function verifySignature(secret, receivedSig, timestamp, rawBody) {
  const ts = parseInt(timestamp, 10);
  if (isNaN(ts) || Math.abs(Date.now() - ts) > TOLERANCE_MS) return false;

  const expected = signPayload(secret, timestamp, rawBody);
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, 'hex'),
      Buffer.from(receivedSig, 'hex')
    );
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// HTTP delivery
// ---------------------------------------------------------------------------

const DELIVERY_TIMEOUT_MS = parseInt(process.env.WEBHOOK_TIMEOUT_MS) || 10_000;

/**
 * Sends a single HTTP POST to the webhook URL.
 *
 * @returns {Promise<{ httpStatus: number, responseBody: string }>}
 */
function deliverHttp(url, payload, secret) {
  return new Promise((resolve, reject) => {
    const rawBody  = JSON.stringify(payload);
    const timestamp = String(Date.now());
    const signature = signPayload(secret, timestamp, rawBody);

    const parsed  = new URL(url);
    const options = {
      hostname: parsed.hostname,
      port:     parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path:     parsed.pathname + parsed.search,
      method:   'POST',
      headers: {
        'Content-Type':       'application/json',
        'Content-Length':     Buffer.byteLength(rawBody),
        [TIMESTAMP_HEADER]:   timestamp,
        [SIGNATURE_HEADER]:   signature,
        'User-Agent':         'NovaRewards-Webhook/1.0',
      },
    };

    const transport = parsed.protocol === 'https:' ? https : http;
    const req = transport.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => resolve({ httpStatus: res.statusCode, responseBody: body.slice(0, 1000) }));
    });

    req.setTimeout(DELIVERY_TIMEOUT_MS, () => {
      req.destroy();
      reject(new Error('Webhook delivery timed out'));
    });

    req.on('error', reject);
    req.write(rawBody);
    req.end();
  });
}

// ---------------------------------------------------------------------------
// Retry schedule — exponential backoff: 1m, 5m, 30m, 2h, 8h
// ---------------------------------------------------------------------------

const RETRY_DELAYS_MS = [
  1  * 60 * 1000,
  5  * 60 * 1000,
  30 * 60 * 1000,
  2  * 60 * 60 * 1000,
  8  * 60 * 60 * 1000,
];

function nextRetryAt(attempt) {
  const delay = RETRY_DELAYS_MS[attempt - 1];
  if (!delay) return null;
  return new Date(Date.now() + delay);
}

// ---------------------------------------------------------------------------
// Core delivery logic (used by dispatch and retry job)
// ---------------------------------------------------------------------------

/**
 * Attempts delivery for an existing delivery row.
 * Updates the row with the result.
 */
async function attemptDelivery(delivery) {
  const { id, webhook_id, payload, attempt, url, secret } = delivery;

  try {
    const { httpStatus, responseBody } = await deliverHttp(url, payload, secret);
    const success = httpStatus >= 200 && httpStatus < 300;

    await updateDelivery(id, {
      status:       success ? 'success' : 'failed',
      httpStatus,
      responseBody,
      nextRetryAt:  success ? null : nextRetryAt(attempt + 1),
      deliveredAt:  success ? new Date() : null,
      attempt:      attempt + 1,
    });

    return success;
  } catch (err) {
    await updateDelivery(id, {
      status:      'failed',
      responseBody: err.message,
      nextRetryAt:  nextRetryAt(attempt + 1),
      attempt:      attempt + 1,
    });
    return false;
  }
}

// ---------------------------------------------------------------------------
// Dispatch — fan-out to all subscribed webhooks for an event
// ---------------------------------------------------------------------------

/**
 * Dispatches an event to all active webhooks subscribed to it.
 * Creates delivery rows and fires them concurrently (fire-and-forget safe).
 *
 * @param {string} eventType  - one of EVENT_TYPES
 * @param {object} data       - event payload data
 */
async function dispatch(eventType, data) {
  const webhooks = await getActiveWebhooksForEvent(eventType);
  if (!webhooks.length) return;

  const payload = {
    event:     eventType,
    timestamp: new Date().toISOString(),
    data,
  };

  await Promise.allSettled(
    webhooks.map(async (webhook) => {
      const delivery = await createDelivery({
        webhookId: webhook.id,
        eventType,
        payload,
      });

      // Attach url/secret for attemptDelivery
      delivery.url    = webhook.url;
      delivery.secret = webhook.secret;

      await attemptDelivery(delivery);
    })
  );
}

module.exports = {
  EVENT_TYPES,
  SIGNATURE_HEADER,
  TIMESTAMP_HEADER,
  generateSecret,
  signPayload,
  verifySignature,
  dispatch,
  attemptDelivery,
};
