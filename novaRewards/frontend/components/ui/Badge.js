'use client';
import React from 'react';

/**
 * Badge component — status variants: success, warning, error, info.
 * Closes #610
 */
export default function Badge({ children, variant = 'info', className = '', ...props }) {
  return (
    <span className={`ui-badge ui-badge--${variant} ${className}`} {...props}>
      {children}
    </span>
  );
}
