import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ErrorBoundary from '../components/ErrorBoundary';
import * as Sentry from '@sentry/nextjs';

// Mock Sentry
jest.mock('@sentry/nextjs', () => ({
  captureException: jest.fn(),
  withScope: jest.fn((callback) => callback({ setExtras: jest.fn() })),
  showReportDialog: jest.fn(),
}));

// Component that throws an error
function BrokenComponent({ shouldThrow }) {
  if (shouldThrow) {
    throw new Error('Test error');
  }
  return <div>Working component</div>;
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Suppress console.error for cleaner test output
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    console.error.mockRestore();
  });

  it('renders children when there is no error', () => {
    render(
      <ErrorBoundary>
        <BrokenComponent shouldThrow={false} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Working component')).toBeInTheDocument();
  });

  it('renders error UI when an error is thrown', () => {
    render(
      <ErrorBoundary>
        <BrokenComponent shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText(/We encountered an unexpected error/)).toBeInTheDocument();
  });

  it('reports error to Sentry when error occurs', () => {
    render(
      <ErrorBoundary>
        <BrokenComponent shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(Sentry.captureException).toHaveBeenCalled();
    expect(Sentry.withScope).toHaveBeenCalled();
  });

  it('shows Try Again and Go Home buttons', () => {
    render(
      <ErrorBoundary>
        <BrokenComponent shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Try Again')).toBeInTheDocument();
    expect(screen.getByText('Go Home')).toBeInTheDocument();
  });

  it('resets error state when Try Again is clicked', () => {
    const { rerender } = render(
      <ErrorBoundary>
        <BrokenComponent shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();

    // Mock window.location.reload
    delete window.location;
    window.location = { reload: jest.fn() };

    const tryAgainButton = screen.getByText('Try Again');
    fireEvent.click(tryAgainButton);

    expect(window.location.reload).toHaveBeenCalled();
  });

  it('shows Report Feedback button when eventId is present', () => {
    // Mock Sentry to return an eventId
    Sentry.captureException.mockReturnValue('test-event-id');

    render(
      <ErrorBoundary>
        <BrokenComponent shouldThrow={true} />
      </ErrorBoundary>
    );

    const reportButton = screen.getByText('Report Feedback');
    expect(reportButton).toBeInTheDocument();

    fireEvent.click(reportButton);
    expect(Sentry.showReportDialog).toHaveBeenCalledWith({ eventId: 'test-event-id' });
  });

  it('shows error message in development mode', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    render(
      <ErrorBoundary>
        <BrokenComponent shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText(/Error: Test error/)).toBeInTheDocument();

    process.env.NODE_ENV = originalEnv;
  });

  it('applies correct CSS classes for styling', () => {
    const { container } = render(
      <ErrorBoundary>
        <BrokenComponent shouldThrow={true} />
      </ErrorBoundary>
    );

    const errorContainer = container.querySelector('.min-h-screen');
    expect(errorContainer).toBeInTheDocument();
  });
});
