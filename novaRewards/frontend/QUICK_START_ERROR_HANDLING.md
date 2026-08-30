# Quick Start: Error Handling UI

## 🎯 What's Implemented

A complete, production-ready error handling system with:
- ✅ User-friendly error pages
- ✅ Automatic error classification (10 types)
- ✅ Retry functionality
- ✅ Sentry monitoring integration
- ✅ Error boundary for React errors
- ✅ Error context for application-level errors
- ✅ Dark mode support
- ✅ Development debugging features

## 📁 Files Created

```
frontend/
├── lib/errorService.ts                           # Error classification & Sentry integration
├── context/ErrorContext.tsx                      # Error state management
├── components/
│   ├── ErrorBoundary.tsx                        # React error boundary
│   ├── ErrorDisplay.tsx                         # Error UI display
│   ├── ErrorModal.tsx                           # Modal error display
│   ├── ErrorTypeDisplay.tsx                     # Error type titles
│   ├── Providers.tsx                            # Root providers wrapper
│   ├── icons/ErrorIcon.tsx                      # Error type icons
│   └── examples/
│       └── ErrorHandlingExamples.tsx            # Practical examples
├── hooks/useAsyncError.ts                       # Async error handling hooks
├── app/error-demo/page.tsx                      # Interactive demo page
├── __tests__/errorHandling.test.ts              # Test suite
├── ERROR_HANDLING_GUIDE.md                      # Complete documentation
├── ERROR_HANDLING_IMPLEMENTATION.md             # Implementation details
└── QUICK_START_ERROR_HANDLING.md                # This file
```

## 🚀 3-Minute Setup

### 1. The app is already wrapped! ✨
Your `app/layout.tsx` is already updated with the `Providers` component that includes error handling.

### 2. Use in Your Components

**For general errors:**
```tsx
import { useErrorHandler } from '@/context/ErrorContext';
import { createStructuredError } from '@/lib/errorService';

export function MyComponent() {
  const { handleError } = useErrorHandler();

  const handleClick = async () => {
    try {
      await doSomething();
    } catch (error) {
      const structured = createStructuredError(error);
      handleError(structured, handleClick); // handleClick = retry function
    }
  };

  return <button onClick={handleClick}>Click Me</button>;
}
```

**For API errors:**
```tsx
import { useAsyncError } from '@/hooks/useAsyncError';

export function ApiComponent() {
  const { executeApi } = useAsyncError();

  const fetchData = () => {
    return executeApi(
      () => axios.get('/api/data'),
      { endpoint: '/api/data' }
    );
  };

  return <button onClick={fetchData}>Fetch</button>;
}
```

**For blockchain errors:**
```tsx
import { useAsyncError } from '@/hooks/useAsyncError';

export function WalletComponent() {
  const { executeBlockchain } = useAsyncError();

  const connect = () => {
    return executeBlockchain(
      () => walletConnect(),
      { context: 'wallet_connection' }
    );
  };

  return <button onClick={connect}>Connect</button>;
}
```

## 🧪 Test It Out

Visit the interactive demo page:
```
http://localhost:3000/error-demo
```

This page demonstrates:
- All 8 error type examples
- Error boundary usage
- Component overview
- Feature highlights
- Common patterns

## 📊 Error Types Supported

| Type | Example | Retryable |
|------|---------|-----------|
| `not_found` | 404 errors | ❌ |
| `unauthorized` | Login required | ❌ |
| `forbidden` | Permission denied | ❌ |
| `validation` | Invalid input | ❌ |
| `network` | Connection failed | ✅ |
| `timeout` | Request timeout | ✅ |
| `server` | 500 error | ✅ |
| `blockchain` | Contract error | ✅ |
| `wallet` | Wallet error | ✅ |
| `unknown` | Generic error | ✅ |

## ⚙️ Configuration

### Set Sentry DSN (optional but recommended)
```env
# .env.local
NEXT_PUBLIC_SENTRY_DSN=https://...@sentry.io/...
SENTRY_ORG=your-org
SENTRY_PROJECT=your-project
SENTRY_AUTH_TOKEN=...
```

Without Sentry DSN, errors will still display properly but won't be monitored.

