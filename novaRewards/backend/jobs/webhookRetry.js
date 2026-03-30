/**
 * Webhook Retry Job
 *
 * Polls every minute for failed deliveries whose next_retry_at is due
 * and re-attempts them. Matches the setTimeout-loop pattern used by
 * the dailyLoginBonus job (no external cron dependency).
 */

const { getDueRetries } = require('../db/webhookRepository');
const { attemptDelivery } = require('../services/webhookService');

const POLL_INTERVAL_MS = parseInt(process.env.WEBHOOK_RETRY_INTERVAL_MS) || 60_000;
const MAX_ATTEMPTS     = parseInt(process.env.WEBHOOK_MAX_ATTEMPTS)       || 5;

async function runWebhookRetry() {
  const due = await getDueRetries(MAX_ATTEMPTS);
  if (!due.length) return;

  console.log(`[webhookRetry] retrying ${due.length} failed deliveries`);

  const results = await Promise.allSettled(due.map((d) => attemptDelivery(d)));

  const succeeded = results.filter((r) => r.status === 'fulfilled' && r.value === true).length;
  const failed    = results.length - succeeded;
  console.log(`[webhookRetry] succeeded=${succeeded} failed=${failed}`);
}

function startWebhookRetryJob() {
  const tick = async () => {
    try {
      await runWebhookRetry();
    } catch (err) {
      console.error('[webhookRetry] error:', err.message);
    } finally {
      setTimeout(tick, POLL_INTERVAL_MS);
    }
  };

  setTimeout(tick, POLL_INTERVAL_MS);
  console.log(`[webhookRetry] started, polling every ${POLL_INTERVAL_MS / 1000}s`);
}

module.exports = { runWebhookRetry, startWebhookRetryJob };
