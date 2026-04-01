import axios from 'axios';
import { saveToOfflineCache, getFromOfflineCache } from './offlineStorage';
import { syncInBackground } from './pwa';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

// Request interceptor - add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - handle offline scenarios
api.interceptors.response.use(
  async (response) => {
    // Cache successful GET requests for offline access
    if (response.config.method === 'get') {
      const cacheKey = response.config.url;
      await saveToOfflineCache(cacheKey, response.data);
    }
    return response;
  },
  async (error) => {
    // Handle offline errors
    if (!navigator.onLine || error.message === 'Network Error') {
      const cacheKey = error.config?.url;
      
      // Try to get cached data for GET requests
      if (error.config?.method === 'get' && cacheKey) {
        const cachedData = await getFromOfflineCache(cacheKey);
        if (cachedData) {
          return { data: cachedData, fromCache: true };
        }
      }
      
      // Queue POST/PUT/DELETE requests for background sync
      if (['post', 'put', 'delete'].includes(error.config?.method)) {
        await syncInBackground('sync-transactions');
      }
    }
    
    return Promise.reject(error);
  }
);

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
