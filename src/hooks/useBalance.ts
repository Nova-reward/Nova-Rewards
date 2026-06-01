import { useState, useCallback } from 'react';
import { usePolling } from './usePolling';
import { apiClient } from '@/lib/api-client';

export interface BalanceData {
  novaBalance: string;
  usdValue: string;
  stakedBalance?: string;
  pendingRewards?: string;
  lastUpdated: string;
}

export function useBalance(initialEnabled = true) {
  const [balance, setBalance] = useState<BalanceData | null>(null);

  const fetchBalance = useCallback(async (): Promise<BalanceData> => {
    const response = await apiClient.get('/api/balance');
    return {
      novaBalance: response.data.novaBalance,
      usdValue: response.data.usdValue,
      stakedBalance: response.data.stakedBalance,
      pendingRewards: response.data.pendingRewards,
      lastUpdated: new Date().toISOString(),
    };
  }, []);

  const { isLoading, isRefreshing, error, lastUpdated } = usePolling({
    fetchFn: fetchBalance,
    onSuccess: setBalance,
    interval: 15000, // 15 seconds
    enabled: initialEnabled,
    maxRetries: 3,
    retryDelay: 1000,
  });

  const refreshBalance = useCallback(() => {
    fetchBalance().then(setBalance).catch(console.error);
  }, [fetchBalance]);

  return {
    balance,
    isLoading,
    isRefreshing,
    error,
    lastUpdated,
    refreshBalance,
  };
}
