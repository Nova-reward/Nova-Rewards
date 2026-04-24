# Quick Start: Error Handling Setup

This guide will help you get the error handling system up and running in 5 minutes.

## Step 1: Install Dependencies (1 min)

```bash
cd novaRewards/frontend
npm install
```

## Step 2: Set Up Sentry (2 min)

1. Go to https://sentry.io and create a free account
2. Create a new project:
   - Platform: Next.js
   - Name: nova-rewards-frontend
3. Copy your DSN from the project settings

## Step 3: Configure Environment (1 min)

Create `.env.local` in `novaRewards/frontend/`:

```env
# Copy from your Sentry project
NEXT_PUBLIC_SENTRY_DSN=https://your-key@o123456.ingest.sentry.io/123456

# Set your environment
NEXT_PUBLIC_ENVIRONMENT=development

# For production builds (get from Sentry settings)
SENTRY_ORG=your-org-slug
SENTRY_PROJECT=nova-rewards-frontend
SENTRY_AUTH_TOKEN=your-auth-token
```

**Note:** For development, only `NEXT_PUBLIC_SENTRY_DSN` is required. The other variables are needed for production builds to upload source maps.

## Step 4: Test It (1 min)

### Start the dev server:
```bash
npm run dev
```

### Test the error pages:

1. **404 Page**: http://localhost:3000/does-not-exist
2. **Wallet Guard**: http://localhost:3000/dashboard (without wallet)
3. **Error Boundary**: Create a test error in any component

### Test Sentry integration:

```jsx
// Add this to any page temporarily
<button onClick={() => { throw new Error('Test error'); }}>
  Test Error
</button>
```

Click the button and check your Sentry dashboard for the error.

## Step 5: Apply to Your Pages (Optional)

### Protect a page with WalletGuard:

```jsx
import WalletGuard from '../components/WalletGuard';

export default function MyPage() {
  return (
    <WalletGuard>
      <MyContent />
    </WalletGuard>
  );
}
```

### Wrap a component with ErrorBoundary:

```jsx
import ErrorBoundary from '../components/ErrorBoundary';

export default function MyPage() {
  return (
    <ErrorBoundary>
      <MyContent />
    </ErrorBoundary>
  );
}
```

### Report custom errors:

```jsx
import { reportError } from '../lib/errorReporting';

try {
  await riskyOperation();
} catch (error) {
  reportError(error, { context: 'additional info' });
}
```

## What's Already Set Up

✅ ErrorBoundary wraps the entire app in `_app.js`  
✅ Custom 404 and 500 pages  
✅ Wallet-not-connected page  
✅ WalletGuard applied to dashboard  
✅ Sentry configuration files  
✅ Error reporting utilities  
✅ Test coverage  

## Production Deployment

### Get Sentry Auth Token:

1. Go to Sentry → Settings → Account → API → Auth Tokens
2. Create a new token with `project:releases` and `org:read` scopes
3. Add to your CI/CD environment variables

### Build for production:

```bash
npm run build
```

This will automatically upload source maps to Sentry.

### Deploy:

Deploy as usual. Sentry will automatically capture errors in production.

## Troubleshooting

### "Sentry not reporting errors"
- Check `NEXT_PUBLIC_SENTRY_DSN` is set correctly
- Open browser console and look for Sentry initialization messages
- Check Network tab for requests to `sentry.io`

### "Source maps not working"
- Ensure `SENTRY_AUTH_TOKEN` is set for production builds
- Check build logs for "Sentry" messages
- Verify token has correct permissions

### "WalletGuard not working"
- Ensure `WalletContext` is properly set up
- Check browser console for errors
- Verify `sessionStorage` is available

## Next Steps

1. Review the full documentation: `docs/ERROR_HANDLING.md`
2. Apply WalletGuard to other protected pages
3. Add ErrorBoundaries to major feature areas
4. Set up Sentry alerts for your team
5. Monitor errors and iterate

## Need Help?

- Full documentation: `docs/ERROR_HANDLING.md`
- Implementation details: `ERROR_BOUNDARIES_IMPLEMENTATION.md`
- Sentry docs: https://docs.sentry.io/platforms/javascript/guides/nextjs/

That's it! Your error handling is now set up. 🎉
