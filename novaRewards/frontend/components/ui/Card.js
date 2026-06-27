'use client';
import React from 'react';

/**
 * Card component — variants: default, elevated, bordered.
 * Closes #610
 */
export default function Card({ children, variant = 'default', className = '', ...props }) {
  return (
    <div className={`ui-card ui-card--${variant} ${className}`} {...props}>
      {children}
    </div>
  );
}
