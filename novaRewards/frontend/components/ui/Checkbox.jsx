'use client';
import React, { forwardRef, useId } from 'react';

/**
 * Checkbox — accessible checkbox with all states.
 * States: default, focused (via CSS ring), error, disabled, readOnly
 */
export const Checkbox = forwardRef(function Checkbox(
  {
    label,
    id,
    error,
    hint,
    required = false,
    disabled = false,
    readOnly = false,
    className = '',
    ...props
  },
  ref
) {
  const generatedId = useId();
  const checkboxId = id || generatedId;
  const errorId = error ? `${checkboxId}-error` : undefined;

  return (
    <div className={`space-y-1 ${className}`}>
      <div className="flex items-start gap-2">
        <input
          ref={ref}
          type="checkbox"
          id={checkboxId}
          disabled={disabled || readOnly}
          required={required}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={errorId}
          aria-readonly={readOnly || undefined}
          className={[
            'mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600',
            'focus:ring-2 focus:ring-blue-500 focus:ring-offset-1',
            (disabled || readOnly) && 'opacity-60 cursor-not-allowed',
          ]
            .filter(Boolean)
            .join(' ')}
          {...props}
        />
        {label && (
          <label
            htmlFor={checkboxId}
            className={[
              'text-sm text-gray-700 dark:text-slate-300 select-none',
              (disabled || readOnly) && 'opacity-60',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {label}
            {required && <span className="ml-1 text-red-500" aria-hidden="true">*</span>}
          </label>
        )}
      </div>
      {hint && !error && (
        <p className="text-xs text-gray-500 pl-6">{hint}</p>
      )}
      {error && (
        <p id={errorId} role="alert" className="flex items-center gap-1 text-xs text-red-600 pl-6">
          <svg className="w-3 h-3 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          {error}
        </p>
      )}
    </div>
  );
});

export default Checkbox;
