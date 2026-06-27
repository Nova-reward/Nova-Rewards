'use client';
import React, { forwardRef, useId } from 'react';

/**
 * Textarea — accessible multi-line input with all states.
 * States: default, focused (via CSS), error, disabled, readOnly
 */
export const Textarea = forwardRef(function Textarea(
  {
    label,
    id,
    error,
    hint,
    required = false,
    disabled = false,
    readOnly = false,
    rows = 4,
    className = '',
    ...props
  },
  ref
) {
  const generatedId = useId();
  const textareaId = id || generatedId;
  const errorId = error ? `${textareaId}-error` : undefined;
  const hintId = hint && !error ? `${textareaId}-hint` : undefined;

  return (
    <div className={`space-y-1 ${className}`}>
      {label && (
        <label htmlFor={textareaId} className="block text-sm font-medium text-gray-700 dark:text-slate-300">
          {label}
          {required && <span className="ml-1 text-red-500" aria-hidden="true">*</span>}
        </label>
      )}
      <textarea
        ref={ref}
        id={textareaId}
        rows={rows}
        disabled={disabled}
        readOnly={readOnly}
        required={required}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={[errorId, hintId].filter(Boolean).join(' ') || undefined}
        className={[
          'block w-full rounded-md border px-3 py-2 text-sm resize-y',
          'focus:outline-none focus:ring-2',
          error
            ? 'border-red-500 focus:ring-red-400 bg-white'
            : 'border-gray-300 focus:ring-blue-500 bg-white',
          disabled && 'bg-gray-100 cursor-not-allowed opacity-60',
          readOnly && 'bg-gray-50 cursor-default',
        ]
          .filter(Boolean)
          .join(' ')}
        {...props}
      />
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

export default Textarea;
