'use client';

import Modal from './Modal';

/**
 * ConfirmDialog — two-action confirmation (confirm / cancel).
 *
 * @param {{
 *   isOpen: boolean,
 *   onClose: () => void,
 *   onConfirm: () => void,
 *   title: string,
 *   message: React.ReactNode,
 *   confirmText?: string,
 *   cancelText?: string,
 *   destructive?: boolean,
 *   loading?: boolean,
 * }} props
 */
export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText  = 'Cancel',
  destructive = false,
  loading     = false,
}) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="sm"
      closeOnBackdrop={!loading}
      footerActions={
        <>
          <button className="btn btn-secondary" onClick={onClose} disabled={loading}>
            {cancelText}
          </button>
          <button
            className={`btn ${destructive ? 'btn-danger' : 'btn-primary'}`}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? 'Processing…' : confirmText}
          </button>
        </>
      }
    >
      <div style={{ color: 'var(--muted)', lineHeight: 1.6 }}>{message}</div>
    </Modal>
  );
}
