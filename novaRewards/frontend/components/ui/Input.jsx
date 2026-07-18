import React, { forwardRef, useId } from 'react';

export const Input = forwardRef(({ className = '', error, id, label, ...props }, ref) => {
  const generatedId = useId();
  const inputId = id || generatedId;
  const errorId = error ? `${inputId}-error` : undefined;

  const baseStyle =
    'flex h-10 w-full rounded-md border border-neutral-300 bg-transparent px-3 py-2 type-body-sm ' +
    'placeholder:text-neutral-400 ' +
    'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ' +
    'disabled:cursor-not-allowed disabled:opacity-50 ' +
    'dark:border-neutral-600 dark:placeholder:text-neutral-500 ' +
    'dark:focus:ring-primary-400 dark:focus:border-primary-400';

  const errorStyle = error
    ? 'border-error-500 focus:ring-error-500 focus:border-error-500 dark:border-error-400 dark:focus:ring-error-400'
    : '';

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className="block type-label text-neutral-700 dark:text-neutral-300 mb-1">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        className={`${baseStyle} ${errorStyle} ${className}`}
        aria-describedby={errorId}
        aria-invalid={error ? 'true' : undefined}
        {...props}
      />
      {error && (
        <span id={errorId} role="alert" className="type-caption text-error-600 dark:text-error-400 mt-1 block">
          {error}
        </span>
      )}
    </div>
  );
});

Input.displayName = 'Input';
