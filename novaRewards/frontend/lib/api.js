import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

// Rewards API

/**
 * Fetch a single page of rewards.
 * @param {number} page  1-based page number
 * @param {number} limit Items per page
 * @returns {Promise<{ rewards: any[], userPoints: number, hasMore: boolean, total: number }>}
 */
export async function getRewards(page = 1, limit = 12) {
  const response = await api.get('/rewards', { params: { page, limit } });
  // Support both paginated and legacy (array) responses
  const data = response.data;
  if (Array.isArray(data)) {
    return { rewards: data, userPoints: 0, hasMore: false, total: data.length };
  }
  return {
    rewards: data.rewards ?? [],
    userPoints: data.userPoints ?? 0,
    hasMore: data.hasMore ?? false,
    total: data.total ?? 0,
  };
}

export async function redeemReward(rewardId) {
  const response = await api.post('/redemptions', { rewardId });
  return response.data;
}

export default api;
