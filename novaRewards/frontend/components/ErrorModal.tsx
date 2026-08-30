'use client';

import React, { useEffect } from 'react';
import { useError } from '@/context/ErrorContext';
import ErrorDisplay from './ErrorDisplay';

/**
 * Modal component for displaying context-based errors
 * Use this to display application-level errors alongside normal content
 */
export function ErrorModal() {
  const { error, clearError, hasError } = useError();
  const [isOpen, setIsOpen] = React.useState(false);

  useEffect(() => {
    setIsOpen(hasError);
  }, [hasError]);

  if (!isOpen || !error) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl">
          {/* Close button */}
          <button
            onClick={clearError}
            className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 z-10"
            aria-label="Close error modal"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>

          {/* Error display content */}
          <div className="px-6 py-8">
            <ErrorDisplay error={error} onRetry={clearError} />
          </div>
        </div>
      </div>
    </div>
  );
}
