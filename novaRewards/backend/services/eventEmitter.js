const { EventEmitter } = require('events');

/**
 * Application-level event bus.
 *
 * Current events:
 *   'redemption.created'  – payload: { redemption, user, reward }
 *
 * Consumers (e.g. the email notification service) attach listeners at startup.
 * Using a singleton so all modules share the same emitter instance.
 */
const appEvents = new EventEmitter();

// Prevent Node from crashing on unhandled emitter errors
appEvents.on('error', (err) => {
  console.error('[appEvents] unhandled error:', err);
});

module.exports = appEvents;
