# JWT Token Expiry Warning Modal - Integration Guide

## Overview

This feature implements a proactive warning system for JWT token expiry, preventing silent 401 errors from disrupting the user experience. The modal appears 2 minutes before token expiry, allowing users to extend their session without losing work.

## Feature Acceptance Criteria

✅ Modal appears 2 minutes before the access token expires
✅ "Stay logged in" button silently refreshes the token and dismisses the modal
✅ "Log out" button clears the session and redirects to the login page
✅ If the user ignores the modal, they are automatically logged out at expiry
✅ Modal does not appear if the user is not actively using the app (no input events in 5 minutes)

## Architecture

### Components & Hooks

1. **useTokenExpiry Hook** (`novaRewards/frontend/hooks/useTokenExpiry.js`)
   - Decodes JWT and extracts expiry timestamp
   - Monitors token expiry countdown (updates every second)
   - Triggers callbacks 2 minutes before expiry and at expiry
   - Tracks user inactivity (5-minute threshold)
   - Attaches event listeners for user activity detection (throttled to 1s)

2. **TokenExpiryWarning Modal** (`novaRewards/frontend/components/modal/TokenExpiryWarning.js`)
   - Displays remaining time (mm:ss format)
   - Two action buttons: "Stay Logged In" and "Log Out"
   - Built on existing ConfirmDialog component

3. **TokenExpiryManager Component** (`novaRewards/frontend/components/auth/TokenExpiryManager.js`)
   - Orchestrates token warning modal display
   - Connects auth context to modal callbacks
   - Handles token refresh and logout actions

4. **Enhanced AuthContext** (`novaRewards/frontend/context/AuthContext.js`)
   - Integrates useTokenExpiry hook
   - Adds `refreshAccessToken()` method for silent refresh
   - Exposes token expiry state: `showTokenWarning`, `expiresIn`, `isInactive`
   - Auto-logout on token expiry

### Dependencies

- **jwt-decode** (v4.0.0+): Decodes JWT payload to extract expiry timestamp

## Setup Instructions

### Step 1: Install Dependencies

```bash
cd novaRewards/frontend
npm install jwt-decode@^4.0.0
```

### Step 2: Mount TokenExpiryManager in Your App Layout

Add the `TokenExpiryManager` component to your main app layout or `_app.js` file. It must be inside the `AuthProvider`.

**Example in `_app.js` or `layout.js`:**

```jsx
import { AuthProvider } from '../context/AuthContext';
import TokenExpiryManager from '../components/auth/TokenExpiryManager';

export default function App({ Component, pageProps }) {
  return (
    <AuthProvider>
      <TokenExpiryManager />
      <Component {...pageProps} />
    </AuthProvider>
  );
}
```

Or in a layout component:

```jsx
'use client';

import { AuthProvider } from '@/context/AuthContext';
import TokenExpiryManager from '@/components/auth/TokenExpiryManager';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <AuthProvider>
          <TokenExpiryManager />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
```

### Step 3: Verify Auth Context Updates

The `AuthContext` has been updated with:

```javascript
// State
const [showTokenWarning, setShowTokenWarning] = useState(false);
const [tokenRefreshLoading, setTokenRefreshLoading] = useState(false);

// From useTokenExpiry hook
const { expiresIn, isInactive } = useTokenExpiry(token, {...});

// New method
const refreshAccessToken = useCallback(async () => {...}, [router]);

// Context value exports these new properties
value={{
  // ... existing fields
  showTokenWarning,
  setShowTokenWarning,
  expiresIn,
  isInactive,
  refreshAccessToken,
  tokenRefreshLoading,
}}
```

## How It Works

### Timeline

1. **Token Login**
   - User logs in, receives access token with 15-minute expiry
   - Token decoded and expiry timestamp stored

2. **Active Session (0-13 minutes)**
   - Modal remains hidden
   - Inactivity timer resets on any user interaction

