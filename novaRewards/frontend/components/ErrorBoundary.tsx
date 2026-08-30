'use client';

import React, { ReactNode } from 'react';
import * as Sentry from '@sentry/nextjs';
import {
  createStructuredError,
  reportStructuredError,
  StructuredError,
} from '@/lib/errorService';
import ErrorDisplay from './ErrorDisplay';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: StructuredError, errorInfo: React.ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: StructuredError | null;
  errorInfo: React.ErrorInfo | null;
  eventId: string | null;
}

/**
 * Enhanced Error Boundary component with structured error handling
 * Catches React runtime errors and displays user-friendly error UI
 */
export default class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      eventId: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error: createStructuredError(error),
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Create structured error
    const structuredError = createStructuredError(error);

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Error caught by boundary:', error, errorInfo);
    }

    // Report to Sentry
    const eventId = reportStructuredError(structuredError, {
      componentStack: errorInfo.componentStack,
      errorBoundary: true,
    });

    // Update state
    this.setState({ errorInfo, eventId });

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(structuredError, errorInfo);
    }

    // Add breadcrumb for debugging
    Sentry.addBreadcrumb({
      category: 'error-boundary',
      message: error.message,
      level: 'error',
      data: {
        componentStack: errorInfo.componentStack,
      },
    });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      eventId: null,
    });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError && this.state.error) {
      return (
        <ErrorDisplay
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          eventId={this.state.eventId}
          onRetry={this.handleReset}
          onReload={this.handleReload}
          isDevelopment={process.env.NODE_ENV === 'development'}
        />
      );
    }

    return this.props.children;
  }
}

/**
 * Higher-order component to wrap components with ErrorBoundary
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name || 'Component'})`;

  return WrappedComponent;
}
