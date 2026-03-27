const {
  getUserById,
  markReferralBonusClaimed,
  getReferredUsers,
  getReferralPointsEarned,
  hasReferralBonusBeenClaimed,
  getUnprocessedReferrals,
} = require('../db/userRepository');
const { recordPointTransaction } = require('../db/pointTransactionRepository');
const { REFERRAL_BONUS_POINTS } = require('./configService');

/**
 * Processes a referral bonus for a referred user.
 * Requirements: #181
 *
 * @param {number} referrerId - The referrer's user ID
 * @param {number} referredUserId - The referred user's ID
 * @returns {Promise<{success: boolean, message: string, bonus?: object}>}
 */
async function processReferralBonus(referrerId, referredUserId) {
  try {
    // Prevent self-referrals
    if (referrerId === referredUserId) {
      return {
        success: false,
        message: 'Self-referrals are not allowed',
      };
    }

    // Check if bonus has already been claimed
    const alreadyClaimed = await hasReferralBonusBeenClaimed(referrerId, referredUserId);
    if (alreadyClaimed) {
      return {
        success: false,
        message: 'Referral bonus has already been claimed for this user',
      };
    }

    // Verify both users exist
    const referrer = await getUserById(referrerId);
    const referredUser = await getUserById(referredUserId);

    if (!referrer || !referredUser) {
      return {
        success: false,
        message: 'One or both users not found',
      };
    }

    // Verify the referral relationship exists
    if (referredUser.referred_by !== referrerId) {
      return {
        success: false,
        message: 'Invalid referral relationship',
      };
    }

    // Record the referral bonus transaction
    const bonus = await recordPointTransaction({
      userId: referrerId,
      type: 'referral',
      amount: REFERRAL_BONUS_POINTS,
      description: `Referral bonus for user ${referredUser.wallet_address}`,
      referredUserId: referredUserId,
    });

    // Mark the referral bonus as claimed
    await markReferralBonusClaimed(referredUserId);

    return {
      success: true,
      message: 'Referral bonus processed successfully',
      bonus,
    };
  } catch (error) {
    console.error('Error processing referral bonus:', error);
    return {
      success: false,
      message: 'Failed to process referral bonus',
    };
  }
}

/**
 * Gets referral statistics for a user.
 * Requirements: #181
 *
 * @param {number} userId
 * @returns {Promise<{referredUsers: object[], totalPoints: string, totalReferrals: number}>}
 */
async function getUserReferralStats(userId) {
  const referredUsers = await getReferredUsers(userId);
  const totalPoints = await getReferralPointsEarned(userId);

  return {
    referredUsers,
    totalPoints,
    totalReferrals: referredUsers.length,
  };
}

/**
 * Processes all unresolved referrals that are older than the specified hours.
 * Used by the cron job to handle delayed referral attributions.
 * Requirements: #181
 *
 * @param {number} hoursAgo - Number of hours to look back (default: 24)
 * @returns {Promise<{processed: number, failed: number}>}
 */
async function processUnresolvedReferrals(hoursAgo = 24) {
  const unprocessedReferrals = await getUnprocessedReferrals(hoursAgo);
  let processed = 0;
  let failed = 0;

  for (const referral of unprocessedReferrals) {
    const result = await processReferralBonus(referral.referred_by, referral.id);
    if (result.success) {
      processed++;
    } else {
      failed++;
      console.error(`Failed to process referral for user ${referral.id}:`, result.message);
    }
  }

  return { processed, failed };
}

module.exports = {
  processReferralBonus,
  getUserReferralStats,
  processUnresolvedReferrals,
};
