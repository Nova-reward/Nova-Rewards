# Error Boundaries and Custom Error Pages Implementation

## Overview

This implementation adds comprehensive error handling to the NovaRewards frontend application, including:

✅ React Error Boundaries for catching runtime errors  
✅ Custom 404, 500, and wallet-not-connected error pages  
✅ Wallet connection guard for protected routes  
✅ Sentry integration for error monitoring  
✅ Source map support for debugging  
✅ Error reporting utilities  
✅ Comprehensive test coverage  

## What Was Implemented

### 1. Sentry Integration

**Files Created:**
- `sentry.client.config.js` - Client-side error tracking
- `sentry.server.config.js` - Server-side error tracking
- `sentry.edge.config.js` - Edge runtime error tracking

**Configuration:**
- Automatic error capture and reporting
- Session replay for debugging
- Source map upload for readable stack traces
- Environment-specific sampling rates
- Error filtering and deduplication

### 2. Enhanced ErrorBoundary Component

**File:** `components/ErrorBoundary.js`

**Features:**
- Catches JavaScript errors in component tree
- Reports errors to Sentry with context
- Displays user-friendly fallback UI
- Retry functionality
- Sentry feedback dialog integration
- Development mode error details
- HOC wrapper for easy integration

### 3. Custom Error Pages

**404 Page** (`pages/404.js`):
- Friendly "Page Not Found" message
- Navigation options (home, back)
- Quick links to common pages
- Logs 404s to Sentry for monitoring

**500 Page** (`pages/500.js`):
- "Server Error" message
- Retry functionality
- Link to help center
- Error reporting to Sentry
- Development mode error details

**Error Handler** (`pages/_error.js`):
- Catches all unhandled errors
- Integrates with Sentry
- Fallback for Next.js error handling

### 4. Wallet Connection Guard

**Files:**
- `components/WalletGuard.js` - Guard component
- `pages/wallet-not-connected.js` - Error page

**Features:**
- Protects routes requiring wallet connection
- Redirects unauthenticated users
- Stores intended destination
- Auto-redirect after connection
- Loading states
- HOC wrapper for easy integration

### 5. Error Reporting Utilities

**File:** `lib/errorReporting.js`

**Functions:**
- `reportError()` - Report errors with context
- `reportMessage()` - Report messages/warnings
- `reportWalletError()` - Wallet-specific errors
- `reportApiError()` - API request errors
- `reportTransactionError()` - Blockchain transaction errors
- `setUserContext()` - Set user info for tracking
- `addBreadcrumb()` - Add debugging breadcrumbs
- `withErrorReporting()` - HOC for error wrapping

### 6. Test Coverage

**Files:**
- `__tests__/ErrorBoundary.test.js` - ErrorBoundary tests
- `__tests__/WalletGuard.test.js` - WalletGuard tests

**Coverage:**
- Error catching and display
- Sentry integration
- Retry functionality
- Wallet guard redirects
- Loading states
- User interactions

### 7. Documentation

**Files:**
- `docs/ERROR_HANDLING.md` - Comprehensive guide
- `ERROR_BOUNDARIES_IMPLEMENTATION.md` - This file

## Installation & Setup

### 1. Install Dependencies

```bash
cd novaRewards/frontend
npm install
```

This will install `@sentry/nextjs` which was added to `package.json`.

### 2. Configure Sentry

1. Create a Sentry account at https://sentry.io
2. Create a new project for your frontend
3. Copy your DSN and auth token

### 3. Set Environment Variables

Create or update `.env.local`:

```env
# Sentry Configuration
NEXT_PUBLIC_SENTRY_DSN=https://your-dsn@sentry.io/project-id
NEXT_PUBLIC_ENVIRONMENT=development
SENTRY_ORG=your-org
SENTRY_PROJECT=your-project
SENTRY_AUTH_TOKEN=your-auth-token
```

### 4. Build and Test

```bash
# Development
npm run dev

# Production build (uploads source maps to Sentry)
npm run build

# Run tests
npm test
```

## Usage Examples

### Protecting a Page with WalletGuard

```jsx
import WalletGuard from '../components/WalletGuard';

export default function ProtectedPage() {
  return (
    <WalletGuard>
      <YourProtectedContent />
    </WalletGuard>
  );
}

// Or use the HOC
import { withWalletGuard } from '../components/WalletGuard';

function ProtectedPage() {
  return <YourProtectedContent />;
}

export default withWalletGuard(ProtectedPage);
```

### Wrapping Components with ErrorBoundary

