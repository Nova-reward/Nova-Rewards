import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import DashboardLayout from '../components/DashboardLayout';
import WalletGuard from '../components/WalletGuard';
import ErrorBoundary from '../components/ErrorBoundary';
import StakeForm from '../components/staking/StakeForm';
import StakePositionCard from '../components/staking/StakePositionCard';
import StakingStats from '../components/staking/StakingStats';
import { useWallet } from '../context/WalletContext';
import { useToast } from '../components/Toast';
import {
  stakeTokens,
  unstakeTokens,
  getStakePosition,
  getStakingStats,
  claimRewards,
} from '../lib/stakingService';
import { reportError, reportTransactionError } from '../lib/errorReporting';

function StakingContent() {
  const router = useRouter();
  const { publicKey, balance: walletBalance } = useWallet();
  const { showToast } = useToast();

  const [stakePosition, setStakePosition] = useState(null);
  const [stakingStats, setStakingStats] = useState({
    apy: 0,
    tvl: 0,
    totalStakers: 0,
  });
  const [availableBalance, setAvailableBalance] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);

  // Fetch staking data
  useEffect(() => {
    if (!publicKey) return;

    const fetchData = async () => {
      setIsLoadingData(true);
      try {
        const [position, stats] = await Promise.all([
          getStakePosition(publicKey),
          getStakingStats(),
        ]);

        setStakePosition(position);
        setStakingStats(stats);
        
        // Calculate available balance (wallet balance minus any pending stakes)
        setAvailableBalance(walletBalance || 0);
      } catch (error) {
        console.error('Failed to fetch staking data:', error);
        reportError(error, { component: 'StakingPage', action: 'fetchData' });
        showToast('Failed to load staking data', 'error');
      } finally {
        setIsLoadingData(false);
      }
    };

    fetchData();
    
    // Refresh data every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [publicKey, walletBalance]);

  const handleStake = async (amount) => {
    if (!publicKey) {
      showToast('Please connect your wallet', 'error');
      return;
    }

    setIsLoading(true);
    try {
      const result = await stakeTokens(publicKey, amount);
      
      showToast(
        `Successfully staked ${amount.toFixed(2)} NOVA tokens!`,
        'success'
      );

      // Refresh stake position
      const position = await getStakePosition(publicKey);
      setStakePosition(position);
      setAvailableBalance(prev => prev - amount);

    } catch (error) {
      console.error('Stake error:', error);
      reportTransactionError(error, 'stake', { amount, publicKey });
      showToast(error.message || 'Failed to stake tokens', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnstake = async () => {
    if (!publicKey) {
      showToast('Please connect your wallet', 'error');
      return;
    }

    if (!stakePosition) {
      showToast('No active stake position', 'error');
      return;
    }

    // Confirm unstake
    const confirmed = window.confirm(
      `Are you sure you want to unstake ${stakePosition.stakedAmount.toFixed(2)} NOVA tokens? ${
        stakePosition.status === 'active' 
          ? 'This will start a cooldown period.' 
          : 'Your tokens will be returned to your wallet.'
      }`
    );

    if (!confirmed) return;

    setIsLoading(true);
    try {
      const result = await unstakeTokens(publicKey);
      
      showToast(
        `Successfully unstaked! ${result.returnedAmount ? `Received ${result.returnedAmount.toFixed(2)} NOVA` : 'Cooldown started'}`,
        'success'
      );

      // Refresh stake position
      const position = await getStakePosition(publicKey);
      setStakePosition(position);
      
      if (result.returnedAmount) {
        setAvailableBalance(prev => prev + result.returnedAmount);
      }

    } catch (error) {
      console.error('Unstake error:', error);
      reportTransactionError(error, 'unstake', { publicKey });
      showToast(error.message || 'Failed to unstake tokens', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClaimRewards = async () => {
    if (!publicKey) {
      showToast('Please connect your wallet', 'error');
      return;
    }

    if (!stakePosition || stakePosition.accruedRewards <= 0) {
      showToast('No rewards to claim', 'error');
      return;
    }

    setIsLoading(true);
    try {
      const result = await claimRewards(publicKey);
      
      showToast(
        `Successfully claimed ${stakePosition.accruedRewards.toFixed(4)} NOVA rewards!`,
        'success'
      );

      // Refresh stake position
      const position = await getStakePosition(publicKey);
      setStakePosition(position);

    } catch (error) {
      console.error('Claim rewards error:', error);
      reportTransactionError(error, 'claim_rewards', { publicKey });
      showToast(error.message || 'Failed to claim rewards', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              Staking
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Stake your NOVA tokens to earn rewards
            </p>
          </div>
          <button
            onClick={() => router.push('/dashboard')}
            className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            ← Back to Dashboard
          </button>
        </div>

        {/* Staking Statistics */}
        <StakingStats
          apy={stakingStats.apy}
          tvl={stakingStats.tvl}
          totalStakers={stakingStats.totalStakers}
          isLoading={isLoadingData}
        />

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Stake Form */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 shadow-lg sticky top-4">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
                Stake Tokens
              </h2>
              <StakeForm
                balance={availableBalance}
                onStake={handleStake}
                isLoading={isLoading}
              />

              {/* Estimated Rewards */}
              <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Estimated Rewards
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Daily (100 NOVA):</span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      +{((stakingStats.apy / 365) * 100 / 100).toFixed(4)} NOVA
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Monthly (100 NOVA):</span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      +{((stakingStats.apy / 12) * 100 / 100).toFixed(2)} NOVA
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Yearly (100 NOVA):</span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      +{(stakingStats.apy * 100 / 100).toFixed(2)} NOVA
                    </span>
                  </div>
                </div>
              </div>

              {/* Info Box */}
              <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <div className="flex items-start">
                  <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 mr-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="text-sm text-blue-800 dark:text-blue-300">
                    <p className="font-medium mb-1">How staking works:</p>
                    <ul className="list-disc list-inside space-y-1 text-xs">
                      <li>Stake your NOVA tokens to earn rewards</li>
                      <li>Rewards accrue automatically over time</li>
                      <li>Claim rewards anytime without unstaking</li>
                      <li>Unstaking has a cooldown period</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Stake Position */}
          <div className="lg:col-span-2">
            <StakePositionCard
              stakePosition={stakePosition}
              onUnstake={handleUnstake}
              onClaimRewards={handleClaimRewards}
              isLoading={isLoading}
            />

            {/* Additional Info */}
            {stakePosition && (
              <div className="mt-6 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                  Staking Details
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                      Current APY
                    </p>
                    <p className="text-lg font-semibold text-gray-900 dark:text-white">
                      {stakingStats.apy.toFixed(2)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                      Days Staked
                    </p>
                    <p className="text-lg font-semibold text-gray-900 dark:text-white">
                      {Math.floor((Date.now() - new Date(stakePosition.stakedAt)) / (1000 * 60 * 60 * 24))}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                      Reward Rate
                    </p>
                    <p className="text-lg font-semibold text-gray-900 dark:text-white">
                      {(stakingStats.apy / 365).toFixed(4)}% daily
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                      Total Earned
                    </p>
                    <p className="text-lg font-semibold text-green-600 dark:text-green-400">
                      +{stakePosition.accruedRewards.toFixed(4)} NOVA
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

export default function StakingPage() {
  return (
    <ErrorBoundary>
      <WalletGuard>
        <StakingContent />
      </WalletGuard>
    </ErrorBoundary>
  );
}
