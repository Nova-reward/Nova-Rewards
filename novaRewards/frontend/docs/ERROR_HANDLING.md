# Error Handling Documentation

This document describes the error handling implementation in the NovaRewards frontend application.

## Overview

The application implements comprehensive error handling with:
- React Error Boundaries for catching runtime errors
- Custom error pages (404, 500)
- Wallet connection guard
- Sentry integration for error monitoring
- Source map support for debugging

## Components

### ErrorBoundary

The `ErrorBoundary` component catches JavaScript errors anywhere in the component tree and displays a fallback UI.

**Usage:**

```jsx
import ErrorBoundary from '../components/ErrorBoundary';

// Wrap your component
<ErrorBoundary>
  <YourComponent />
</ErrorBoundary>

// Or use the HOC
import { withErrorBoundary } from '../components/ErrorBoundary';

export default withErrorBoundary(YourComponent);
```

**Features:**
- Catches and logs errors to Sentry
- Displays user-friendly error UI
- Provides retry functionality
- Shows error details in development mode
- Allows users to report feedback via Sentry dialog

### WalletGuard

The `WalletGuard` component protects routes that require wallet connection.

**Usage:**

```jsx
import WalletGuard from '../components/WalletGuard';

// Wrap your protected component
<WalletGuard>
  <ProtectedComponent />
</WalletGuard>

// Or use the HOC
import { withWalletGuard } from '../components/WalletGuard';

export default withWalletGuard(YourComponent);
```

**Features:**
- Redirects to `/wallet-not-connected` if wallet is not connected
- Stores intended destination for redirect after connection
- Shows loading state while checking connection
- Automatically redirects after successful connection

## Custom Error Pages

### 404 - Page Not Found

Located at `pages/404.js`, this page is shown when a user navigates to a non-existent route.

**Features:**
- Friendly 404 message
- Navigation back to home or previous page
- Quick links to common pages
- Logs 404 events to Sentry for monitoring

### 500 - Server Error

Located at `pages/500.js`, this page is shown when a server-side error occurs.

**Features:**
- Clear error message
- Retry functionality
- Link to help center
- Reports errors to Sentry
- Shows error details in development mode

### Wallet Not Connected

Located at `pages/wallet-not-connected.js`, this page is shown when users try to access protected routes without a connected wallet.

**Features:**
- Wallet connection button
- Link to get Freighter wallet
- Automatic redirect after connection
- Error handling for connection failures

## Error Reporting

### Sentry Integration

The application uses Sentry for error monitoring and reporting.

**Configuration:**

1. Install dependencies:
```bash
npm install @sentry/nextjs
```

2. Set environment variables in `.env.local`:
```env
NEXT_PUBLIC_SENTRY_DSN=your-sentry-dsn
NEXT_PUBLIC_ENVIRONMENT=production
SENTRY_ORG=your-org
SENTRY_PROJECT=your-project
SENTRY_AUTH_TOKEN=your-auth-token
```

3. Sentry is automatically initialized via:
- `sentry.client.config.js` - Client-side errors
- `sentry.server.config.js` - Server-side errors
- `sentry.edge.config.js` - Edge runtime errors

### Error Reporting Utilities

Use the utilities in `lib/errorReporting.js` for consistent error reporting:

```jsx
import { 
  reportError, 
  reportMessage, 
  reportWalletError,
  reportApiError,
  reportTransactionError,
  setUserContext,
  addBreadcrumb 
} from '../lib/errorReporting';

// Report a general error
try {
  // some code
} catch (error) {
  reportError(error, { 
    component: 'MyComponent',
    action: 'fetchData' 
  });
}

// Report wallet errors
try {
  await connectWallet();
} catch (error) {
  reportWalletError(error, 'freighter');
}

// Report API errors
try {
  await api.get('/endpoint');
} catch (error) {
  reportApiError(error, '/endpoint', 'GET');
}

// Report transaction errors
try {
  await submitTransaction(tx);
} catch (error) {
  reportTransactionError(error, 'reward_claim', {
    amount: 100,
    recipient: publicKey
  });
}

// Set user context
setUserContext({
  id: user.id,
  email: user.email,
  publicKey: wallet.publicKey
});

// Add breadcrumbs for debugging
addBreadcrumb('User clicked claim button', {
  rewardId: reward.id,
  amount: reward.amount
});
```

## Best Practices

1. **Wrap Route Segments**: Use `ErrorBoundary` to wrap major route segments or feature areas
2. **Protect Routes**: Use `WalletGuard` for any page that requires wallet connection
3. **Report Context**: Always include relevant context when reporting errors
4. **User Feedback**: Provide clear, actionable error messages to users
5. **Development Mode**: Show detailed errors in development, hide in production
6. **Breadcrumbs**: Add breadcrumbs for important user actions to aid debugging
7. **User Context**: Set user context after authentication for better error tracking

## Testing

### Test Error Boundary

```jsx
// Create a component that throws an error
function BrokenComponent() {
  throw new Error('Test error');
}

// Wrap it in ErrorBoundary
<ErrorBoundary>
  <BrokenComponent />
</ErrorBoundary>
```

### Test 404 Page

Navigate to any non-existent route: `http://localhost:3000/non-existent-page`

### Test Wallet Guard

Try to access a protected route without connecting your wallet.

### Test Sentry Integration

1. Trigger an error in your application
2. Check Sentry dashboard for the error report
3. Verify source maps are working (you should see original source code, not minified)

## Source Maps

Source maps are automatically uploaded to Sentry during build via the `@sentry/nextjs` plugin configured in `next.config.js`.

**Configuration:**
```js
sentry: {
  hideSourceMaps: true,
  widenClientFileUpload: true,
}
```

This ensures:
- Source maps are uploaded to Sentry
- Source maps are not exposed to end users
- Better debugging with original source code in Sentry

## Monitoring

Monitor errors in your Sentry dashboard:
- Error frequency and trends
- Affected users
- Stack traces with source maps
- User feedback reports
- Performance metrics

## Troubleshooting

### Sentry not reporting errors

1. Check `NEXT_PUBLIC_SENTRY_DSN` is set correctly
2. Verify Sentry is initialized (check browser console)
3. Check network tab for Sentry requests
4. Ensure errors are not filtered by `beforeSend` hook

### Source maps not working

1. Verify `SENTRY_AUTH_TOKEN` is set
2. Check build logs for source map upload
3. Ensure `SENTRY_ORG` and `SENTRY_PROJECT` are correct
4. Check Sentry project settings for uploaded source maps

### WalletGuard not redirecting

1. Check `WalletContext` is properly initialized
2. Verify `publicKey` state is being set correctly
3. Check browser console for errors
4. Ensure `sessionStorage` is available
