import { useState } from 'react';
import { useWallet } from '../../context/WalletContext';

export default function StakeForm({ balance, onStake, isLoading }) {
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const { publicKey } = useWallet();

  const handleMaxClick = () => {
    setAmount(balance.toString());
    setError('');
  };

  const handleAmountChange = (e) => {
    const value = e.target.value;
    setAmount(value);
    setError('');

    // Validation
    if (value && parseFloat(value) > balance) {
      setError('Amount exceeds available balance');
    } else if (value && parseFloat(value) <= 0) {
      setError('Amount must be greater than 0');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!amount || parseFloat(amount) <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    if (parseFloat(amount) > balance) {
      setError('Amount exceeds available balance');
      return;
    }

    try {
      await onStake(parseFloat(amount));
      setAmount('');
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to stake tokens');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="stake-amount" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Amount to Stake
        </label>
        <div className="relative">
          <input
            id="stake-amount"
            type="number"
            step="0.01"
            min="0"
            value={amount}
            onChange={handleAmountChange}
            placeholder="0.00"
            disabled={isLoading || !publicKey}
            className="w-full px-4 py-3 pr-20 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-700 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <button
            type="button"
            onClick={handleMaxClick}
            disabled={isLoading || !publicKey || balance === 0}
            className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1 text-sm font-medium text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            MAX
          </button>
        </div>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Available: {balance.toFixed(2)} NOVA
        </p>
        {error && (
          <p className="mt-2 text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={isLoading || !publicKey || !amount || parseFloat(amount) <= 0 || parseFloat(amount) > balance}
        className="w-full px-6 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white font-medium rounded-lg transition-colors disabled:cursor-not-allowed flex items-center justify-center"
      >
        {isLoading ? (
          <>
            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Staking...
          </>
        ) : (
          'Stake Tokens'
        )}
      </button>
    </form>
  );
}
