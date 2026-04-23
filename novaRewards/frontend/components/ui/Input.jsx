import React, { forwardRef } from 'react';

export const Input = forwardRef(({ className = '', error, ...props }, ref) => {
  const baseStyle = 'flex h-10 w-full rounded-md border border-gray-300 bg-transparent px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50';
  const errorStyle = error ? 'border-red-500 focus:ring-red-500' : '';
  
  return (
    <div className="w-full">
      <input
        ref={ref}
        className={`${baseStyle} ${errorStyle} ${className}`}
        {...props}
      />
      {error && <span className="text-sm text-red-500 mt-1">{error}</span>}
    </div>
  );
});

Input.displayName = 'Input';
