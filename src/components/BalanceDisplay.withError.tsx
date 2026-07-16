import React from 'react';
import { useDataFetching } from '@/hooks/useDataFetching';
import { WithErrorHandling } from '@/components/ErrorStates/WithErrorHandling';
import { RefreshIndicator } from './RefreshIndicator';
import { formatNumber } from '@/lib/utils';
import { apiClient } from '@/lib/api-client';

interface BalanceData {
  novaBalance: string;
  usdValue: string;
  stakedBalance?: string;
  pendingRewards?: string;
}

const fetchBalance = async (): Promise<BalanceData> => {
  const response = await apiClient.get('/api/balance');
  return {
    novaBalance: response.data.novaBalance,
    usdValue: response.data.usdValue,
    stakedBalance: response.data.stakedBalance,
    pendingRewards: response.data.pendingRewards,
  };
};

export const BalanceDisplayWithErrorHandling: React.FC = () => {
  const { data: balance, isLoading, error, isRefreshing, refetch } = useDataFetching({
    fetchFn: fetchBalance,
  });

  if (!balance && isLoading) {
    return (
      <div className="animate-pulse">
        <div className="h-8 w-32 rounded bg-gray-200 dark:bg-gray-700" />
      </div>
    );
  }

  return (
    <WithErrorHandling
      isLoading={isLoading && !balance}
      error={error}
      onRetry={refetch}
    >
      {balance && (
        <div className="space-y-2">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-gray-900 dark:text-white">
              {formatNumber(parseFloat(balance.novaBalance))} NOVA
            </span>
            <span className="text-sm text-gray-500">≈ ${balance.usdValue}</span>
          </div>
          
          <div className="flex items-center gap-4 text-sm">
            {balance.stakedBalance && (
              <div className="text-gray-600 dark:text-gray-400">
                Staked: {formatNumber(parseFloat(balance.stakedBalance))} NOVA
              </div>
            )}
            <RefreshIndicator isRefreshing={isRefreshing} lastUpdated={new Date()} />
          </div>
        </div>
      )}
    </WithErrorHandling>
  );
};
