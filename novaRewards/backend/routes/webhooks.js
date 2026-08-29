/**
 * Webhook routes (merchant-scoped)
 *
 * POST   /api/webhooks              — register a webhook
 * GET    /api/webhooks              — list merchant's webhooks
 * PATCH  /api/webhooks/:id          — update url / events / isActive
 * DELETE /api/webhooks/:id          — remove a webhook
 * GET    /api/webhooks/:id/deliveries — delivery log with pagination
 * POST   /api/webhooks/:id/test     — send a test event
 * GET    /api/webhooks/events       — list supported event types
 */

const router = require('express').Router();
const { authenticateMerchant } = require('../middleware/authenticateMerchant');
const { webhookApiKeyLimiter } = require('../middleware/rateLimiter');
const {
  createWebhook,
  getWebhooksByMerchant,
  getWebhookById,
  updateWebhook,
  deleteWebhook,
  getDeliveriesByWebhook,
  createDelivery,
} = require('../db/webhookRepository');
const {
  EVENT_TYPES,
  generateSecret,
  verifySignature,
  dispatch,
  attemptDelivery,
  SIGNATURE_HEADER,
  TIMESTAMP_HEADER,
  DELIVERY_ID_HEADER,
} = require('../services/webhookService');

// Shared secret used to verify inbound webhook requests from external callers.
const INBOUND_WEBHOOK_SECRET = process.env.INBOUND_WEBHOOK_SECRET || 'test_secret';
// If we had a queue setup, we'd import it. Issue #579 introduces BullMQ queues. 
// We will stub the queue import and use it.
const { Queue } = require('bullmq');
const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT, 10) || 6379,
};

// Lazily initialized so the queue connection is only established on first use.
// This prevents Redis connections during module loading (important in test environments).
let _webhookDeliveryQueue = null;
function getDeliveryQueue() {
  if (!_webhookDeliveryQueue) {
    _webhookDeliveryQueue = new Queue('webhook-delivery', { connection });
  }
  return _webhookDeliveryQueue;
}

// ---------------------------------------------------------------------------
// POST /api/webhooks/actions  — Inbound webhook from external caller
// ---------------------------------------------------------------------------
//
// Verifies the request using the shared INBOUND_WEBHOOK_SECRET via
// verifySignature(), which enforces both HMAC-SHA256 integrity and a 5-minute
// timestamp window to prevent replay attacks.
//
// Required headers:
//   x-nova-signature   — HMAC-SHA256 hex digest
//   x-nova-timestamp   — Unix epoch in milliseconds (as a string)
//   x-nova-delivery-id — Unique per-delivery UUID (used in the HMAC input)
// ---------------------------------------------------------------------------
router.post('/actions', webhookApiKeyLimiter, async (req, res, next) => {
  try {
    const receivedSig  = req.headers[SIGNATURE_HEADER];
    const timestamp    = req.headers[TIMESTAMP_HEADER];
    const deliveryId   = req.headers[DELIVERY_ID_HEADER];

    // Missing required security headers → reject immediately
    if (!receivedSig || !timestamp || !deliveryId) {
      return res.status(401).json({
        success: false,
        error:   'unauthorized',
        message: 'Missing required security headers (x-nova-signature, x-nova-timestamp, x-nova-delivery-id)',
      });
    }

    // Raw body must be available for signature verification.
    // We re-serialise req.body as the canonical raw body string.
    const rawBody = JSON.stringify(req.body);

    const valid = verifySignature(INBOUND_WEBHOOK_SECRET, receivedSig, timestamp, deliveryId, rawBody);

    if (!valid) {
      // Distinguish a stale timestamp (replay) from a bad HMAC so the
      // caller gets an actionable error message.
      const ts = parseInt(timestamp, 10);
      const TOLERANCE_MS = 5 * 60 * 1000;
      if (!isNaN(ts) && Math.abs(Date.now() - ts) > TOLERANCE_MS) {
        return res.status(400).json({
          success: false,
          error:   'replay_detected',
          message: 'Replay detected',
        });
      }
      return res.status(401).json({
        success: false,
        error:   'unauthorized',
        message: 'Invalid signature',
      });
    }

    const { action, userId, details } = req.body;
    if (!action || !userId) {
      return res.status(400).json({
        success: false,
        error:   'validation_error',
        message: 'action and userId are required',
      });
    }

    // Enqueue for async processing
    await getDeliveryQueue().add('process-inbound-action', { action, userId, details, timestamp: Date.now() });

    // Log the inbound delivery for audit / debugging
    await createDelivery({
      webhookId: null,   // No outbound webhook ID — this is an inbound event
      eventType: 'inbound_action',
      payload:   req.body,
    });

    res.status(202).json({ success: true, message: 'Event enqueued' });
  } catch (err) {
    next(err);
  }
});

