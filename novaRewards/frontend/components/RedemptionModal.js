'use client';

import { useState } from 'react';
import Image from 'next/image';

/**
 * Multi-step redemption modal:
 *   1. Review – show reward details & select amount
 *   2. Sign   – prompt wallet signature
 *   3. Status – real-time transaction tracking (pending → success/error)
 */
export default function RedemptionModal({
  isOpen,
  reward,
  currentPoints,
  onConfirm,   // async fn(amount) → throws on error
  onCancel,
  isLoading,
  txStatus,    // 'idle' | 'pending' | 'success' | 'error'
  txHash,
  txError,
}) {
  const [amount, setAmount] = useState(1);

  if (!isOpen || !reward) return null;

  const maxAmount = reward.stock > 0 ? Math.min(reward.stock, Math.floor(currentPoints / reward.cost)) : 0;
  const totalCost = reward.cost * amount;
  const pointsAfter = currentPoints - totalCost;
  const canConfirm = amount >= 1 && amount <= maxAmount && !isLoading;

  // Determine which step to show
  const step = txStatus === 'idle' ? 'review' : txStatus;

  const handleConfirm = () => {
    onConfirm(amount);
  };

  return (
    <div className="modal-overlay" onClick={txStatus === 'idle' ? onCancel : undefined}>
      <div className="modal-content redemption-modal" onClick={(e) => e.stopPropagation()}>

        {/* ── Step: Review & select amount ── */}
        {step === 'review' && (
          <>
            <h2>Confirm Redemption</h2>

            <div className="redemption-details">
              {reward.image_url && (
                <div style={{ position: 'relative', width: '100%', height: '160px', borderRadius: '8px', overflow: 'hidden' }}>
                  <Image src={reward.image_url} alt={reward.name} fill sizes="(max-width: 600px) 100vw, 480px" style={{ objectFit: 'cover' }} className="redemption-image" />
                </div>
              )}
              <div className="redemption-info">
                <h3>{reward.name}</h3>
                {reward.description && (
                  <p className="redemption-description">{reward.description}</p>
                )}
                {reward.category && (
                  <span className="badge badge-gray">{reward.category}</span>
                )}
              </div>
            </div>

            {/* Amount selector */}
            {maxAmount > 1 && (
              <div className="redemption-amount-row">
                <label className="label" htmlFor="redeem-amount">Quantity</label>
                <div className="amount-stepper">
                  <button
                    className="btn btn-secondary stepper-btn"
                    onClick={() => setAmount((a) => Math.max(1, a - 1))}
                    disabled={amount <= 1}
                    aria-label="Decrease quantity"
                  >−</button>
                  <input
                    id="redeem-amount"
                    type="number"
                    className="input stepper-input"
                    min={1}
                    max={maxAmount}
                    value={amount}
                    onChange={(e) => {
                      const v = Math.max(1, Math.min(maxAmount, Number(e.target.value)));
                      setAmount(v);
                    }}
                  />
                  <button
                    className="btn btn-secondary stepper-btn"
                    onClick={() => setAmount((a) => Math.min(maxAmount, a + 1))}
                    disabled={amount >= maxAmount}
                    aria-label="Increase quantity"
                  >+</button>
                </div>
              </div>
            )}

            <div className="redemption-points">
              <div className="points-row">
                <span className="points-label">Your Points</span>
                <span className="points-value">{currentPoints.toLocaleString()}</span>
              </div>
              <div className="points-row points-deduction">
                <span className="points-label">Cost ({amount} × {reward.cost})</span>
                <span className="points-value">−{totalCost.toLocaleString()}</span>
              </div>
              <div className="points-row points-total">
                <span className="points-label">Points After</span>
                <span className="points-value">{pointsAfter.toLocaleString()}</span>
              </div>
            </div>

            <p className="redemption-wallet-note">
              🔐 You will be asked to sign this transaction with your wallet.
            </p>

            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={onCancel} disabled={isLoading}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleConfirm}
                disabled={!canConfirm}
              >
                Sign & Redeem
              </button>
            </div>
          </>
        )}

        {/* ── Step: Pending (waiting for signature / broadcast) ── */}
        {step === 'pending' && (
          <div className="tx-status-panel">
            <div className="tx-spinner" aria-label="Processing" />
            <h3>Waiting for Wallet Signature…</h3>
            <p className="tx-status-msg">Please approve the transaction in your Freighter wallet.</p>
          </div>
        )}

        {/* ── Step: Success ── */}
        {step === 'success' && (
          <div className="tx-status-panel">
            <div className="tx-icon tx-icon-success" aria-hidden="true">✓</div>
            <h3>Redemption Successful!</h3>
            <p className="tx-status-msg">
              You redeemed <strong>{reward.name}</strong>.
            </p>
            {txHash && (
              <a
                className="tx-hash-link"
                href={`https://stellar.expert/explorer/testnet/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                View on Stellar Explorer ↗
              </a>
            )}
            <div className="modal-actions">
              <button className="btn btn-primary" onClick={onCancel}>Done</button>
            </div>
          </div>
        )}

        {/* ── Step: Error ── */}
        {step === 'error' && (
          <div className="tx-status-panel">
            <div className="tx-icon tx-icon-error" aria-hidden="true">✕</div>
            <h3>Redemption Failed</h3>
            <p className="tx-status-msg error">{txError || 'An unexpected error occurred.'}</p>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={onCancel}>Close</button>
              <button className="btn btn-primary" onClick={() => onConfirm(amount)}>Retry</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
