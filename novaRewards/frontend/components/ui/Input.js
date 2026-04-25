'use client';
import React from 'react';

/**
 * Input component — types: text, number. Supports label, error state, helper text.
 * Closes #610
 */
export default function Input({
  id,
  label,
  type = 'text',
  error,
  helperText,
  className = '',
  ...props
}) {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);
  const hasError = Boolean(error);

  return (
    <div className={`ui-input-wrapper ${className}`}>
      {label && (
        <label className="ui-input__label" htmlFor={inputId}>
          {label}
        </label>
      )}
      <input
        id={inputId}
        type={type}
        className={`ui-input ${hasError ? 'ui-input--error' : ''}`}
        aria-invalid={hasError}
        aria-describedby={
          [error && `${inputId}-error`, helperText && `${inputId}-helper`]
            .filter(Boolean).join(' ') || undefined
        }
        {...props}
      />
      {error && (
        <span id={`${inputId}-error`} className="ui-input__error" role="alert">
          {error}
        </span>
      )}
      {helperText && !error && (
        <span id={`${inputId}-helper`} className="ui-input__helper">
          {helperText}
        </span>
      )}
    </div>
  );
}