// All other webhook routes are merchant-authenticated
router.use(authenticateMerchant);

// ---------------------------------------------------------------------------
// GET /api/webhooks/events  — must be before /:id routes
// ---------------------------------------------------------------------------
router.get('/events', (req, res) => {
  res.json({ success: true, data: EVENT_TYPES });
});

// ---------------------------------------------------------------------------
// POST /api/webhooks
// ---------------------------------------------------------------------------
router.post('/', async (req, res, next) => {
  try {
    const { url, events } = req.body;

    if (!url || !events?.length) {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: 'url and events[] are required',
      });
    }

    // Validate URL
    try { new URL(url); } catch {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: 'url must be a valid URL',
      });
    }

    // Validate event types
    const invalid = events.filter((e) => !EVENT_TYPES.includes(e));
    if (invalid.length) {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: `Unknown event types: ${invalid.join(', ')}`,
        validEvents: EVENT_TYPES,
      });
    }

    const secret  = generateSecret();
    const webhook = await createWebhook({ merchantId: req.merchant.id, url, secret, events });

    // Return secret only on creation — not stored in plaintext after this
    res.status(201).json({ success: true, data: { ...webhook, secret } });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/webhooks
// ---------------------------------------------------------------------------
router.get('/', async (req, res, next) => {
  try {
    const webhooks = await getWebhooksByMerchant(req.merchant.id);
    res.json({ success: true, data: webhooks });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// PATCH /api/webhooks/:id
// ---------------------------------------------------------------------------
router.patch('/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { url, events, isActive } = req.body;

    if (events) {
      const invalid = events.filter((e) => !EVENT_TYPES.includes(e));
      if (invalid.length) {
        return res.status(400).json({
          success: false,
          error: 'validation_error',
          message: `Unknown event types: ${invalid.join(', ')}`,
        });
      }
    }

    const webhook = await updateWebhook(id, req.merchant.id, { url, events, isActive });
    if (!webhook) {
      return res.status(404).json({ success: false, error: 'not_found', message: 'Webhook not found' });
    }

    res.json({ success: true, data: webhook });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/webhooks/:id
// ---------------------------------------------------------------------------
router.delete('/:id', async (req, res, next) => {
  try {
    const deleted = await deleteWebhook(parseInt(req.params.id, 10), req.merchant.id);
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'not_found', message: 'Webhook not found' });
    }
    res.json({ success: true, message: 'Webhook deleted' });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/webhooks/:id/deliveries
// ---------------------------------------------------------------------------
router.get('/:id/deliveries', async (req, res, next) => {
  try {
    const id      = parseInt(req.params.id, 10);
    const webhook = await getWebhookById(id);

    if (!webhook || webhook.merchant_id !== req.merchant.id) {
      return res.status(404).json({ success: false, error: 'not_found', message: 'Webhook not found' });
    }

    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const { deliveries, total } = await getDeliveriesByWebhook(id, { page, limit });

    res.json({ success: true, data: { deliveries, total, page, limit } });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /api/webhooks/:id/test  — sends a synthetic test event
// ---------------------------------------------------------------------------
router.post('/:id/test', async (req, res, next) => {
  try {
    const id      = parseInt(req.params.id, 10);
    const webhook = await getWebhookById(id);

    if (!webhook || webhook.merchant_id !== req.merchant.id) {
      return res.status(404).json({ success: false, error: 'not_found', message: 'Webhook not found' });
    }

    const testPayload = {
      event:     'test',
      timestamp: new Date().toISOString(),
      data:      { message: 'This is a test event from NovaRewards', webhookId: id },
    };

    const delivery = await createDelivery({
      webhookId: id,
      eventType: 'test',
      payload:   testPayload,
    });

    // Attach url/secret for attemptDelivery
    delivery.url    = webhook.url;
    delivery.secret = webhook.secret;

    const success = await attemptDelivery(delivery);

    res.json({
      success: true,
      data: {
        delivered: success,
        deliveryId: delivery.id,
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
