'use client';

/**
 * Confirmation modal for reward redemptions.
 * Shows item details and points deduction before confirming.
 */
export default function RedemptionModal({
  isOpen,
  reward,
  currentPoints,
  onConfirm,
  onCancel,
  isLoading,
}) {
  if (!isOpen || !reward) return null;

  const pointsAfter = currentPoints - reward.cost;

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content redemption-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Confirm Redemption</h2>

        <div className="redemption-details">
          {reward.image_url && (
            <img
              src={reward.image_url}
              alt={reward.name}
              className="redemption-image"
            />
          )}

          <div className="redemption-info">
            <h3>{reward.name}</h3>
            {reward.description && (
              <p className="redemption-description">{reward.description}</p>
            )}
          </div>

          <div className="redemption-points">
            <div className="points-row">
              <span className="points-label">Current Points:</span>
              <span className="points-value">{currentPoints}</span>
            </div>
            <div className="points-row points-deduction">
              <span className="points-label">Cost:</span>
              <span className="points-value">-{reward.cost}</span>
            </div>
            <div className="points-row points-total">
              <span className="points-label">Points After:</span>
              <span className="points-value">{pointsAfter}</span>
            </div>
          </div>
        </div>

        <div className="modal-actions">
          <button
            className="btn btn-secondary"
            onClick={onCancel}
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading ? 'Processing...' : 'Confirm Redemption'}
          </button>
        </div>
      </div>
    </div>
  );
}
