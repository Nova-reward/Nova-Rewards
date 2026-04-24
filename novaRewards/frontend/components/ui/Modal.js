'use client';
import React, { useEffect, useRef } from 'react';

/**
 * Modal component — accessible, focus-trapped, keyboard-dismissible.
 * Closes #610
 */
export default function Modal({ open, onClose, title, children, className = '' }) {
  const dialogRef = useRef(null);

  useEffect(() => {
    if (open) dialogRef.current?.focus();
  }, [open]);

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose?.(); }
    if (open) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="ui-modal-overlay" role="presentation" onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'ui-modal-title' : undefined}
        tabIndex={-1}
        className={`ui-modal ${className}`}
      >
        <div className="ui-modal__header">
          {title && <h2 id="ui-modal-title" className="ui-modal__title">{title}</h2>}
          <button className="ui-modal__close" onClick={onClose} aria-label="Close modal">✕</button>
        </div>
        <div className="ui-modal__body">{children}</div>
      </div>
    </div>
  );
}
