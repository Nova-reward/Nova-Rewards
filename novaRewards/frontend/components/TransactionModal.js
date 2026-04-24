'use client';
import { useEffect, useRef } from 'react';
import { useFocusTrap } from '../lib/focusTrap';

/**
 * TransactionModal — reusable modal for the full on-chain transaction flow.
 *
 * States: 'confirm' | 'loading' | 'success' | 'error'
 *
 * Props:
 *   state        - current modal state
 *   action       - human label e.g. "Redeem", "Stake", "Transfer"
 *   amount       - token amount string
 *   asset        - asset code, default "NOVA"
 *   feeEstimate  - fee string e.g. "0.00001 XLM"
 *   walletAddress - truncated or full address shown in confirm step
 *   irreversible - boolean, shows warning banner when true
 *   txHash       - Stellar tx hash (success state)
 *   errorMessage - error text (error state)
 *   onConfirm    - called when user clicks Confirm
 *   onClose      - called when modal should close
 *   onRetry      - called when user clicks Retry (error state)
 *
 * Issue #616
 */
export default function TransactionModal({
  state = 'confirm',
  action = 'Transaction',
  amount,
  asset = 'NOVA',
  feeEstimate,
  walletAddress,
  irreversible = false,
  txHash,
  errorMessage,
  onConfirm,
  onClose,
  onRetry,
}) {
  const overlayRef = useRef(null);
  useFocusTrap(overlayRef, state !== null);

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape' && state !== 'loading') onClose?.(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [state, onClose]);

  return (
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="tx-modal-title"
      className="tx-modal-overlay"
      onClick={(e) => { if (e.target === e.currentTarget && state !== 'loading') onClose?.(); }}
    >
      <div className="tx-modal-panel">
        {state === 'confirm'  && <ConfirmStep  {...{ action, amount, asset, feeEstimate, walletAddress, irreversible, onConfirm, onClose }} />}
        {state === 'loading'  && <LoadingStep  action={action} />}
        {state === 'success'  && <SuccessStep  {...{ txHash, onClose }} />}
        {state === 'error'    && <ErrorStep    {...{ errorMessage, onRetry, onClose }} />}
      </div>
    </div>
  );
}

/* ── Sub-steps ─────────────────────────────────────────────────────────── */

function ConfirmStep({ action, amount, asset, feeEstimate, walletAddress, irreversible, onConfirm, onClose }) {
  return (
    <>
      <h2 id="tx-modal-title" className="tx-modal-title">Confirm {action}</h2>

      <dl className="tx-modal-details">
        <div><dt>Action</dt><dd>{action}</dd></div>
        {amount       && <div><dt>Amount</dt><dd>{amount} {asset}</dd></div>}
        {feeEstimate  && <div><dt>Network fee</dt><dd>{feeEstimate}</dd></div>}
        {walletAddress && <div><dt>Wallet</dt><dd className="tx-modal-address">{walletAddress}</dd></div>}
      </dl>

      {irreversible && (
        <p role="alert" className="tx-modal-warning">
          ⚠️ This action is irreversible and cannot be undone.
        </p>
      )}

      <div className="tx-modal-actions">
        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary"   onClick={onConfirm}>Confirm {action}</button>
      </div>
    </>
  );
}

function LoadingStep({ action }) {
  return (
    <div className="tx-modal-center" role="status" aria-live="polite">
      <span className="tx-modal-spinner" aria-hidden="true" />
      <p id="tx-modal-title">Signing &amp; submitting {action}…</p>
      <p className="tx-modal-sub">Please approve in your wallet.</p>
    </div>
  );
}

function SuccessStep({ txHash, onClose }) {
  const explorerUrl = `https://stellar.expert/explorer/testnet/tx/${txHash}`;
  return (
    <>
      <div className="tx-modal-center">
        <span className="tx-modal-icon tx-modal-icon--success" aria-hidden="true">✓</span>
        <h2 id="tx-modal-title" className="tx-modal-title">Transaction Confirmed</h2>
        {txHash && (
          <p className="tx-modal-sub">
            <a href={explorerUrl} target="_blank" rel="noopener noreferrer" className="tx-modal-link">
              View on Stellar Explorer ↗
            </a>
          </p>
        )}
      </div>
      <div className="tx-modal-actions tx-modal-actions--center">
        <button className="btn btn-primary" onClick={onClose}>Done</button>
      </div>
    </>
  );
}

function ErrorStep({ errorMessage, onRetry, onClose }) {
  return (
    <>
      <div className="tx-modal-center">
        <span className="tx-modal-icon tx-modal-icon--error" aria-hidden="true">✕</span>
        <h2 id="tx-modal-title" className="tx-modal-title">Transaction Failed</h2>
        {errorMessage && <p className="tx-modal-sub tx-modal-error-msg">{errorMessage}</p>}
      </div>
      <div className="tx-modal-actions">
        <button className="btn btn-secondary" onClick={onClose}>Close</button>
        {onRetry && <button className="btn btn-primary" onClick={onRetry}>Retry</button>}
      </div>
    </>
  );
}
