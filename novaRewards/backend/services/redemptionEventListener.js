const appEvents = require('./eventEmitter');
const { sendRedemptionConfirmation } = require('./emailService');
const notificationService = require('./notificationService');

/**
 * Registers the listener that sends a redemption confirmation email
 * and in-app notification whenever a 'redemption.created' event is emitted.
 *
 * Called once at server startup (server.js).
 * Fire-and-forget: failures are logged but never bubble up to the caller.
 */
function registerRedemptionEventListener() {
  appEvents.on('redemption.created', async ({ redemption, user, reward }) => {
    const recipientEmail = user.email;

    try {
      // In-app + email notification via NotificationService
      await notificationService.send(user.id, 'redemption_confirmed', {
        title: 'Redemption Confirmed',
        message: `Your redemption of ${reward.name} (${redemption.points_spent} points) has been confirmed.`,
        rewardName: reward.name,
        pointsSpent: redemption.points_spent,
        redemptionId: redemption.id,
      });
    } catch (err) {
      console.error('[redemptionEventListener] notification failed:', err.message);
    }

    // Legacy direct email (kept for backward compatibility)
    if (recipientEmail) {
      try {
        await sendRedemptionConfirmation({
          to: recipientEmail,
          userName: user.first_name || user.wallet_address,
          rewardName: reward.name,
          pointsSpent: redemption.points_spent,
          redemptionId: redemption.id,
        });
      } catch (err) {
        console.error('[redemptionEventListener] email send failed:', err.message);
      }
    }
  });
}

module.exports = { registerRedemptionEventListener };
