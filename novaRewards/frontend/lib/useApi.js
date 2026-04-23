import useSWR from 'swr';
import useSWRMutation from 'swr/mutation';
import api from './api';

// Error normalization
export class ApiError extends Error {
  constructor(code, message, status) {
    super(message);
    this.code = code;
    this.status = status;
    this.name = 'ApiError';
  }
}

// Normalize API errors
const normalizeError = (error) => {
  if (error.response) {
    const { status, data } = error.response;
    return new ApiError(data.code || 'API_ERROR', data.message || 'An error occurred', status);
  }
  return new ApiError('NETWORK_ERROR', error.message || 'Network error', 0);
};

// SWR fetcher
const fetcher = async (url) => {
  try {
    const response = await api.get(url);
    return response.data;
  } catch (error) {
    throw normalizeError(error);
  }
};

// Mutation fetcher
const mutationFetcher = async (url, { arg }) => {
  try {
    const response = await api.request({
      url,
      method: arg.method || 'POST',
      data: arg.data,
    });
    return response.data;
  } catch (error) {
    throw normalizeError(error);
  }
};

const REVALIDATE_30S = { refreshInterval: 30000 };

// User hooks
export function useUser(userId) {
  return useSWR(userId ? `/users/${userId}` : null, fetcher, REVALIDATE_30S);
}

export function useCampaigns() {
  return useSWR('/campaigns', fetcher, REVALIDATE_30S);
}

export function useBalance(userId) {
  return useSWR(userId ? `/users/${userId}/balance` : null, fetcher, REVALIDATE_30S);
}

export function useTransactions(userId, filters = {}) {
  const query = new URLSearchParams(filters).toString();
  return useSWR(userId ? `/users/${userId}/transactions?${query}` : null, fetcher, REVALIDATE_30S);
}

// Mutation hooks with optimistic updates
export function useRedeemReward() {
  return useSWRMutation('/redemptions', mutationFetcher, {
    onSuccess: (data, key, config) => {
      // Optimistic update: decrease balance
      // This would need access to balance SWR cache
    },
  });
}

export function useUpdateProfile() {
  return useSWRMutation('/users/profile', mutationFetcher, {
    onSuccess: (data, key, config) => {
      // Optimistic update for profile
    },
  });
}