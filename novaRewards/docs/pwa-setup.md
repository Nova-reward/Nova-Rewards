# PWA Setup Guide

This guide explains how to configure and use the Progressive Web App features in Nova Rewards.

## Features

- **Offline Support**: App works without internet connection using cached data
- **Service Worker**: Caches assets and API responses for offline access
- **Push Notifications**: Receive updates about rewards and campaigns
- **Background Sync**: Automatically sync failed transactions when back online
- **Install Prompt**: Users can install the app on their device
- **App Manifest**: Native app-like experience on mobile devices

## Setup Instructions

### 1. Generate VAPID Keys

Push notifications require VAPID keys for authentication:

```bash
cd novaRewards/backend
npm install web-push --save
npx web-push generate-vapid-keys
```

Copy the generated keys to your `.env` file:

```env
VAPID_PUBLIC_KEY=your-generated-public-key
VAPID_PRIVATE_KEY=your-generated-private-key
VAPID_EMAIL=admin@novarewards.com
NEXT_PUBLIC_VAPID_PUBLIC_KEY=your-generated-public-key
```

### 2. Create App Icons

Place app icons in `novaRewards/frontend/public/icons/`:

- icon-72x72.png
- icon-96x96.png
- icon-128x128.png
- icon-144x144.png
- icon-152x152.png
- icon-192x192.png
- icon-384x384.png
- icon-512x512.png

You can use tools like [PWA Asset Generator](https://github.com/elegantapp/pwa-asset-generator) to generate these from a single source image.

### 3. Update Backend Server

Add the notifications route to your backend server:

```javascript
const notificationsRouter = require('./routes/notifications');
app.use('/api/notifications', notificationsRouter);
```

### 4. Test PWA Features

#### Test Service Worker
1. Build and run the app: `npm run build && npm start`
2. Open DevTools > Application > Service Workers
3. Verify the service worker is registered

#### Test Offline Mode
1. Open DevTools > Network
2. Select "Offline" from the throttling dropdown
3. Navigate the app - cached pages should load

#### Test Push Notifications
1. Go to Settings page
2. Click "Enable Notifications"
3. Grant permission when prompted
4. Send a test notification from backend

#### Test Install Prompt
1. Open the app in Chrome/Edge
2. Look for the install banner at the bottom
3. Click "Install" to add to home screen

## Usage

### In Components

```javascript
import { usePWA } from '../hooks/usePWA';

function MyComponent() {
  const { 
    isOnline, 
    notificationPermission,
    enableNotifications,
    triggerBackgroundSync 
  } = usePWA();

  // Check online status
  if (!isOnline) {
    return <p>You are offline</p>;
  }

  // Enable notifications
  const handleEnable = async () => {
    await enableNotifications();
  };

  // Trigger background sync
  const handleSync = async () => {
    await triggerBackgroundSync('sync-transactions');
  };
}
```

### Sending Push Notifications

From your backend:

```javascript
const axios = require('axios');

await axios.post('http://localhost:3001/api/notifications/send', {
  userId: 'user-id',
  title: 'New Reward Available!',
  body: 'You earned 50 NOVA tokens',
  url: '/rewards'
});
```

## Browser Support

- Chrome/Edge: Full support
- Firefox: Full support
- Safari: Partial support (no push notifications on iOS)
- Opera: Full support

## Production Considerations

1. **HTTPS Required**: PWA features require HTTPS in production
2. **Database Storage**: Replace in-memory subscription storage with database
3. **Icon Optimization**: Compress icons for faster loading
4. **Cache Strategy**: Adjust cache duration based on your needs
5. **Analytics**: Track PWA install rates and offline usage

## Troubleshooting

### Service Worker Not Registering
- Ensure you're running on localhost or HTTPS
- Check browser console for errors
- Clear browser cache and reload

### Push Notifications Not Working
- Verify VAPID keys are correctly set
- Check notification permissions in browser settings
- Ensure backend has web-push package installed

### Offline Page Not Showing
- Verify `/offline` route exists
- Check service worker cache configuration
- Test with DevTools offline mode
