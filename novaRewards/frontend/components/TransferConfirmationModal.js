'use client';
import { useMemo } from 'react';
import Modal from './ui/Modal';

/**
 * TransferConfirmationModal — Shows transaction details before broadcasting
 *
 * Displays:
 * - Sender's wallet address (truncated for readability)
 * - Recipient's wallet address (truncated)
 * - Amount to transfer
 * - Estimated network fee
 * - Total cost (amount + fee)
 * - Clear, actionable button states
 *
 * Acceptance Criteria:
 * ✓ Shows sender, recipient, amount, and estimated fee
 * ✓ Prevents accidental submission with clear confirmation flow
 * ✓ Respects loading state during submission
 */
export default function TransferConfirmationModal({
  isOpen,
  onConfirm,
  onCancel,
  sender,
  recipient,
  amount,
  fee,
  isSubmitting = false,
}) {
  // Truncate addresses for display (show first 6 and last 6 chars)
  const truncateAddress = (addr) => {
    if (!addr || addr.length < 12) return addr;
    return `${addr.slice(0, 6)}...${addr.slice(-6)}`;
  };

  // Calculate total cost
  const totalCost = useMemo(() => {
    try {
      const amountNum = Number(amount) || 0;
      const feeNum = Number(fee) || 0;
      return (amountNum + feeNum).toFixed(7);
    } catch {
      return '0';
    }
  }, [amount, fee]);

  if (!isOpen) return null;

  return (
    <Modal
      open={isOpen}
      onClose={!isSubmitting ? onCancel : undefined}
      title="Confirm Transfer"
      className="transfer-confirmation-modal"
    >
      <div className="space-y-6">
        {/* Transaction Details */}
        <div className="space-y-4 rounded-lg bg-gray-50 p-4 dark:bg-gray-900/50">
          {/* From */}
          <div className="border-b border-gray-200 pb-4 dark:border-gray-700">
            <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              From
            </div>
            <div className="mt-2 font-mono text-sm" title={sender}>
              {truncateAddress(sender)}
            </div>
            <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Your wallet
            </div>
          </div>

          {/* To */}
          <div className="border-b border-gray-200 pb-4 dark:border-gray-700">
            <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              To
            </div>
            <div className="mt-2 font-mono text-sm" title={recipient}>
              {truncateAddress(recipient)}
            </div>
            <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Recipient wallet
            </div>
          </div>

          {/* Amount */}
          <div className="border-b border-gray-200 pb-4 dark:border-gray-700">
            <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Amount
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-semibold text-gray-900 dark:text-white">
                {amount}
              </span>
              <span className="text-lg font-medium text-gray-600 dark:text-gray-400">
                NOVA
              </span>
            </div>
          </div>

          {/* Network Fee */}
          <div className="border-b border-gray-200 pb-4 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Network Fee
                </div>
                <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  (Base Stellar network fee)
                </div>
              </div>
              <div className="text-right">
                <div className="font-mono text-sm font-medium text-gray-700 dark:text-gray-300">
                  {fee}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">NOVA</div>
              </div>
            </div>
          </div>

          {/* Total Cost */}
          <div className="rounded-md border-2 border-purple-200 bg-purple-50 p-3 dark:border-purple-900 dark:bg-purple-900/20">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                Total Cost
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-bold text-purple-700 dark:text-purple-300">
                  {totalCost}
                </span>
                <span className="text-sm font-medium text-purple-600 dark:text-purple-400">
                  NOVA
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Warning Message */}
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800 dark:border-yellow-900 dark:bg-yellow-900/20 dark:text-yellow-300">
          <p className="font-medium">⚠️ Please review carefully</p>
          <p className="mt-1 text-xs">
            Stellar transactions are permanent and cannot be undone. Ensure the
            recipient address is correct.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className={[
              'flex-1 px-4 py-2 rounded-md font-medium transition-colors',
              'focus:outline-none focus:ring-2 focus:ring-offset-2',
              isSubmitting
                ? 'bg-gray-200 text-gray-500 cursor-not-allowed dark:bg-gray-700 dark:text-gray-400'
                : 'bg-gray-200 text-gray-800 hover:bg-gray-300 focus:ring-gray-400 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600',
            ].join(' ')}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting}
            className={[
              'flex-1 px-4 py-2 rounded-md font-medium transition-colors flex items-center justify-center gap-2',
              'focus:outline-none focus:ring-2 focus:ring-offset-2',
              isSubmitting
                ? 'bg-purple-400 text-white cursor-wait'
                : 'bg-purple-600 text-white hover:bg-purple-700 focus:ring-purple-500 dark:bg-purple-600 dark:hover:bg-purple-700',
            ].join(' ')}
          >
            {isSubmitting ? (
              <>
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" />
                Processing…
              </>
            ) : (
              'Confirm Transfer'
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}
