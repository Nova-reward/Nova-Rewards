import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

// Rewards API
export async function getRewards() {
  const response = await api.get('/rewards');
  return response.data;
}

export async function redeemReward(rewardId) {
  const response = await api.post('/redemptions', { rewardId });
  return response.data;
}

export default api;
