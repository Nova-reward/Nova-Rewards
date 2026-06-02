'use client';

import { useState, useEffect, useRef } from 'react';
import Modal from './modal/Modal';

/**
 * ConfirmationModal — prevents accidental destructive actions.
 *
 * - Confirm button is styled red (destructive) and cancel has default focus.
 * - For high-value transfers, pass `requireTypedConfirmation` with the amount
 *   string; the user must type it before the confirm button enables.
 * - Dismissible via Escape and backdrop click (handled by base Modal).
 *
 * @param {{
 *   isOpen: boolean,
 *   onClose: () => void,
 *   onConfirm: () => void,
 *   title: string,
 *   description: string,
 *   confirmText?: string,
 *   cancelText?: string,
 *   requireTypedConfirmation?: string,  // e.g. "500" — user must type this
 *   loading?: boolean,
 * }} props
 */
export default function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  requireTypedConfirmation = null,
  loading = false,
}) {
  const [typedValue, setTypedValue] = useState('');
  const cancelRef = useRef(null);

  // Reset typed input when modal opens/closes
  useEffect(() => {
    if (!isOpen) setTypedValue('');
  }, [isOpen]);

  // Auto-focus cancel button when modal opens
  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => cancelRef.current?.focus());
    }
  }, [isOpen]);

  const typingRequired = Boolean(requireTypedConfirmation);
  const typingMatches = typedValue === String(requireTypedConfirmation);
  const canConfirm = !loading && (!typingRequired || typingMatches);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="sm"
      closeOnBackdrop={!loading}
      aria-describedby="confirm-modal-desc"
      footerActions={
        <div className="flex gap-3 w-full justify-end">
          <button
            ref={cancelRef}
            className="px-4 py-2 rounded-md text-sm font-medium bg-gray-100 text-gray-800 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-400 transition-colors disabled:opacity-50"
            onClick={onClose}
            disabled={loading}
          >
            {cancelText}
          </button>
          <button
            className="px-4 py-2 rounded-md text-sm font-medium bg-red-600 text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={onConfirm}
            disabled={!canConfirm}
            aria-disabled={!canConfirm}
          >
            {loading ? 'Processing…' : confirmText}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <p id="confirm-modal-desc" className="text-sm text-gray-600 leading-relaxed">
          {description}
        </p>

        <p className="text-xs font-medium text-red-600 uppercase tracking-wide">
          This action cannot be undone.
        </p>

        {typingRequired && (
          <div className="space-y-1">
            <label
              htmlFor="confirm-type-input"
              className="block text-sm text-gray-700"
            >
              Type <strong>{requireTypedConfirmation}</strong> to confirm
            </label>
            <input
              id="confirm-type-input"
              type="text"
              value={typedValue}
              onChange={(e) => setTypedValue(e.target.value)}
              placeholder={String(requireTypedConfirmation)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
              autoComplete="off"
              aria-label={`Type ${requireTypedConfirmation} to confirm`}
            />
          </div>
        )}
      </div>
    </Modal>
  );
}
