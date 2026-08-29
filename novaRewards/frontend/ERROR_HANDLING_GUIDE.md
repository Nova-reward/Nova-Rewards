# Error Handling UI Implementation Guide

This guide covers the comprehensive error handling system implemented in Nova-Rewards, including error boundaries, error pages, monitoring, and retry functionality.

## Overview

The error handling system consists of:
- **ErrorBoundary**: Catches React runtime errors
- **ErrorService**: Classifies and reports errors to Sentry
- **ErrorContext**: Manages application-level error state
- **ErrorDisplay**: User-friendly error UI with suggestions
- **Providers**: Wraps the app with all necessary providers

## Architecture

```
App Layout (root)
├── Providers (Client Component)
│   ├── ErrorProvider (Context)
│   ├── ErrorBoundary (Error Catching)
│   └── ErrorModal (Display errors from context)
└── Pages & Components
```

## Components

### 1. ErrorBoundary

**Location**: `components/ErrorBoundary.tsx`

Catches unhandled React errors and displays a user-friendly error page.

**Usage**:
```tsx
import ErrorBoundary from '@/components/ErrorBoundary';

export default function Page() {
  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        // Custom error handling
      }}
    >
      <YourComponent />
    </ErrorBoundary>
  );
}
```

**HOC Pattern**:
```tsx
import { withErrorBoundary } from '@/components/ErrorBoundary';

const MyComponent = () => <div>Content</div>;
export default withErrorBoundary(MyComponent);
```

### 2. ErrorService

**Location**: `lib/errorService.ts`

Provides utilities for error classification, severity determination, and Sentry reporting.

**Functions**:
- `classifyErrorType(error, statusCode)`: Classify error into types
- `createStructuredError(error, options)`: Create a structured error object
- `reportStructuredError(error, context)`: Report error to Sentry
- `wrapApiError(error)`: Wrap API errors
- `wrapBlockchainError(error, context)`: Wrap blockchain/wallet errors

**Usage**:
```tsx
import { createStructuredError, reportStructuredError } from '@/lib/errorService';

try {
  await someAsyncOperation();
} catch (error) {
  const structuredError = createStructuredError(error, {
    details: { operation: 'user_action' }
  });
  reportStructuredError(structuredError, { userId: currentUser.id });
}
```

### 3. ErrorContext

**Location**: `context/ErrorContext.tsx`

Manages application-level error state and provides hooks for error handling.

**Available Hooks**:

#### `useError()`
```tsx
import { useError } from '@/context/ErrorContext';

const MyComponent = () => {
  const { error, clearError, hasError, retry, isRetrying } = useError();

  if (hasError) {
    return <div>Error: {error?.userMessage}</div>;
  }

  return <div>Content</div>;
};
```

#### `useErrorHandler()`
```tsx
import { useErrorHandler } from '@/context/ErrorContext';

const MyComponent = () => {
  const { handleError, clearError } = useErrorHandler();

  const handleAction = async () => {
    try {
      await someAction();
    } catch (error) {
      const structuredError = createStructuredError(error);
      handleError(structuredError, async () => {
        // Retry function
        await someAction();
      });
    }
  };

  return <button onClick={handleAction}>Try Action</button>;
};
```

### 4. ErrorDisplay

**Location**: `components/ErrorDisplay.tsx`

Displays structured errors with user-friendly UI, error-specific suggestions, and action buttons.

**Props**:
```tsx
interface ErrorDisplayProps {
  error: StructuredError;
  errorInfo?: React.ErrorInfo | null;
  eventId?: string | null;
  onRetry?: () => void;
  onReload?: () => void;
  isDevelopment?: boolean;
}
```

### 5. ErrorModal

**Location**: `components/ErrorModal.tsx`

Modal component for displaying context-based errors alongside normal content.

**Usage**:
```tsx
import { ErrorModal } from '@/components/ErrorModal';

export default function Layout() {
  return (
    <div>
      <YourContent />
      <ErrorModal /> {/* Display errors from context */}
    </div>
  );
}
```

## Error Types

The system supports the following error types:

| Type | Status Code | Description |
|------|-------------|-------------|
| `not_found` | 404 | Resource not found |
| `unauthorized` | 401 | Authentication required |
| `forbidden` | 403 | Permission denied |
| `validation` | 400/422 | Invalid input |
| `network` | - | Connection error |
| `timeout` | - | Request timeout |
| `server` | 5xx | Server error |
| `blockchain` | - | Blockchain operation error |
| `wallet` | - | Wallet connection error |
| `unknown` | - | Unknown error |

## Error Severity

Errors are classified into severity levels:
- **info**: Informational error
- **warning**: Non-critical issue
- **error**: Critical issue
- **critical**: System-critical issue

## Common Patterns

### API Error Handling

