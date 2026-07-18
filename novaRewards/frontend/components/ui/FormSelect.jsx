'use client';
import React, { forwardRef, useId } from 'react';

/**
 * FormSelect — accessible select/dropdown with all states.
 * States: default, focused (via CSS), error, disabled, readOnly (via disabled+aria)
 *
 * @param {{ options: Array<{value: string, label: string}> }} props
 */
export const FormSelect = forwardRef(function FormSelect(
  {
    label,
    id,
    options = [],
    error,
    hint,
    required = false,
    disabled = false,
    readOnly = false,
    placeholder,
    className = '',
    ...props
  },
  ref
) {
  const generatedId = useId();
  const selectId = id || generatedId;
  const errorId = error ? `${selectId}-error` : undefined;
  const hintId = hint && !error ? `${selectId}-hint` : undefined;

  return (
    <div className={`space-y-1 ${className}`}>
      {label && (
        <label htmlFor={selectId} className="block text-sm font-medium text-gray-700 dark:text-slate-300">
          {label}
          {required && <span className="ml-1 text-red-500" aria-hidden="true">*</span>}
        </label>
      )}
      <select
        ref={ref}
        id={selectId}
        disabled={disabled || readOnly}
        required={required}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={[errorId, hintId].filter(Boolean).join(' ') || undefined}
        aria-readonly={readOnly || undefined}
        className={[
          'block w-full rounded-md border px-3 py-2 text-sm',
          'focus:outline-none focus:ring-2',
          error
            ? 'border-red-500 focus:ring-red-400 bg-white'
            : 'border-gray-300 focus:ring-blue-500 bg-white',
          (disabled || readOnly) && 'bg-gray-100 cursor-not-allowed opacity-60',
        ]
          .filter(Boolean)
          .join(' ')}
        {...props}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map(({ value, label: optLabel }) => (
          <option key={value} value={value}>{optLabel}</option>
        ))}
      </select>
      {hint && !error && (
        <p id={hintId} className="text-xs text-gray-500">{hint}</p>
      )}
      {error && (
        <p id={errorId} role="alert" className="flex items-center gap-1 text-xs text-red-600">
          <svg className="w-3 h-3 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          {error}
        </p>
      )}
    </div>
  );
});

export default FormSelect;