3. **Warning Threshold (13 minutes)**
   - If user is active (last interaction < 5 minutes ago), modal appears
   - User sees "Session expiring in 02:00"
   - Timer counts down

4. **User Response**
   - **Option A: Click "Stay Logged In"**
     - `refreshAccessToken()` called
     - New access token fetched via `/auth/refresh` endpoint
     - Token updated in localStorage and auth context
     - Modal dismisses
     - Countdown resets for another 15 minutes

   - **Option B: Click "Log Out"**
     - `logout()` called
     - Session cleared, localStorage cleaned
     - Modal dismisses
     - User redirected to `/login`

   - **Option C: Ignore the modal**
     - At 15-minute mark, token expiry callback fires
     - Automatic logout triggered
     - User redirected to `/login`
     - Next API request will receive 401 error

### Inactivity Logic

If user hasn't interacted with app for 5 minutes:
- `isInactive` flag set to true
- Modal won't show even if within warning threshold
- Once user interacts again, inactivity timer resets
- If within 2-minute warning window, modal will appear after activity resumes

**User Activity Events Monitored:**
- `mousedown`, `keydown`, `touchstart`, `scroll`, `click`
- Throttled to 1-second interval to reduce event listener overhead

## API Integration

### Token Refresh Endpoint

The feature relies on the existing `/auth/refresh` endpoint:

```
POST /api/auth/refresh
Content-Type: application/json

{
  "refreshToken": "eyJhbGc..."
}

Response:
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGc...",
    "refreshToken": "eyJhbGc...",
    "user": { ... }
  }
}
```

**Note:** Ensure the refresh endpoint returns the response in this structure. If your backend returns a different structure, update `AuthContext.refreshAccessToken()` accordingly.

## Testing

### Manual Testing Checklist