## 📚 Common Patterns

### Pattern 1: Wrap API Calls
```tsx
import { wrapApiError } from '@/lib/errorService';

try {
  const data = await axios.get('/api/users');
} catch (error) {
  const structured = wrapApiError(error);
  // Handle structured error
}
```

### Pattern 2: Retry with Delay
```tsx
import { useRetry } from '@/hooks/useAsyncError';

const { retryWithDelay } = useRetry();

// In error handler:
await retryWithDelay(5000); // Retry after 5 seconds
```

### Pattern 3: Error Boundary HOC
```tsx
import { withErrorBoundary } from '@/components/ErrorBoundary';

const MyComponent = () => <div>Content</div>;
export default withErrorBoundary(MyComponent);
```

### Pattern 4: Error Modal Display
```tsx
import { ErrorModal } from '@/components/ErrorModal';

export default function Layout({ children }) {
  return (
    <div>
      {children}
      <ErrorModal /> {/* Displays errors from context */}
    </div>
  );
}
```

## 🔍 Development Features

In development mode (NODE_ENV=development):

✅ Full error stack traces
✅ Component stack in error boundary
✅ Console logging
✅ Expandable error details
✅ Error ID for tracking

## 🧩 Hook Reference

### `useError()`
```tsx
const {
  error,              // Current error
  clearError,         // Clear error
  hasError,          // Boolean check
  retry,             // Retry function
  isRetrying,        // Retry in progress
  setRetryCallback   // Set retry function
} = useError();
```

### `useErrorHandler()`
```tsx
const {
  handleError,        // Set error + context
  clearError,         // Clear error
  setRetryCallback    // Set retry function
} = useErrorHandler();
```

### `useAsyncError()`
```tsx
const {
  executeAsync,       // Generic async execution
  executeApi,         // API-specific execution
  executeBlockchain   // Blockchain-specific execution
} = useAsyncError();
```

### `useRetry()`
```tsx
const {
  retry,             // Simple retry
  retryWithDelay,    // Retry with delay
  isRetrying         // Retry in progress
} = useRetry();
```

## 📖 Documentation

For detailed information:
- **ERROR_HANDLING_GUIDE.md** - Complete guide with all details
- **ERROR_HANDLING_IMPLEMENTATION.md** - Implementation details
- **app/error-demo/page.tsx** - Interactive demo
- **components/examples/ErrorHandlingExamples.tsx** - Code examples
- **__tests__/errorHandling.test.ts** - Test examples

## ✅ Verification Checklist

- [x] Error service created and working
- [x] Error context created and working
- [x] Error boundary component created
- [x] Error display UI created
- [x] App layout wrapped with providers
- [x] Demo page accessible at /error-demo
- [x] Examples component created
- [x] Custom hooks created
- [x] Test suite created
- [x] Documentation complete

## 🐛 Troubleshooting

**Errors not showing?**
→ Make sure ErrorProvider and ErrorBoundary wrap your app (already done in layout.tsx)

**Errors not in Sentry?**
→ Set NEXT_PUBLIC_SENTRY_DSN in environment variables

**Error boundary not catching errors?**
→ Error boundaries only catch rendering errors. Use try/catch for event handlers.

**Can't find demo page?**
→ Visit http://localhost:3000/error-demo

## 🎓 Next Steps

1. **Visit the demo page** at `/error-demo` to see all error types
2. **Review ERROR_HANDLING_GUIDE.md** for complete documentation
3. **Use examples** from `components/examples/ErrorHandlingExamples.tsx`
4. **Integrate with your components** using the patterns above
5. **Configure Sentry** for production monitoring
6. **Run tests** to verify everything works

## 💡 Pro Tips

- Use `useAsyncError()` hook for cleaner code
- Always provide context when reporting errors
- Enable Sentry for production error monitoring
- Test different error scenarios during development
- Use the demo page to understand all error types
- Check Sentry dashboard to monitor errors in production

## 🚀 You're Ready!

The error handling system is fully integrated and ready to use. Start using the hooks in your components and watch errors be handled gracefully!

Questions? Check the documentation files or visit the demo page for examples.
