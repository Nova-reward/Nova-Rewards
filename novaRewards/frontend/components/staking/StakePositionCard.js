import { useState, useEffect } from 'react';

export default function StakePositionCard({ 
  stakePosition, 
  onUnstake, 
  onClaimRewards, 
  isLoading 
}) {
  const [timeRemaining, setTimeRemaining] = useState('');
  const [canUnstake, setCanUnstake] = useState(false);

  useEffect(() => {
    if (!stakePosition?.cooldownEnd) return;

    const updateCountdown = () => {
      const now = Date.now();
      const end = new Date(stakePosition.cooldownEnd).getTime();
      const diff = end - now;

      if (diff <= 0) {
        setTimeRemaining('Ready to unstake');
        setCanUnstake(true);
      } else {
        setCanUnstake(false);
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        if (days > 0) {
          setTimeRemaining(`${days}d ${hours}h ${minutes}m`);
        } else if (hours > 0) {
          setTimeRemaining(`${hours}h ${minutes}m ${seconds}s`);
        } else {
          setTimeRemaining(`${minutes}m ${seconds}s`);
        }
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [stakePosition?.cooldownEnd]);

  if (!stakePosition) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 text-center">
        <div className="mb-4">
          <svg className="mx-auto h-16 w-16 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          No Active Stake
        </h3>
        <p className="text-gray-600 dark:text-gray-400">
          Stake your NOVA tokens to start earning rewards
        </p>
      </div>
    );
  }

  const { stakedAmount, accruedRewards, status, stakedAt } = stakePosition;
  const totalValue = stakedAmount + accruedRewards;

  return (
    <div className="bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-gray-800 dark:to-gray-900 rounded-xl border border-purple-200 dark:border-purple-900 p-6 shadow-lg">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">
          Active Stake Position
        </h3>
        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
          status === 'active' 
            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
            : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
        }`}>
          {status === 'active' ? 'Active' : 'Cooldown'}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Staked Amount */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Staked Amount</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {stakedAmount.toFixed(2)}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">NOVA</p>
        </div>

        {/* Accrued Rewards */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Accrued Rewards</p>
          <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
            +{accruedRewards.toFixed(4)}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">NOVA</p>
        </div>

        {/* Total Value */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Value</p>
          <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
            {totalValue.toFixed(2)}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">NOVA</p>
        </div>

        {/* Staked Since */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Staked Since</p>
          <p className="text-lg font-semibold text-gray-900 dark:text-white">
            {new Date(stakedAt).toLocaleDateString()}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
            {Math.floor((Date.now() - new Date(stakedAt)) / (1000 * 60 * 60 * 24))} days ago
          </p>
        </div>
      </div>

      {/* Cooldown Status */}
      {status === 'cooldown' && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-4">
          <div className="flex items-start">
            <svg className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="flex-1">
              <p className="text-sm font-medium text-yellow-800 dark:text-yellow-300 mb-1">
                Cooldown Period Active
              </p>
              <p className="text-sm text-yellow-700 dark:text-yellow-400">
                {canUnstake ? (
                  <span className="font-semibold">Ready to unstake!</span>
                ) : (
                  <>Time remaining: <span className="font-mono font-semibold">{timeRemaining}</span></>
                )}
              </p>
              {!canUnstake && stakePosition.cooldownEnd && (
                <p className="text-xs text-yellow-600 dark:text-yellow-500 mt-1">
                  Unlock time: {new Date(stakePosition.cooldownEnd).toLocaleString()}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={onClaimRewards}
          disabled={isLoading || accruedRewards <= 0}
          className="flex-1 px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-medium rounded-lg transition-colors disabled:cursor-not-allowed flex items-center justify-center"
        >
          {isLoading ? (
            <>
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Processing...
            </>
          ) : (
            <>
              <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Claim Rewards
            </>
          )}
        </button>

        <button
          onClick={onUnstake}
          disabled={isLoading || (status === 'cooldown' && !canUnstake)}
          className="flex-1 px-6 py-3 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white font-medium rounded-lg transition-colors disabled:cursor-not-allowed flex items-center justify-center"
        >
          {status === 'cooldown' ? (
            canUnstake ? 'Complete Unstake' : 'Cooldown Active'
          ) : (
            <>
              <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
              Unstake
            </>
          )}
        </button>
      </div>
    </div>
  );
}
