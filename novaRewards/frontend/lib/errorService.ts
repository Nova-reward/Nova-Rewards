import * as Sentry from '@sentry/nextjs';

/**
 * Error type classification for better error handling and UI display
 */
export type ErrorType =
  | 'not_found'
  | 'unauthorized'
  | 'forbidden'
  | 'validation'
  | 'network'
  | 'timeout'
  | 'server'
  | 'blockchain'
  | 'wallet'
  | 'unknown';

/**
 * Error severity levels
 */
export type ErrorSeverity = 'info' | 'warning' | 'error' | 'critical';

/**
 * Structured error object
 */
export interface StructuredError {
  type: ErrorType;
  severity: ErrorSeverity;
  statusCode?: number;
  message: string;
  userMessage: string;
  details?: Record<string, unknown>;
  retryable: boolean;
  retryAfter?: number;
  originalError?: Error;
  timestamp: number;
  requestId?: string;
}

/**
 * Classify error type from status code or error object
 */
export function classifyErrorType(
  error: Error | unknown,
  statusCode?: number
): ErrorType {
  if (statusCode) {
    if (statusCode === 404) return 'not_found';
    if (statusCode === 401) return 'unauthorized';
    if (statusCode === 403) return 'forbidden';
    if (statusCode === 422 || statusCode === 400) return 'validation';
    if (statusCode >= 500) return 'server';
  }

  const errorMsg = error instanceof Error ? error.message.toLowerCase() : '';

  if (
    errorMsg.includes('network') ||
    errorMsg.includes('fetch') ||
    errorMsg.includes('connection')
  ) {
    return 'network';
  }

  if (errorMsg.includes('timeout') || errorMsg.includes('timed out')) {
    return 'timeout';
  }

  if (
    errorMsg.includes('wallet') ||
    errorMsg.includes('stellar') ||
    errorMsg.includes('contract')
  ) {
    return 'blockchain';
  }

  if (errorMsg.includes('permission') || errorMsg.includes('auth')) {
    return 'unauthorized';
  }

  return 'unknown';
}

/**
 * Determine error severity
 */
export function getErrorSeverity(type: ErrorType): ErrorSeverity {
  switch (type) {
    case 'not_found':
    case 'validation':
      return 'warning';
    case 'unauthorized':
    case 'forbidden':
      return 'warning';
    case 'timeout':
    case 'network':
      return 'warning';
    case 'server':
      return 'critical';
    case 'blockchain':
      return 'error';
    case 'wallet':
      return 'error';
    default:
      return 'error';
  }
}

/**
 * Determine if error is retryable
 */
export function isErrorRetryable(type: ErrorType): boolean {
  const retryableErrors: ErrorType[] = [
    'network',
    'timeout',
    'server',
    'blockchain',
  ];
  return retryableErrors.includes(type);
}

/**
 * Get user-friendly error message based on error type
 */
export function getUserErrorMessage(type: ErrorType): string {
  const messages: Record<ErrorType, string> = {
    not_found:
      'The resource you were looking for could not be found. It may have been deleted or moved.',
    unauthorized:
      'You need to be logged in to perform this action. Please log in and try again.',
    forbidden:
      "You don't have permission to access this resource. Contact support if you believe this is an error.",
    validation:
      'Please check your input and try again. Some fields may be invalid.',
    network:
      'A network error occurred. Please check your connection and try again.',
    timeout:
      'The request took too long. Please try again, or contact support if the problem persists.',
    server:
      'Something went wrong on our end. Our team has been notified and is working on a fix.',
    blockchain:
      'A blockchain operation failed. Please check your wallet and try again.',
    wallet:
      'There was an issue with your wallet connection. Please reconnect and try again.',
    unknown: 'An unexpected error occurred. Please try again or contact support.',
  };

  return messages[type];
}

/**
 * Create a structured error
 */
export function createStructuredError(
  error: Error | unknown,
  options: Partial<StructuredError> = {}
): StructuredError {
  const statusCode = (error as any)?.response?.status || options.statusCode;
  const type = options.type || classifyErrorType(error, statusCode);
  const severity = options.severity || getErrorSeverity(type);
  const retryable = options.retryable ?? isErrorRetryable(type);

  const message =
    error instanceof Error ? error.message : String(error);

  return {
    type,
    severity,
    statusCode,
    message,
    userMessage: options.userMessage || getUserErrorMessage(type),
    details: options.details,
    retryable,
    retryAfter: options.retryAfter,
    originalError: error instanceof Error ? error : undefined,
    timestamp: Date.now(),
    requestId: options.requestId,
  };
}

/**
 * Report structured error to Sentry with full context
 */
export function reportStructuredError(
  structuredError: StructuredError,
  context: Record<string, unknown> = {}
): string | null {
  let eventId: string | null = null;

  Sentry.withScope((scope) => {
    // Set error type and severity as tags for filtering
    scope.setTag('error_type', structuredError.type);
    scope.setTag('error_severity', structuredError.severity);

    // Add all details as extras
    scope.setExtra('error_details', structuredError);
    scope.setExtra('context', context);

    if (structuredError.requestId) {
      scope.setTag('request_id', structuredError.requestId);
    }

    if (structuredError.statusCode) {
      scope.setTag('status_code', structuredError.statusCode.toString());
    }

    // Set appropriate severity level
    scope.setLevel(
      structuredError.severity === 'critical'
        ? 'fatal'
        : (structuredError.severity as Sentry.SeverityLevel)
    );

    // Capture the error
    if (structuredError.originalError) {
      eventId = Sentry.captureException(structuredError.originalError);
    } else {
      eventId = Sentry.captureMessage(
        structuredError.message,
        structuredError.severity === 'critical' ? 'fatal' : 'error'
      );
    }
  });

  return eventId;
}

/**
 * Wrap API error for better error handling
 */
export function wrapApiError(error: any): StructuredError {
  const statusCode = error?.response?.status;
  const responseData = error?.response?.data;

  return createStructuredError(error, {
    statusCode,
    details: {
      endpoint: error?.config?.url,
      method: error?.config?.method,
      responseData,
    },
  });
}

/**
 * Wrap blockchain/wallet errors
 */
export function wrapBlockchainError(
  error: any,
  context: string = 'blockchain_operation'
): StructuredError {
  const message = error instanceof Error ? error.message : String(error);
  const isWalletError = message.toLowerCase().includes('wallet');

  return createStructuredError(error, {
    type: isWalletError ? 'wallet' : 'blockchain',
    details: {
      context,
      originalMessage: message,
    },
  });
}

/**
 * Add breadcrumb for error tracking
 */
export function addErrorBreadcrumb(
  message: string,
  data: Record<string, unknown> = {},
  level: 'info' | 'warning' | 'error' = 'info'
): void {
  Sentry.addBreadcrumb({
    message,
    category: 'error-tracking',
    level,
    data,
  });
}
