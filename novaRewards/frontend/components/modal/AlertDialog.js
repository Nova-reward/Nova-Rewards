'use client';

import Modal from './Modal';

const ICONS = { warning: '⚠️', error: '🚨', info: 'ℹ️', success: '✅' };

/**
 * AlertDialog — non-destructive informational/warning alert.
 *
 * @param {{
 *   isOpen: boolean,
 *   onClose: () => void,
 *   title: string,
 *   message: React.ReactNode,
 *   variant?: 'warning'|'error'|'info'|'success',
 *   confirmText?: string,
 * }} props
 */
export default function AlertDialog({
  isOpen,
  onClose,
  title,
  message,
  variant = 'warning',
  confirmText = 'OK',
}) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${ICONS[variant]} ${title}`}
      size="sm"
      closeOnBackdrop={false}
      footerActions={
        <button className="btn btn-primary" onClick={onClose}>{confirmText}</button>
      }
    >
      <p style={{ color: 'var(--muted)', lineHeight: 1.6 }}>{message}</p>
    </Modal>
  );
}