```tsx
import axios from 'axios';
import { wrapApiError, reportStructuredError } from '@/lib/errorService';
import { useErrorHandler } from '@/context/ErrorContext';

const MyComponent = () => {
  const { handleError } = useErrorHandler();

  const fetchData = async () => {
    try {
      const response = await axios.get('/api/data');
      return response.data;
    } catch (error) {
      const structuredError = wrapApiError(error);
      reportStructuredError(structuredError, { endpoint: '/api/data' });
      handleError(structuredError);
      throw error;
    }
  };

  return <button onClick={fetchData}>Fetch Data</button>;
};
```

### Blockchain/Wallet Error Handling

```tsx
import { wrapBlockchainError, reportStructuredError } from '@/lib/errorService';
import { useErrorHandler } from '@/context/ErrorContext';

const WalletComponent = () => {
  const { handleError } = useErrorHandler();

  const connectWallet = async () => {
    try {
      await walletConnect();
    } catch (error) {
      const structuredError = wrapBlockchainError(error, 'wallet_connection');
      reportStructuredError(structuredError, { walletType: 'freighter' });
      handleError(structuredError);
    }
  };

  return <button onClick={connectWallet}>Connect Wallet</button>;
};
```

### Retry Pattern

```tsx
import { useErrorHandler } from '@/context/ErrorContext';
import { createStructuredError } from '@/lib/errorService';

const RetryableComponent = () => {
  const { handleError } = useErrorHandler();

  const performAction = async () => {
    const action = async () => {
      // Your action here
      await someAsyncOperation();
    };

    try {
      await action();
    } catch (error) {
      const structuredError = createStructuredError(error);
      handleError(structuredError, action); // Pass retry function
    }
  };

  return <button onClick={performAction}>Perform Action</button>;
};
```

## Development Features

### Development Error Details

In development mode, errors display additional details:
- Full error message
- Component stack trace
- Error ID for tracking
- Expandable details panel

### Console Logging

Development mode logs errors to the console with full context:
```
Error caught by boundary: Error message
Context: { componentStack: '...', ... }
```

## Sentry Integration

The error system integrates with Sentry for production monitoring:

- Structured errors are reported with tags for filtering
- Error types and severity are included as tags
- Request IDs are tracked for correlation
- User context is automatically included

**View in Sentry**:
1. Go to Sentry dashboard
2. Filter by error_type and error_severity tags
3. Click on an event to see full details including breadcrumbs

## Best Practices

1. **Always wrap API calls**: Use `wrapApiError()` for consistent error handling
2. **Use ErrorHandler hook**: Prefer `useErrorHandler()` over direct context manipulation
3. **Provide context**: Include relevant context when reporting errors
4. **Show user messages**: Always display `error.userMessage` to end users
5. **Implement retry logic**: For retryable errors, implement retry UI
6. **Log important operations**: Use `addErrorBreadcrumb()` for debugging
7. **Test error scenarios**: Test different error types during development

## Examples

See `components/examples/ErrorHandlingExamples.tsx` for practical examples of:
- Error boundary usage
- API error handling
- Blockchain error handling
- Retry patterns
- Context-based error display

## Troubleshooting

### Error Boundary Not Catching Errors

Error boundaries only catch errors during rendering. They don't catch:
- Event handlers (use try/catch)
- Async operations (use try/catch)
- Server-side rendering errors (use error.tsx pages)

**Solution**: Use try/catch blocks for these scenarios and manually set errors in context.

### Errors Not Appearing in Sentry

Check:
1. Sentry DSN is configured correctly
2. `NEXT_PUBLIC_SENTRY_DSN` environment variable is set
3. Error severity level allows reporting (check ignoreErrors config)
4. Network requests aren't blocked

### Error Modal Not Showing

Ensure:
1. `ErrorProvider` wraps your application
2. `ErrorModal` is rendered in your layout
3. `useError()` is used to set errors from within error context

## Configuration

### Environment Variables

```env
# Sentry Configuration
NEXT_PUBLIC_SENTRY_DSN=https://...@sentry.io/...
SENTRY_ORG=your-org
SENTRY_PROJECT=your-project
SENTRY_AUTH_TOKEN=...

# Environment
NEXT_PUBLIC_ENVIRONMENT=production
```

### Sentry Client Configuration

Edit `sentry.client.config.js`:
- `tracesSampleRate`: Adjust trace sampling rate
- `replaysSessionSampleRate`: Adjust session replay rate
- `ignoreErrors`: Add error patterns to ignore
- `beforeSend`: Filter events before sending to Sentry

## Next Steps

1. Integrate with your existing components
2. Configure Sentry DSN in environment variables
3. Test error scenarios in development
4. Monitor error metrics in Sentry dashboard
5. Adjust error handling based on usage patterns
