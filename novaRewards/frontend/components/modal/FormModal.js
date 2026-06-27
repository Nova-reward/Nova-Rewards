'use client';

import Modal from './Modal';

/**
 * FormModal — wraps a form with submit/cancel footer actions.
 * The `onSubmit` handler receives the native form submit event.
 *
 * @param {{
 *   isOpen: boolean,
 *   onClose: () => void,
 *   onSubmit: (e: React.FormEvent) => void,
 *   title: string,
 *   children: React.ReactNode,
 *   submitText?: string,
 *   loading?: boolean,
 *   size?: 'sm'|'md'|'lg',
 * }} props
 */
export default function FormModal({
  isOpen,
  onClose,
  onSubmit,
  title,
  children,
  submitText = 'Submit',
  loading    = false,
  size       = 'md',
}) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size={size}
      closeOnBackdrop={!loading}
      footerActions={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button
            type="submit"
            form="form-modal-form"
            className="btn btn-primary"
            disabled={loading}
          >
            {loading ? 'Saving…' : submitText}
          </button>
        </>
      }
    >
      <form id="form-modal-form" onSubmit={onSubmit}>
        {children}
      </form>
    </Modal>
  );
}
