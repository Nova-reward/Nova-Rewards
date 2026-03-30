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
export async function getRewards() {
  const response = await api.get('/rewards');
  return response.data;
}

export async function redeemReward(rewardId) {
  const response = await api.post('/redemptions', { rewardId });
  return response.data;
}

export default api;
