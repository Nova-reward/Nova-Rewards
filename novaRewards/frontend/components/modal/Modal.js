'use client';

import { useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { trapFocus, getFocusable } from '../../lib/focusTrap';

/**
 * Base Modal — renders via React Portal, traps focus, handles Esc,
 * animates with CSS classes, and restores focus on close.
 *
 * @param {{
 *   isOpen: boolean,
 *   onClose: () => void,
 *   title?: string,
 *   children: React.ReactNode,
 *   footerActions?: React.ReactNode,
 *   size?: 'sm'|'md'|'lg',
 *   closeOnBackdrop?: boolean,
 *   'aria-describedby'?: string,
 * }} props
 */
export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  footerActions,
  size = 'md',
  closeOnBackdrop = true,
  'aria-describedby': describedBy,
}) {
  const dialogRef  = useRef(null);
  const triggerRef = useRef(null); // element that had focus before open

  // Capture trigger element and lock body scroll on open
  useEffect(() => {
    if (isOpen) {
      triggerRef.current = document.activeElement;
      document.body.style.overflow = 'hidden';
      // Focus first focusable element after paint
      requestAnimationFrame(() => {
        const first = getFocusable(dialogRef.current ?? document)[0];
        first?.focus();
      });
    } else {
      document.body.style.overflow = '';
      triggerRef.current?.focus();
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') { onClose(); return; }
    if (dialogRef.current) trapFocus(dialogRef.current, e);
  }, [onClose]);

  if (!isOpen) return null;
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="modal-overlay modal-overlay-animated"
      onClick={closeOnBackdrop ? onClose : undefined}
      aria-modal="true"
      role="dialog"
      aria-labelledby={title ? 'modal-title' : undefined}
      aria-describedby={describedBy}
      onKeyDown={handleKeyDown}
    >
      <div
        ref={dialogRef}
        className={`modal-content modal-content-animated modal-${size}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        {(title || onClose) && (
          <div className="modal-header">
            {title && <h3 id="modal-title" className="modal-title">{title}</h3>}
            <button
              className="modal-close-btn"
              onClick={onClose}
              aria-label="Close dialog"
            >
              ✕
            </button>
          </div>
        )}

        {/* Body */}
        <div className="modal-body">{children}</div>

        {/* Footer */}
        {footerActions && (
          <div className="modal-footer modal-actions">{footerActions}</div>
        )}
      </div>
    </div>,
    document.body
  );
}