- [ ] Login and verify token is stored in localStorage
- [ ] Wait 13 minutes and verify modal appears
- [ ] Click "Stay Logged In" and verify token refreshes
- [ ] Try clicking "Log Out" and verify logout flow
- [ ] Simulate inactivity (don't interact for 5+ minutes) and verify modal doesn't appear
- [ ] Resume activity and verify modal appears if within 2-min threshold
- [ ] Let token expire without clicking anything and verify auto-logout

### Unit Tests (Example)

```javascript
// useTokenExpiry.test.js
import { renderHook, waitFor } from '@testing-library/react';
import { useTokenExpiry } from './useTokenExpiry';

describe('useTokenExpiry', () => {
  it('should trigger onWarning 2 minutes before expiry', async () => {
    const mockToken = 'eyJhbGc...'; // Token expiring in 15 minutes
    const onWarning = vi.fn();
    
    renderHook(() => useTokenExpiry(mockToken, { onWarning }));
    
    // Fast-forward to 13 minutes
    vi.advanceTimersByTime(13 * 60 * 1000);
    
    await waitFor(() => expect(onWarning).toHaveBeenCalled());
  });

  it('should trigger onExpiry at token expiry time', async () => {
    const mockToken = 'eyJhbGc...';
    const onExpiry = vi.fn();
    
    renderHook(() => useTokenExpiry(mockToken, { onExpiry }));
    
    // Fast-forward to 15 minutes
    vi.advanceTimersByTime(15 * 60 * 1000);
    
    await waitFor(() => expect(onExpiry).toHaveBeenCalled());
  });

  it('should not show warning if user is inactive', () => {
    const mockToken = 'eyJhbGc...';
    const onWarning = vi.fn();
    
    renderHook(() => useTokenExpiry(mockToken, {
      inactivityTimeout: 5,
      onWarning,
    }));
    
    // Wait 5+ minutes without activity
    vi.advanceTimersByTime(6 * 60 * 1000);
    
    // Fast-forward to warning threshold
    vi.advanceTimersByTime(13 * 60 * 1000);
    
    expect(onWarning).not.toHaveBeenCalled();
  });
});
```

## Configuration

### Customizable Options

The `useTokenExpiry` hook supports configuration via options object:

```javascript
const { expiresIn, isInactive } = useTokenExpiry(token, {
  warningThreshold: 2,      // Minutes before expiry to show warning
  inactivityTimeout: 5,     // Minutes of inactivity before disabling warning
  onWarning: () => {...},   // Callback when warning should show
  onExpiry: () => {...},    // Callback when token expires
});
```

To adjust these defaults, modify the calls in:
- `AuthContext.js` - lines 28-35

### Modal Appearance

The modal uses existing Tailwind CSS styles from `ConfirmDialog` and `Modal` components. Customize appearance by modifying:
- `novaRewards/frontend/components/modal/TokenExpiryWarning.js` - component JSX
- Tailwind CSS classes in base Modal/ConfirmDialog components

## Security Considerations

1. **Token Storage**: Tokens remain in localStorage. For improved security, consider:
   - Using httpOnly cookies for access tokens (requires backend changes)
   - Implementing refresh token rotation
   - Adding CSRF protection

2. **Refresh Endpoint Security**:
   - Ensure `/auth/refresh` validates refresh token before issuing new access token
   - Implement refresh token rotation to detect token compromise
   - Add rate limiting to prevent refresh bombing

3. **Modal Dismissal**:
   - Clicking the close button or backdrop calls `onLogout()` (clears session)
   - Users cannot dismiss without explicit action

## Troubleshooting

### Modal never appears

- **Check 1**: Verify `TokenExpiryManager` is mounted in app layout
- **Check 2**: Check browser console for errors decoding JWT
- **Check 3**: Verify token is valid by inspecting localStorage: `localStorage.getItem('authToken')`
- **Check 4**: Verify user has been active (check `isInactive` state)

### "Stay Logged In" fails

- **Check 1**: Ensure refresh token exists: `localStorage.getItem('refreshToken')`
- **Check 2**: Check API response from `/auth/refresh` endpoint
- **Check 3**: Verify API returns response in expected structure: `response.data.data.accessToken`
- **Check 4**: Check browser console for error logs

### Modal appears too early or too late

- **Adjust**: Modify `warningThreshold` in `AuthContext.js` useTokenExpiry call
  - Default: 2 minutes (120 seconds)
  - Change to: `{ warningThreshold: 3 }` for 3-minute warning

### Users complain about inactivity timeout

- **Adjust**: Modify `inactivityTimeout` in `AuthContext.js` useTokenExpiry call
  - Default: 5 minutes
  - Change to: `{ inactivityTimeout: 10 }` for 10-minute threshold

## Performance

- **Event Listener Throttling**: User activity events throttled to 1-second interval (default)
- **Timer Updates**: Countdown updates every 1 second (not using high-frequency intervals)
- **Memory**: Single interval + one timeout per app instance

## Browser Compatibility

- Requires `jwt-decode` library (v4+)
- Requires ES6+ (arrow functions, promises, async/await)
- Works in all modern browsers (Chrome, Firefox, Safari, Edge)

## Files Modified/Created

### Created
- `novaRewards/frontend/hooks/useTokenExpiry.js` - Token expiry tracking hook
- `novaRewards/frontend/components/modal/TokenExpiryWarning.js` - Warning modal component
- `novaRewards/frontend/components/auth/TokenExpiryManager.js` - Manager component

### Modified
- `novaRewards/frontend/context/AuthContext.js` - Integrated token expiry management
- `novaRewards/frontend/package.json` - Added jwt-decode dependency

## Future Enhancements

- [ ] Add sound/notification for warning modal
- [ ] Allow user to configure warning threshold in settings
- [ ] Add analytics tracking for token refresh events
- [ ] Implement multi-tab synchronization (warn only in active tab)
- [ ] Add ability to extend session manually before warning

## Support

For issues or questions:
1. Check this guide's Troubleshooting section
2. Review component JSDoc comments
3. Check browser console for error messages
4. Verify all files are in correct locations