```jsx
import ErrorBoundary from '../components/ErrorBoundary';

export default function MyPage() {
  return (
    <ErrorBoundary>
      <YourComponent />
    </ErrorBoundary>
  );
}

// Or use the HOC
import { withErrorBoundary } from '../components/ErrorBoundary';

export default withErrorBoundary(YourComponent);
```

### Reporting Errors

```jsx
import { 
  reportError, 
  reportWalletError,
  reportApiError 
} from '../lib/errorReporting';

// General error
try {
  await someOperation();
} catch (error) {
  reportError(error, { 
    component: 'MyComponent',
    action: 'someOperation' 
  });
}

// Wallet error
try {
  await connectWallet();
} catch (error) {
  reportWalletError(error, 'freighter');
}

// API error
try {
  await api.post('/endpoint', data);
} catch (error) {
  reportApiError(error, '/endpoint', 'POST');
}
```

## Testing

### Run All Tests

```bash
npm test
```

### Test Specific Components

```bash
npm test ErrorBoundary
npm test WalletGuard
```

### Test Error Pages

1. **404 Page**: Navigate to http://localhost:3000/non-existent-page
2. **500 Page**: Trigger a server error
3. **Wallet Not Connected**: Try accessing `/dashboard` without wallet

### Test Sentry Integration

1. Trigger an error in your app
2. Check Sentry dashboard for the error
3. Verify source maps show original code

## Configuration

### Next.js Config

The `next.config.js` has been updated with:
- Sentry webpack plugin integration
- Source map hiding in production
- Automatic source map upload

### Sentry Config

Each Sentry config file (`sentry.*.config.js`) includes:
- DSN configuration
- Sample rates
- Environment settings
- Error filtering
- Session replay (client only)

## Acceptance Criteria Status

✅ **ErrorBoundary component wraps all route segments**
- ErrorBoundary wraps the entire app in `_app.js`
- Can be used to wrap individual pages/components
- HOC available for easy integration

✅ **Custom not-found.tsx and error.tsx pages implemented**
- `404.js` - Custom 404 page
- `500.js` - Custom 500 page
- `_error.js` - Global error handler
- All pages styled and user-friendly

✅ **Wallet-not-connected guard redirects unauthenticated users**
- `WalletGuard` component implemented
- Redirects to `/wallet-not-connected` page
- Stores intended destination
- Auto-redirects after connection
- Applied to dashboard page as example

✅ **Sentry error reporting integrated with source maps**
- Sentry fully configured
- Source maps uploaded during build
- Error context and breadcrumbs
- User tracking
- Session replay

✅ **Error pages include navigation back to home**
- All error pages have "Go Home" button
- Additional navigation options (back, retry)
- Quick links to common pages
- Help center links

## Next Steps

### 1. Apply WalletGuard to More Pages

Add `WalletGuard` to other protected pages:
- `/rewards`
- `/profile`
- `/settings`
- `/merchant-dashboard`
- Any other pages requiring wallet connection

### 2. Add Error Boundaries to Feature Areas

Wrap major feature areas with ErrorBoundary:
- Redemption flow
- Campaign management
- Transaction history
- Analytics dashboard

### 3. Configure Sentry Alerts

Set up alerts in Sentry for:
- High error rates
- New error types
- Performance issues
- User feedback

### 4. Monitor and Iterate

- Review Sentry dashboard regularly
- Analyze error patterns
- Improve error messages based on user feedback
- Add more specific error handling as needed

## Troubleshooting

### Sentry Not Reporting Errors

1. Check `NEXT_PUBLIC_SENTRY_DSN` is set
2. Verify Sentry is initialized (browser console)
3. Check network tab for Sentry requests
4. Review `beforeSend` filters

### Source Maps Not Working

1. Verify `SENTRY_AUTH_TOKEN` is set
2. Check build logs for upload errors
3. Ensure `SENTRY_ORG` and `SENTRY_PROJECT` are correct
4. Check Sentry project settings

### WalletGuard Not Redirecting

1. Check `WalletContext` is initialized
2. Verify `publicKey` state updates
3. Check browser console for errors
4. Ensure `sessionStorage` is available

## Resources

- [Sentry Next.js Documentation](https://docs.sentry.io/platforms/javascript/guides/nextjs/)
- [React Error Boundaries](https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary)
- [Next.js Error Handling](https://nextjs.org/docs/advanced-features/error-handling)
- [Error Handling Documentation](./docs/ERROR_HANDLING.md)

## Support

For issues or questions:
1. Check the documentation in `docs/ERROR_HANDLING.md`
2. Review Sentry dashboard for error details
3. Check browser console for client-side errors
4. Review server logs for server-side errors
