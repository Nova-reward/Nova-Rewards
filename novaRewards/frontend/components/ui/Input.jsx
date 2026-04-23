import React, { forwardRef, useId } from 'react';

export const Input = forwardRef(({ className = '', error, id, label, ...props }, ref) => {
  const generatedId = useId();
  const inputId = id || generatedId;
  const errorId = error ? `${inputId}-error` : undefined;

  const baseStyle = 'flex h-10 w-full rounded-md border border-gray-300 bg-transparent px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50';
  const errorStyle = error ? 'border-red-500 focus:ring-red-500' : '';

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
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
        <span id={errorId} role="alert" className="text-sm text-red-500 mt-1 block">
          {error}
        </span>
      )}
    </div>
  );
});

Input.displayName = 'Input';
