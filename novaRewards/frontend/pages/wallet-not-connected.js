import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { useWallet } from '../context/WalletContext';
import WalletConnect from '../components/WalletConnect';

export default function WalletNotConnected() {
  const router = useRouter();
  const { publicKey, connect } = useWallet();
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    // If wallet is already connected, redirect to intended destination or dashboard
    if (publicKey) {
      const redirectPath = sessionStorage.getItem('redirectAfterWallet') || '/dashboard';
      sessionStorage.removeItem('redirectAfterWallet');
      router.push(redirectPath);
    }
  }, [publicKey, router]);

  const handleConnect = async () => {
    setIsConnecting(true);
    setError(null);
    
    try {
      await connect();
      // Redirect will happen automatically via useEffect above
    } catch (err) {
      console.error('Failed to connect wallet:', err);
      setError(err.message || 'Failed to connect wallet. Please try again.');
      setIsConnecting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-pink-100 dark:from-gray-900 dark:to-gray-800 px-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-8">
        <div className="text-center mb-8">
          <div className="mb-6">
            <svg 
              className="mx-auto h-20 w-20 text-purple-600 dark:text-purple-400" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={1.5} 
                d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" 
              />
            </svg>
          </div>
          
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-3">
            Wallet Not Connected
          </h1>
          
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            You need to connect your Stellar wallet to access this page and interact with NovaRewards.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
            <p className="text-sm text-red-800 dark:text-red-300">
              {error}
            </p>
          </div>
        )}

        <div className="space-y-4 mb-6">
          <button
            onClick={handleConnect}
            disabled={isConnecting}
            className="w-full px-6 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white rounded-lg font-medium transition-colors shadow-lg hover:shadow-xl disabled:cursor-not-allowed flex items-center justify-center"
          >
            {isConnecting ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Connecting...
              </>
            ) : (
              'Connect Wallet'
            )}
          </button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300 dark:border-gray-600"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white dark:bg-gray-800 text-gray-500">or</span>
            </div>
          </div>

          <Link
            href="/"
            className="block w-full px-6 py-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg font-medium transition-colors text-center"
          >
            Go to Home
          </Link>
        </div>

        <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
            Don't have a wallet?
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            You'll need a Stellar wallet like Freighter to use NovaRewards.
          </p>
          <a
            href="https://www.freighter.app/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-purple-600 dark:text-purple-400 hover:underline font-medium"
          >
            Get Freighter Wallet →
          </a>
        </div>
      </div>
    </div>
  );
}
