import * as Sentry from '@sentry/nextjs';

/**
 * Report an error to Sentry with additional context
 * @param {Error} error - The error to report
 * @param {Object} context - Additional context to include with the error
 * @param {string} level - Error level: 'error', 'warning', 'info', 'debug'
 */
export function reportError(error, context = {}, level = 'error') {
  if (process.env.NODE_ENV === 'development') {
    console.error('Error:', error, 'Context:', context);
  }

  Sentry.withScope((scope) => {
    // Add context as extras
    if (context) {
      Object.keys(context).forEach((key) => {
        scope.setExtra(key, context[key]);
      });
    }

    // Set level
    scope.setLevel(level);

    // Capture the exception
    Sentry.captureException(error);
  });
}

/**
 * Report a message to Sentry
 * @param {string} message - The message to report
 * @param {Object} context - Additional context
 * @param {string} level - Message level
 */
export function reportMessage(message, context = {}, level = 'info') {
  if (process.env.NODE_ENV === 'development') {
    console.log('Message:', message, 'Context:', context);
  }

  Sentry.withScope((scope) => {
    if (context) {
      Object.keys(context).forEach((key) => {
        scope.setExtra(key, context[key]);
      });
    }

    scope.setLevel(level);
    Sentry.captureMessage(message, level);
  });
}

/**
 * Set user context for error reporting
 * @param {Object} user - User information
 */
export function setUserContext(user) {
  if (user) {
    Sentry.setUser({
      id: user.id,
      email: user.email,
      username: user.username,
      publicKey: user.publicKey,
    });
  } else {
    Sentry.setUser(null);
  }
}

/**
 * Add breadcrumb for debugging
 * @param {string} message - Breadcrumb message
 * @param {Object} data - Additional data
 * @param {string} category - Breadcrumb category
 * @param {string} level - Breadcrumb level
 */
export function addBreadcrumb(message, data = {}, category = 'custom', level = 'info') {
  Sentry.addBreadcrumb({
    message,
    category,
    level,
    data,
  });
}

/**
 * Wrap an async function with error reporting
 * @param {Function} fn - The async function to wrap
 * @param {Object} context - Additional context for error reporting
 */
export function withErrorReporting(fn, context = {}) {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (error) {
      reportError(error, {
        ...context,
        functionName: fn.name,
        arguments: args,
      });
      throw error;
    }
  };
}

/**
 * Report wallet connection errors
 */
export function reportWalletError(error, walletType = 'unknown') {
  reportError(error, {
    errorType: 'wallet_connection',
    walletType,
  }, 'warning');
}

/**
 * Report API errors
 */
export function reportApiError(error, endpoint, method = 'GET') {
  reportError(error, {
    errorType: 'api_error',
    endpoint,
    method,
    statusCode: error.response?.status,
    responseData: error.response?.data,
  });
}

/**
 * Report blockchain transaction errors
 */
export function reportTransactionError(error, transactionType, transactionData = {}) {
  reportError(error, {
    errorType: 'transaction_error',
    transactionType,
    ...transactionData,
  });
}
