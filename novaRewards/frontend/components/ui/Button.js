'use client';
import React from 'react';

/**
 * Button component — variants: primary, secondary, ghost, danger
 * Sizes: sm, md, lg. Supports loading state.
 * Closes #610
 */
export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  type = 'button',
  onClick,
  className = '',
  ...props
}) {
  const base = 'ui-btn';
  const cls = [base, `ui-btn--${variant}`, `ui-btn--${size}`, className]
    .filter(Boolean).join(' ');

  return (
    <button
      type={type}
      className={cls}
      disabled={disabled || loading}
      onClick={onClick}
      aria-busy={loading}
      {...props}
    >
      {loading && <span className="ui-btn__spinner" aria-hidden="true" />}
      {children}
    </button>
  );
}
