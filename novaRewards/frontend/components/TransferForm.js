'use client';
import { useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Asset,
  TransactionBuilder,
  Operation,
  Networks,
  BASE_FEE,
  Horizon,
} from 'stellar-sdk';
import { signAndSubmit } from '../lib/freighter';
import { validateStellarAddress } from '../lib/validation';
import api from '../lib/api';
import { useWalletStore } from '../store/walletStore';
import { useToast } from './Toast';
import FormField from './ui/FormField';
import TransactionLink from './TransactionLink';
import TransferConfirmationModal from './TransferConfirmationModal';

// =====================================================================
// Configuration
// =====================================================================

const HORIZON_URL =
  process.env.NEXT_PUBLIC_HORIZON_URL || 'https://horizon-testnet.stellar.org';
const ISSUER_PUBLIC = process.env.NEXT_PUBLIC_ISSUER_PUBLIC;
const NETWORK_PASSPHRASE =
  process.env.NEXT_PUBLIC_STELLAR_NETWORK === 'mainnet'
    ? Networks.PUBLIC
    : Networks.TESTNET;
const NETWORK_NAME =
  process.env.NEXT_PUBLIC_STELLAR_NETWORK === 'mainnet' ? 'mainnet' : 'testnet';

// Base fee: 100 stroops per operation (standard Stellar network fee)
const BASE_FEE_STROOPS = BASE_FEE; // 100 stroops
const FEE_IN_NOVA = (BASE_FEE_STROOPS / 10_000_000).toFixed(7); // Convert stroops to NOVA

// =====================================================================
// Validation Schema
// =====================================================================

const transferSchema = z.object({
  recipient: z
    .string()
    .trim()
    .min(1, 'Recipient wallet address is required')
    .refine(
      (val) => !validateStellarAddress(val),
      {
        message: 'Enter a valid Stellar public key (starts with G, 56 characters)',
      }
    )
    .transform((val) => val.trim()),
  amount: z
    .string()
    .trim()
    .min(1, 'Amount is required')
    .refine(
      (val) => !isNaN(Number(val)) && Number(val) > 0,
      'Amount must be a positive number'
    )
    .transform((val) => String(Number(val))), // Normalize to prevent edge cases
});

type TransferFormData = z.infer<typeof transferSchema>;

/**
 * TokenTransferForm — Send NOVA tokens to another Stellar wallet
 *
 * Features:
 * - Client-side Stellar address validation (RFC-compliant format check)
 * - Real-time balance validation to prevent insufficient fund submissions
 * - Confirmation modal showing sender, recipient, amount, and estimated fee
 * - Trustline verification before transaction broadcasting
 * - Signed transaction submission via Freighter wallet
 * - Success notification with Stellar Expert explorer link
 * - Automatic form reset on successful transfer
 * - Comprehensive error handling with user-friendly messages
 *
 * Acceptance Criteria:
 * ✓ 5.1 - Stellar public key format validated client-side before submission
 * ✓ 5.2 - Confirmation modal shows sender, recipient, amount, and estimated fee
 * ✓ 5.3 - Form prevents submission if user's balance is insufficient
 * ✓ 5.4 - Successful transfer shows success toast with Stellar Explorer link
 * ✓ 5.5 - Form resets after successful transfer
 */
