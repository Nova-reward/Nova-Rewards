import { useState } from 'react';
import { isFreighterInstalled } from '../lib/freighter';
import FreighterInstallModal from './FreighterInstallModal';

/**
 * Wallet connection flow component.
 *
 * Features:
 * - Checks if Freighter is installed before attempting connection
 * - Shows FreighterInstallModal when extension is missing
 * - Displays connection errors including network mismatch warnings
 */
export default function WalletConnectFlow({ onConnect, onBack }) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [error, setError] = useState(null);
  const [networkMismatch, setNetworkMismatch] = useState(false);

  const handleConnect = async () => {
    setIsConnecting(true);
    setError(null);
    setNetworkMismatch(false);

    try {
      const installed = await isFreighterInstalled();
      if (!installed) {
        setShowInstallModal(true);
        setIsConnecting(false);
        return;
      }

      await onConnect();
    } catch (err) {
      const message = err.message || 'Failed to connect wallet';
      setError(message);
      if (message.toLowerCase().includes('network mismatch')) {
        setNetworkMismatch(true);
      }
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
      <div className="max-w-md w-full">
        <button
          onClick={onBack}
          className="mb-6 text-gray-600 hover:text-gray-900 flex items-center"
          aria-label="Go back"
        >
          <svg className="w-5 h-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 mx-auto bg-blue-100 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Connect Your Wallet
            </h2>
            <p className="text-gray-600">
              Connect your Freighter wallet to start earning rewards
            </p>
          </div>

          <div className="space-y-4 mb-6">
            {/* Install hint — shown when modal is not open */}
            {!showInstallModal && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start">
                  <svg className="w-5 h-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  <div className="text-sm">
                    <p className="font-medium text-blue-900 mb-1">Need Freighter?</p>
                    <p className="text-blue-700">
                      Install the Freighter browser extension from{' '}
                      <a
                        href="https://www.freighter.app/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline hover:text-blue-900"
                      >
                        freighter.app
                      </a>
                    </p>
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-start">
                  <svg className="w-5 h-5 text-red-600 mt-0.5 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <div className="text-sm">
                    <p className="font-medium text-red-900 mb-1">Connection Failed</p>
                    <p className="text-red-700">{error}</p>
                  </div>
                </div>
              </div>
            )}

            {networkMismatch && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4" role="alert">
                <div className="flex items-start">
                  <svg className="w-5 h-5 text-amber-600 mt-0.5 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <div className="text-sm">
                    <p className="font-medium text-amber-900 mb-1">Network Mismatch</p>
                    <p className="text-amber-700">
                      Your Freighter wallet is on the wrong network. Please switch to{' '}
                      {process.env.NEXT_PUBLIC_STELLAR_NETWORK === 'mainnet' ? 'Public' : 'Testnet'}{' '}
                      in Freighter settings and try again.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={handleConnect}
            disabled={isConnecting}
            className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            aria-label="Connect Freighter wallet"
          >
            {isConnecting ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Connecting...
              </span>
            ) : (
              'Connect Freighter'
            )}
          </button>

          <p className="text-xs text-gray-500 text-center mt-4">
            By connecting, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>
      </div>

      {/* Install prompt modal */}
      <FreighterInstallModal
        isOpen={showInstallModal}
        onClose={() => setShowInstallModal(false)}
      />
    </div>
  );
}

