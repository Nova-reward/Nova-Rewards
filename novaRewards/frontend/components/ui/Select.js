'use client';
import React from 'react';

/**
 * Select component — supports label, error state, helper text.
 * Closes #610
 */
export default function Select({
  id,
  label,
  options = [],
  error,
  helperText,
  className = '',
  ...props
}) {
  const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);
  const hasError = Boolean(error);

  return (
    <div className={`ui-select-wrapper ${className}`}>
      {label && (
        <label className="ui-input__label" htmlFor={selectId}>
          {label}
        </label>
      )}
      <select
        id={selectId}
        className={`ui-select ${hasError ? 'ui-input--error' : ''}`}
        aria-invalid={hasError}
        {...props}
      >
        {options.map(({ value, label: optLabel }) => (
          <option key={value} value={value}>{optLabel}</option>
        ))}
      </select>
      {error && <span className="ui-input__error" role="alert">{error}</span>}
      {helperText && !error && <span className="ui-input__helper">{helperText}</span>}
    </div>
  );
}
