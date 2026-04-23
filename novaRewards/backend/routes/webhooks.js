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
  dispatch,
  attemptDelivery,
} = require('../services/webhookService');

const crypto = require('crypto');
// Assuming we have a global webhook secret for inbound events, or we look it up per merchant. 
// For this issue, we will verify the signature using a shared secret defined in the environment.
const INBOUND_WEBHOOK_SECRET = process.env.INBOUND_WEBHOOK_SECRET || 'test_secret';
// If we had a queue setup, we'd import it. Issue #579 introduces BullMQ queues. 
// We will stub the queue import and use it.
const { Queue } = require('bullmq');
const redisConfig = require('../lib/redis').redisConfig; // assuming redis config is exportable, or just use connection config.
const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
};
const webhookDeliveryQueue = new Queue('webhook-delivery', { connection });

// ---------------------------------------------------------------------------
// POST /api/webhooks/actions  — Inbound webhook from merchant
// ---------------------------------------------------------------------------
router.post('/actions', webhookApiKeyLimiter, async (req, res, next) => {
  try {
    const signature = req.headers['x-signature'] || req.headers['x-hub-signature-256'];
    if (!signature) {
      return res.status(401).json({ success: false, error: 'unauthorized', message: 'Missing signature' });
    }

    const payloadString = JSON.stringify(req.body);
    const expectedSignature = crypto
      .createHmac('sha256', INBOUND_WEBHOOK_SECRET)
      .update(payloadString)
      .digest('hex');

    // Handle different signature formats like "sha256=..." or raw hex
    const providedSig = signature.replace(/^sha256=/, '');
    
    if (expectedSignature !== providedSig) {
      return res.status(401).json({ success: false, error: 'unauthorized', message: 'Invalid signature' });
    }

    const { action, userId, details } = req.body;
    if (!action || !userId) {
      return res.status(400).json({ success: false, error: 'validation_error', message: 'action and userId are required' });
    }

    // Enqueue for async processing
    await webhookDeliveryQueue.add('process-inbound-action', { action, userId, details, timestamp: Date.now() });

    // Store delivery log (for debugging and replay)
    // Here we use createDelivery to log the inbound payload as well
    await createDelivery({
      webhookId: null, // No specific outbound webhook ID
      eventType: 'inbound_action',
      payload: req.body,
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
