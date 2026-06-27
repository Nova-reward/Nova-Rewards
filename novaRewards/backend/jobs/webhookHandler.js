const { Worker } = require('bullmq');
const { recordPointTransaction } = require('../db/pointTransactionRepository');
const AuditService = require('../services/auditService');
const logger = require('../lib/logger');

const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
};

// Start a worker to process inbound webhooks (and other webhook deliveries)
const webhookWorker = new Worker('webhook-delivery', async (job) => {
  if (job.name === 'process-inbound-action') {
    const { action, userId, details, timestamp } = job.data;

    // Based on the action, we issue points via the reward engine
    let amountToAward = 0;
    
    switch (action) {
      case 'purchase':
        amountToAward = 100; // Example mapping
        break;
      case 'sign-up':
        amountToAward = 500;
        break;
      case 'referral':
        amountToAward = 200;
        break;
      default:
        logger.warn('[webhookHandler] unrecognized action type', { action });
        return { handled: false, reason: 'unrecognized_action' };
    }

    try {
      // Record the point transaction
      const tx = await recordPointTransaction({
        userId,
        type: 'earned',
        amount: amountToAward,
        description: `Awarded points for external action: ${action}`,
      });

      // Audit log the issuance
      await AuditService.log({
        entityType: 'point_transaction',
        entityId: tx.id,
        action: 'WEBHOOK_REWARD_ISSUANCE',
        performedBy: null, // System action
        afterState: tx,
        source: 'webhook_handler',
        details: { externalAction: action, originalDetails: details, timestamp }
      });

      logger.info('[webhookHandler] action processed', { action, userId, awardedPoints: amountToAward });
      return { handled: true, transactionId: tx.id };
    } catch (error) {
      logger.error('[webhookHandler] failed to process action', { action, userId, error: error.message });
      throw error;
    }
  }

  // Handle outbound webhook deliveries if this queue is shared (as implemented previously)
  // Or do nothing if handled by attemptDelivery elsewhere
}, { connection: redisConfig });

webhookWorker.on('failed', (job, err) => {
  logger.error('[webhookHandler] job failed', { jobId: job.id, error: err.message });
});

module.exports = webhookWorker;
