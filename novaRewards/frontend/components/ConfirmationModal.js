'use client';

/**
 * Confirmation modal for transaction operations.
 */
export default function ConfirmationModal({ 
  isOpen, 
  onConfirm, 
  onCancel, 
  recipient, 
  amount, 
  asset = 'NOVA',
  operation = 'transfer'
}) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h3>Confirm {operation}</h3>
        <div className="confirmation-details">
          <p><strong>Recipient:</strong> {recipient}</p>
          <p><strong>Amount:</strong> {amount} {asset}</p>
        </div>
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={onConfirm}>
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
