'use client';
import React, { useId } from 'react';

/**
 * RadioGroup — accessible group of radio buttons with all states.
 * States: default, focused (via CSS ring on each option), error, disabled, readOnly
 *
 * @param {{
 *   legend: string,
 *   name: string,
 *   options: Array<{value: string, label: string}>,
 *   value: string,
 *   onChange: (value: string) => void,
 *   error?: string,
 *   hint?: string,
 *   required?: boolean,
 *   disabled?: boolean,
 *   readOnly?: boolean,
 * }} props
 */
export function RadioGroup({
  legend,
  name,
  options = [],
  value,
  onChange,
  error,
  hint,
  required = false,
  disabled = false,
  readOnly = false,
  className = '',
}) {
  const groupId = useId();
  const errorId = error ? `${groupId}-error` : undefined;

  return (
    <fieldset className={`space-y-2 ${className}`} aria-describedby={errorId}>
      <legend className="text-sm font-medium text-gray-700 dark:text-slate-300">
        {legend}
        {required && <span className="ml-1 text-red-500" aria-hidden="true">*</span>}
      </legend>

      <div className="space-y-2">
        {options.map((opt) => {
          const optId = `${groupId}-${opt.value}`;
          return (
            <div key={opt.value} className="flex items-center gap-2">
              <input
                type="radio"
                id={optId}
                name={name}
                value={opt.value}
                checked={value === opt.value}
                onChange={() => !readOnly && onChange(opt.value)}
                disabled={disabled}
                aria-readonly={readOnly || undefined}
                className={[
                  'h-4 w-4 border-gray-300 text-blue-600',
                  'focus:ring-2 focus:ring-blue-500 focus:ring-offset-1',
                  (disabled || readOnly) && 'opacity-60 cursor-not-allowed',
                ]
                  .filter(Boolean)
                  .join(' ')}
              />
              <label
                htmlFor={optId}
                className={[
                  'text-sm text-gray-700 dark:text-slate-300 select-none',
                  (disabled || readOnly) && 'opacity-60',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                {opt.label}
              </label>
            </div>
          );
        })}
      </div>

      {hint && !error && (
        <p className="text-xs text-gray-500">{hint}</p>
      )}
      {error && (
        <p id={errorId} role="alert" className="flex items-center gap-1 text-xs text-red-600">
          <svg className="w-3 h-3 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          {error}
        </p>
      )}
    </fieldset>
  );
}

export default RadioGroup;
