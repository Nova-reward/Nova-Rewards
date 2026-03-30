const appEvents = require('./eventEmitter');
const { sendRedemptionConfirmation } = require('./emailService');

/**
 * Registers the listener that sends a redemption confirmation email
 * whenever a 'redemption.created' event is emitted.
 *
 * Called once at server startup (server.js).
 * Fire-and-forget: email failures are logged but never bubble up to the caller.
 */
function registerRedemptionEventListener() {
  appEvents.on('redemption.created', async ({ redemption, user, reward }) => {
    // Only attempt email if the user has an email address on file
    const recipientEmail = user.email;
    if (!recipientEmail) return;

    try {
      await sendRedemptionConfirmation({
        to: recipientEmail,
        userName: user.first_name || user.wallet_address,
        rewardName: reward.name,
        pointsSpent: redemption.points_spent,
        redemptionId: redemption.id,
      });
    } catch (err) {
      // Email failures must never affect the redemption response
      console.error('[redemptionEventListener] email send failed:', err.message);
    }
  });
}

module.exports = { registerRedemptionEventListener };