export default function TokenTransferForm({ onSuccess }) {
  // =====================================================================
  // State Management
  // =====================================================================

  const { publicKey: senderPublicKey, balance: senderBalance } = useWalletStore();
  const { addToast } = useToast();
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [txHash, setTxHash] = useState('');

  // React Hook Form setup
  const {
    register,
    handleSubmit,
    formState: { errors, isValid, isSubmitting: formSubmitting },
    reset,
    watch,
  } = useForm<TransferFormData>({
    resolver: zodResolver(transferSchema),
    mode: 'onBlur', // Validate on blur for better UX
    defaultValues: {
      recipient: '',
      amount: '',
    },
  });

  const recipientValue = watch('recipient');
  const amountValue = watch('amount');

  // =====================================================================
  // Validation Checks
  // =====================================================================

  /**
   * Check if the form can proceed to confirmation modal.
   * Validates: format, amount > 0, balance sufficient.
   */
  const canProceedToConfirmation = useCallback(() => {
    if (!isValid) return false;

    const numAmount = Number(amountValue);
    if (isNaN(numAmount) || numAmount <= 0) return false;

    const numBalance = Number(senderBalance);
    return numAmount <= numBalance;
  }, [isValid, amountValue, senderBalance]);

  /**
   * Gets user-friendly balance validation message.
   */
  const getBalanceError = useCallback(() => {
    if (!amountValue) return null;

    const numAmount = Number(amountValue);
    const numBalance = Number(senderBalance);

    if (numAmount > numBalance) {
      return `Insufficient balance. Available: ${senderBalance} NOVA`;
    }

    return null;
  }, [amountValue, senderBalance]);

  // =====================================================================
  // Form Submission Handlers
  // =====================================================================

  /**
   * Step 1: Client-side validation, then show confirmation modal.
   */
  const onSubmitToConfirmation = useCallback(
    async (data: TransferFormData) => {
      const balanceError = getBalanceError();
      if (balanceError) {
        addToast(balanceError, 'error');
        return;
      }

      if (!senderPublicKey) {
        addToast('Please connect your wallet first', 'error');
        return;
      }

      setShowConfirmation(true);
    },
    [getBalanceError, senderPublicKey, addToast]
  );

  /**
   * Step 2: User confirms in modal, execute the transfer.
   */
  const executeTransfer = useCallback(async () => {
    setShowConfirmation(false);
    setIsSubmitting(true);

    try {
      // Validate form data is still present
      if (!recipientValue || !amountValue || !senderPublicKey) {
        throw new Error('Form data is incomplete');
      }

      // ---------------------------------------------------------------
      // 1. Verify recipient has NOVA trustline (Acceptance Criteria 5.2)
      // ---------------------------------------------------------------

      addToast('Verifying recipient wallet...', 'info');

      try {
        const trustlineResponse = await api.post('/api/trustline/verify', {
          walletAddress: recipientValue,
        });

        if (
          !trustlineResponse.data?.data?.exists ||
          !trustlineResponse.data?.success
        ) {
          throw new Error(
            trustlineResponse.data?.message ||
              'Recipient does not have a NOVA trustline'
          );
        }
      } catch (trustlineErr) {
        const message =
          trustlineErr.response?.data?.message ||
          'Recipient does not have a NOVA trustline. They must create one first.';
        addToast(message, 'error');
        setIsSubmitting(false);
        return;
      }

      // ---------------------------------------------------------------
      // 2. Build unsigned Stellar payment transaction
      // ---------------------------------------------------------------

      addToast('Building transaction...', 'info');

      const server = new Horizon.Server(HORIZON_URL, { timeout: 15000 });
      const account = await server.loadAccount(senderPublicKey);
      const novaAsset = new Asset('NOVA', ISSUER_PUBLIC);

      const tx = new TransactionBuilder(account, {
        fee: BASE_FEE_STROOPS,
        networkPassphrase: NETWORK_PASSPHRASE,
      })
        .addOperation(
          Operation.payment({
            destination: recipientValue,
            asset: novaAsset,
            amount: String(amountValue),
          })
        )
        .setTimeout(180) // 3-minute timeout
        .build();

      // ---------------------------------------------------------------
      // 3. Sign with Freighter and submit to Horizon
      //    (Acceptance Criteria 5.3)
      // ---------------------------------------------------------------

      addToast('Requesting wallet signature...', 'info');

      const result = await signAndSubmit(tx.toXDR());
      const hash = result.txHash;
      setTxHash(hash);

      // ---------------------------------------------------------------
      // 4. Record transaction in backend
      // ---------------------------------------------------------------

      try {
        await api.post('/api/transactions/record', {
          txHash: hash,
          txType: 'transfer',
          amount: amountValue,
          fromWallet: senderPublicKey,
          toWallet: recipientValue,
        });
      } catch (recordErr) {
        // Log backend recording errors but don't fail the transfer
        console.error('Failed to record transaction in backend:', recordErr);
        // Transaction was successful on-chain even if recording failed
      }

      // ---------------------------------------------------------------
      // 5. Success! Show toast with explorer link and reset form
      //    (Acceptance Criteria 5.4 & 5.5)
      // ---------------------------------------------------------------

      const successMessage = (
        <div className="space-y-2">
          <p>✓ Transfer successful!</p>
          <a
            href={`https://stellar.expert/explorer/${NETWORK_NAME}/tx/${hash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-blue-300 hover:text-blue-100 underline"
          >
            View on Stellar Expert →
          </a>
        </div>
      );

      addToast(successMessage, 'success', 8000); // Longer duration for success

      // Reset form (Acceptance Criteria 5.5)
      reset();
      setTxHash('');

      // Call optional success callback
      onSuccess?.();
    } catch (err) {
      // ---------------------------------------------------------------
      // Error Handling — all cases
      // ---------------------------------------------------------------

      let errorMessage = 'Transfer failed. Please try again.';

      if (err.code === 'NETWORK_MISMATCH') {
        errorMessage =
          'Network mismatch. Please ensure Freighter is set to the correct network.';
      } else if (err.code === 'SIGN_REJECTED') {
        errorMessage = 'You rejected the signing request. Transfer cancelled.';
      } else if (err.code === 'SIGN_FAILED') {
        errorMessage =
          'Failed to sign transaction with your wallet. Please try again.';
      } else if (err.code === 'SUBMIT_FAILED') {
        // Parse Horizon error details
        const detail = err.message;
        if (detail.includes('UNDERFUNDED')) {
          errorMessage =
            'Insufficient balance to cover the transfer and network fee.';
        } else if (detail.includes('OP_NO_DESTINATION')) {
          errorMessage = 'Invalid recipient address.';
        } else if (detail.includes('NO_TRUST')) {
          errorMessage = 'Recipient does not have a NOVA trustline.';
        } else {
          errorMessage = `Transaction failed: ${detail}`;
        }
      } else if (err.response?.data?.error) {
        errorMessage = err.response.data.message || err.response.data.error;
      } else if (err.message) {
        errorMessage = err.message;
      }

      console.error('Transfer error:', err);
      addToast(errorMessage, 'error', 6000);
    } finally {
      setIsSubmitting(false);
    }
  }, [
    recipientValue,
    amountValue,
    senderPublicKey,
    addToast,
    reset,
    onSuccess,
  ]);

  // =====================================================================
  // Render
  // =====================================================================

  const isLoading = isSubmitting || formSubmitting;
  const balanceError = getBalanceError();
  const insufficientBalance = balanceError !== null;

  return (
    <>
      {/* Main Form */}
      <form onSubmit={handleSubmit(onSubmitToConfirmation)}>
        <div className="space-y-4">
          {/* Recipient Address Field */}
          <FormField
            id="transfer-recipient"
            label="Recipient Wallet Address"
            type="text"
            placeholder="G..."
            required
            disabled={isLoading}
            error={errors.recipient?.message}
            touched={!!errors.recipient}
            hint="Enter the Stellar public key (56 character address starting with G)"
            {...register('recipient')}
          />

          {/* Amount Field */}
          <FormField
            id="transfer-amount"
            label="Amount (NOVA)"
            type="number"
            min="0.0000001"
            step="any"
            placeholder="10.00"
            required
            disabled={isLoading}
            error={insufficientBalance ? balanceError : errors.amount?.message}
            touched={!!errors.amount || insufficientBalance}
            hint={`Available balance: ${senderBalance} NOVA | Network fee: ≈ ${FEE_IN_NOVA} NOVA`}
            {...register('amount')}
          />

          {/* Available Balance Info */}
          <div className="rounded-md bg-blue-50 p-3 text-sm text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
            <p>
              <strong>Your Balance:</strong> {senderBalance} NOVA
            </p>
            <p className="text-xs opacity-75 mt-1">
              Estimated fee: {FEE_IN_NOVA} NOVA per operation
            </p>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading || insufficientBalance || !senderPublicKey}
            className={[
              'w-full px-4 py-2 rounded-md font-medium transition-colors',
              'focus:outline-none focus:ring-2 focus:ring-offset-2',
              insufficientBalance || !senderPublicKey
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed dark:bg-gray-700 dark:text-gray-400'
                : isLoading
                  ? 'bg-purple-400 text-white cursor-wait'
                  : 'bg-purple-600 text-white hover:bg-purple-700 focus:ring-purple-500 dark:bg-purple-600 dark:hover:bg-purple-700',
            ].join(' ')}
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" />
                Sending…
              </span>
            ) : insufficientBalance ? (
              'Insufficient Balance'
            ) : !senderPublicKey ? (
              'Connect Wallet First'
            ) : (
              'Review & Send NOVA'
            )}
          </button>
        </div>
      </form>

      {/* Confirmation Modal */}
      <TransferConfirmationModal
        isOpen={showConfirmation}
        onConfirm={executeTransfer}
        onCancel={() => setShowConfirmation(false)}
        sender={senderPublicKey}
        recipient={recipientValue}
        amount={amountValue}
        fee={FEE_IN_NOVA}
        isSubmitting={isSubmitting}
      />
    </>
  );
}
