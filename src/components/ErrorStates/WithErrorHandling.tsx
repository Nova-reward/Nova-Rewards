import React from 'react';
import { ErrorState } from './ErrorState';
import { InlineError } from './InlineError';
import { AppError } from '@/types/errors';

export interface WithErrorHandlingProps {
  isLoading: boolean;
  error: AppError | null;
  onRetry: () => void;
  showInline?: boolean;
  loadingFallback?: React.ReactNode;
  children: React.ReactNode;
}

export const WithErrorHandling: React.FC<WithErrorHandlingProps> = ({
  isLoading,
  error,
  onRetry,
  showInline = false,
  loadingFallback,
  children,
}) => {
  if (isLoading) {
    if (loadingFallback) {
      return <>{loadingFallback}</>;
    }
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-green-500 border-t-transparent" />
      </div>
    );
  }

  if (error) {
    if (showInline) {
      return (
        <InlineError
          message={error.message}
          onRetry={onRetry}
          size="md"
        />
      );
    }
    
    return (
      <ErrorState
        type={error.type}
        message={error.message}
        onRetry={onRetry}
        statusCode={error.statusCode}
      />
    );
  }

  return <>{children}</>;
};

export default WithErrorHandling;
