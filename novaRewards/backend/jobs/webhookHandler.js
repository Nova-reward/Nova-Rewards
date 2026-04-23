const { Worker } = require('bullmq');
const { recordPointTransaction } = require('../db/pointTransactionRepository');
const AuditService = require('../services/auditService');

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
        console.warn(`[webhookHandler] Unrecognized action type: ${action}`);
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

      console.log(`[webhookHandler] Successfully processed action: ${action} for user ${userId}. Awarded ${amountToAward} points.`);
      return { handled: true, transactionId: tx.id };
    } catch (error) {
      console.error(`[webhookHandler] Failed to process action ${action} for user ${userId}:`, error.message);
      throw error;
    }
  }

  // Handle outbound webhook deliveries if this queue is shared (as implemented previously)
  // Or do nothing if handled by attemptDelivery elsewhere
}, { connection: redisConfig });

webhookWorker.on('failed', (job, err) => {
  console.error(`[webhookHandler] Job ${job.id} failed:`, err.message);
});

module.exports = webhookWorker;
