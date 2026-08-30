'use client';

import React, { ReactNode } from 'react';
import { ErrorProvider } from '@/context/ErrorContext';
import ErrorBoundary from './ErrorBoundary';
import { ErrorModal } from './ErrorModal';

interface ProvidersProps {
  children: ReactNode;
}

/**
 * Root providers component that wraps the entire application
 * Includes error handling, error context, and error boundary
 */
export function Providers({ children }: ProvidersProps) {
  return (
    <ErrorProvider>
      <ErrorBoundary>
        {children}
        {/* Global error modal for context-based errors */}
        <ErrorModal />
      </ErrorBoundary>
    </ErrorProvider>
  );
}
