/**
 * Structured event logger for Nova Rewards domain events.
 *
 * Keeps an in-memory ring buffer of the last MAX_EVENTS events.
 * Events are also emitted to process stdout as structured JSON so they can
 * be captured by any external log aggregator (CloudWatch, Datadog, etc.).
 *
 * Event types:
 *   reward.distributed   - NOVA tokens sent to a customer wallet
 *   reward.redeemed      - customer redeemed NOVA tokens
 *   transfer.completed   - peer-to-peer NOVA transfer
 *   trustline.created    - customer established a NOVA trustline
 *   trustline.removed    - customer removed a NOVA trustline
 *   campaign.created     - merchant created a campaign
 *   campaign.expired     - campaign passed its end date
 *   merchant.registered  - new merchant registered
 *   error.blockchain     - Stellar / Horizon error
 *   error.application    - unhandled application error
 */

const { v4: uuidv4 } = require('uuid');
const metrics = require('./metricsCollector');

const MAX_EVENTS = 500;

/** @type {object[]} */
let events = [];

// ──────────────────────────────────────────────
// Core log function
// ──────────────────────────────────────────────

/**
 * Record a domain event.
 *
 * @param {string} type    - dot-separated event type (see file header)
 * @param {object} payload - arbitrary structured data
 * @param {'info'|'warn'|'error'} [severity='info']
 * @returns {object} the recorded event
 */
function logEvent(type, payload = {}, severity = 'info') {
  const event = {
    id: uuidv4(),
    type,
    severity,
    timestamp: new Date().toISOString(),
    payload,
  };

  // Ring-buffer — drop oldest when full
  events.push(event);
  if (events.length > MAX_EVENTS) {
    events = events.slice(events.length - MAX_EVENTS);
  }

  // Bump metric counter for this event type
  metrics.increment(`events.${type}`);
  metrics.increment('events.total');

  // Structured stdout log so external aggregators can consume it
  const logLine = JSON.stringify({ level: severity, ...event });
  if (severity === 'error') {
    console.error(logLine);
  } else if (severity === 'warn') {
    console.warn(logLine);
  } else {
    console.log(logLine);
  }

  return event;
}

// ──────────────────────────────────────────────
// Convenience wrappers for each domain event
// ──────────────────────────────────────────────

const log = {
  rewardDistributed: (data) =>
    logEvent('reward.distributed', data, 'info'),

  rewardRedeemed: (data) =>
    logEvent('reward.redeemed', data, 'info'),

  transferCompleted: (data) =>
    logEvent('transfer.completed', data, 'info'),

  trustlineCreated: (data) =>
    logEvent('trustline.created', data, 'info'),

  trustlineRemoved: (data) =>
    logEvent('trustline.removed', data, 'info'),

  campaignCreated: (data) =>
    logEvent('campaign.created', data, 'info'),

  campaignExpired: (data) =>
    logEvent('campaign.expired', data, 'warn'),

  merchantRegistered: (data) =>
    logEvent('merchant.registered', data, 'info'),

  blockchainError: (data) =>
    logEvent('error.blockchain', data, 'error'),

  applicationError: (data) =>
    logEvent('error.application', data, 'error'),
};

// ──────────────────────────────────────────────
// Query helpers
// ──────────────────────────────────────────────

/**
 * Return events, most recent first.
 *
 * @param {object} [options]
 * @param {string}   [options.type]      - filter by exact type
 * @param {string}   [options.severity]  - filter by severity
 * @param {number}   [options.limit=50]  - max results
 * @param {number}   [options.offset=0]
 * @returns {object[]}
 */
function getEvents({ type, severity, limit = 50, offset = 0 } = {}) {
  let result = [...events].reverse(); // newest first

  if (type) result = result.filter((e) => e.type === type);
  if (severity) result = result.filter((e) => e.severity === severity);

  return result.slice(offset, offset + limit);
}

/**
 * Return the total number of stored events (after optional filter).
 *
 * @param {object} [options]
 * @param {string}  [options.type]
 * @param {string}  [options.severity]
 * @returns {number}
 */
function countEvents({ type, severity } = {}) {
  let result = events;
  if (type) result = result.filter((e) => e.type === type);
  if (severity) result = result.filter((e) => e.severity === severity);
  return result.length;
}

/**
 * Clear the event buffer (useful in tests).
 */
function clearEvents() {
  events = [];
}

module.exports = {
  logEvent,
  log,
  getEvents,
  countEvents,
  clearEvents,
};
