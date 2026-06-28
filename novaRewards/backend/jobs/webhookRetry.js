/**
 * Webhook Retry Job
 *
 * Polls every minute for failed deliveries whose next_retry_at is due
 * and re-attempts them. Matches the setTimeout-loop pattern used by
 * the dailyLoginBonus job (no external cron dependency).
 */

const { getDueRetries } = require('../db/webhookRepository');
const { attemptDelivery } = require('../services/webhookService');
const logger = require('../lib/logger');

const POLL_INTERVAL_MS = parseInt(process.env.WEBHOOK_RETRY_INTERVAL_MS) || 60_000;
const MAX_ATTEMPTS     = parseInt(process.env.WEBHOOK_MAX_ATTEMPTS)       || 5;

async function runWebhookRetry() {
  const due = await getDueRetries(MAX_ATTEMPTS);
  if (!due.length) return;

  logger.info('[webhookRetry] retrying failed deliveries', { count: due.length });

  const results = await Promise.allSettled(due.map((d) => attemptDelivery(d)));

  const succeeded = results.filter((r) => r.status === 'fulfilled' && r.value === true).length;
  const failed    = results.length - succeeded;
  logger.info('[webhookRetry] retry cycle complete', { succeeded, failed });
}

function startWebhookRetryJob() {
  const tick = async () => {
    try {
      await runWebhookRetry();
    } catch (err) {
      logger.error('[webhookRetry] error', { error: err.message });
    } finally {
      setTimeout(tick, POLL_INTERVAL_MS);
    }
  };

  setTimeout(tick, POLL_INTERVAL_MS);
  logger.info('[webhookRetry] started', { pollIntervalSec: POLL_INTERVAL_MS / 1000 });
}

module.exports = { runWebhookRetry, startWebhookRetryJob };
