import { useEffect, useState } from 'react';

export default function StakingStats({ apy, tvl, totalStakers, isLoading }) {
  const [animatedAPY, setAnimatedAPY] = useState(0);
  const [animatedTVL, setAnimatedTVL] = useState(0);

  useEffect(() => {
    if (isLoading) return;

    // Animate APY
    const apyDuration = 1000;
    const apySteps = 50;
    const apyIncrement = apy / apySteps;
    let apyStep = 0;

    const apyInterval = setInterval(() => {
      apyStep++;
      setAnimatedAPY(apyIncrement * apyStep);
      if (apyStep >= apySteps) clearInterval(apyInterval);
    }, apyDuration / apySteps);

    // Animate TVL
    const tvlDuration = 1000;
    const tvlSteps = 50;
    const tvlIncrement = tvl / tvlSteps;
    let tvlStep = 0;

    const tvlInterval = setInterval(() => {
      tvlStep++;
      setAnimatedTVL(tvlIncrement * tvlStep);
      if (tvlStep >= tvlSteps) clearInterval(tvlInterval);
    }, tvlDuration / tvlSteps);

    return () => {
      clearInterval(apyInterval);
      clearInterval(tvlInterval);
    };
  }, [apy, tvl, isLoading]);

  const formatNumber = (num) => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(2)}M`;
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(2)}K`;
    }
    return num.toFixed(2);
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 animate-pulse">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-3"></div>
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2"></div>
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* APY Card */}
      <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl border border-green-200 dark:border-green-800 p-6 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Current APY
          </h3>
          <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
        </div>
        <p className="text-4xl font-bold text-green-600 dark:text-green-400 mb-2">
          {animatedAPY.toFixed(2)}%
        </p>
        <p className="text-xs text-gray-600 dark:text-gray-400">
          Annual Percentage Yield
        </p>
        <div className="mt-4 pt-4 border-t border-green-200 dark:border-green-800">
          <div className="flex justify-between text-xs">
            <span className="text-gray-600 dark:text-gray-400">Daily:</span>
            <span className="font-semibold text-gray-900 dark:text-white">
              {(apy / 365).toFixed(4)}%
            </span>
          </div>
          <div className="flex justify-between text-xs mt-1">
            <span className="text-gray-600 dark:text-gray-400">Monthly:</span>
            <span className="font-semibold text-gray-900 dark:text-white">
              {(apy / 12).toFixed(2)}%
            </span>
          </div>
        </div>
      </div>

      {/* TVL Card */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl border border-blue-200 dark:border-blue-800 p-6 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Total Value Locked
          </h3>
          <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <p className="text-4xl font-bold text-blue-600 dark:text-blue-400 mb-2">
          {formatNumber(animatedTVL)}
        </p>
        <p className="text-xs text-gray-600 dark:text-gray-400">
          NOVA tokens staked
        </p>
        <div className="mt-4 pt-4 border-t border-blue-200 dark:border-blue-800">
          <div className="flex justify-between text-xs">
            <span className="text-gray-600 dark:text-gray-400">Exact:</span>
            <span className="font-mono font-semibold text-gray-900 dark:text-white">
              {tvl.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>

      {/* Total Stakers Card */}
      <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-xl border border-purple-200 dark:border-purple-800 p-6 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Total Stakers
          </h3>
          <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        </div>
        <p className="text-4xl font-bold text-purple-600 dark:text-purple-400 mb-2">
          {totalStakers.toLocaleString()}
        </p>
        <p className="text-xs text-gray-600 dark:text-gray-400">
          Active participants
        </p>
        <div className="mt-4 pt-4 border-t border-purple-200 dark:border-purple-800">
          <div className="flex justify-between text-xs">
            <span className="text-gray-600 dark:text-gray-400">Avg. stake:</span>
            <span className="font-semibold text-gray-900 dark:text-white">
              {totalStakers > 0 ? formatNumber(tvl / totalStakers) : '0'} NOVA
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
