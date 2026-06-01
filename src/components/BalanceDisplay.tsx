import React from 'react';
import { RefreshCw } from 'lucide-react';
import { useBalance } from '@/hooks/useBalance';
import { RefreshIndicator } from './RefreshIndicator';
import { formatNumber } from '@/lib/utils';

interface BalanceDisplayProps {
  className?: string;
  showStaked?: boolean;
  showPending?: boolean;
}

export const BalanceDisplay: React.FC<BalanceDisplayProps> = ({
  className = '',
  showStaked = true,
  showPending = true,
}) => {
  const { balance, isLoading, isRefreshing, error, lastUpdated, refreshBalance } = useBalance(true);

  if (isLoading && !balance) {
    return (
      <div className={`animate-pulse ${className}`}>
        <div className="h-8 w-32 rounded bg-gray-200 dark:bg-gray-700" />
        <div className="mt-1 h-4 w-20 rounded bg-gray-200 dark:bg-gray-700" />
      </div>
    );
  }

  if (error && !balance) {
    return (
      <div className={`text-red-500 ${className}`}>
        <p>Failed to load balance</p>
        <button
          onClick={refreshBalance}
          className="mt-1 text-sm text-blue-500 hover:underline"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!balance) return null;

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Main Balance */}
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold text-gray-900 dark:text-white">
          {formatNumber(parseFloat(balance.novaBalance))} NOVA
        </span>
        <span className="text-sm text-gray-500">≈ ${balance.usdValue}</span>
      </div>

      {/* Additional Info */}
      <div className="flex flex-wrap items-center gap-4 text-sm">
        {showStaked && balance.stakedBalance && (
          <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
            <span className="font-medium">Staked:</span>
            <span>{formatNumber(parseFloat(balance.stakedBalance))} NOVA</span>
          </div>
        )}
        
        {showPending && balance.pendingRewards && (
          <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
            <span className="font-medium">Pending Rewards:</span>
            <span>{formatNumber(parseFloat(balance.pendingRewards))} NOVA</span>
          </div>
        )}

        {/* Refresh Status */}
        <div className="flex items-center gap-2">
          <RefreshIndicator isRefreshing={isRefreshing} lastUpdated={lastUpdated} />
          
          {/* Manual Refresh Button */}
          <button
            onClick={refreshBalance}
            disabled={isRefreshing}
            className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50"
            aria-label="Refresh balance"
          >
            <RefreshCw className={`h-3 w-3 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default BalanceDisplay;
