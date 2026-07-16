/**
 * campaigns.js — Test campaign data generators.
 */

const RUN_ID = Date.now().toString(36);

/**
 * Format date as YYYY-MM-DD for <input type="date">.
 */
const formatDate = (d) => d.toISOString().slice(0, 10);

export const CAMPAIGNS = {
  /**
   * Valid campaign (active, 30-day duration from today).
   */
  valid: () => {
    const today = new Date();
    const inThirtyDays = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
    return {
      name: `E2E Campaign ${RUN_ID}`,
      rewardRate: '1.5',
      startDate: formatDate(today),
      endDate: formatDate(inThirtyDays),
    };
  },

  /**
   * Campaign with higher reward rate.
   */
  highRewardRate: () => {
    const today = new Date();
    const inThirtyDays = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
    return {
      name: `High Reward Campaign ${RUN_ID}`,
      rewardRate: '5.0',
      startDate: formatDate(today),
      endDate: formatDate(inThirtyDays),
    };
  },

  /**
   * Campaign that expired yesterday (for testing blocked distribution).
   */
  expired: () => {
    const yesterday = new Date(new Date().getTime() - 1 * 24 * 60 * 60 * 1000);
    const twoDaysAgo = new Date(yesterday.getTime() - 1 * 24 * 60 * 60 * 1000);
    return {
      name: `Expired Campaign ${RUN_ID}`,
      rewardRate: '1.0',
      startDate: formatDate(twoDaysAgo),
      endDate: formatDate(yesterday),
    };
  },

  /**
   * Invalid: end_date before start_date.
   */
  invalidDateOrder: () => {
    const today = new Date();
    const yesterday = new Date(today.getTime() - 1 * 24 * 60 * 60 * 1000);
    return {
      name: `Invalid Dates Campaign ${RUN_ID}`,
      rewardRate: '1.0',
      startDate: formatDate(today),
      endDate: formatDate(yesterday),
    };
  },

  /**
   * Invalid: negative reward rate.
   */
  negativeRewardRate: () => {
    const today = new Date();
    const inThirtyDays = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
    return {
      name: `Negative Rate Campaign ${RUN_ID}`,
      rewardRate: '-5.0',
      startDate: formatDate(today),
      endDate: formatDate(inThirtyDays),
    };
  },

  /**
   * Invalid: zero reward rate.
   */
  zeroRewardRate: () => {
    const today = new Date();
    const inThirtyDays = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
    return {
      name: `Zero Rate Campaign ${RUN_ID}`,
      rewardRate: '0',
      startDate: formatDate(today),
      endDate: formatDate(inThirtyDays),
    };
  },
};
