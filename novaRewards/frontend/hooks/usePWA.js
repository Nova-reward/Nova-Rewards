import { useState, useEffect } from 'react';
import {
  requestNotificationPermission,
  subscribeToPushNotifications,
  unsubscribeFromPushNotifications,
  syncInBackground,
  checkOnlineStatus,
  addOnlineListener,
  addOfflineListener,
} from '../lib/pwa';

export function usePWA() {
  const [isOnline, setIsOnline] = useState(true);
  const [notificationPermission, setNotificationPermission] = useState('default');
  const [pushSubscription, setPushSubscription] = useState(null);

  useEffect(() => {
    setIsOnline(checkOnlineStatus());

    const removeOnlineListener = addOnlineListener(() => setIsOnline(true));
    const removeOfflineListener = addOfflineListener(() => setIsOnline(false));

    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
    }

    return () => {
      removeOnlineListener();
      removeOfflineListener();
    };
  }, []);

  const enableNotifications = async () => {
    const granted = await requestNotificationPermission();
    if (granted) {
      setNotificationPermission('granted');
      const subscription = await subscribeToPushNotifications();
      setPushSubscription(subscription);
      return subscription;
    }
    return null;
  };

  const disableNotifications = async () => {
    const success = await unsubscribeFromPushNotifications();
    if (success) {
      setPushSubscription(null);
    }
    return success;
  };

  const triggerBackgroundSync = async (tag) => {
    return await syncInBackground(tag);
  };

  return {
    isOnline,
    notificationPermission,
    pushSubscription,
    enableNotifications,
    disableNotifications,
    triggerBackgroundSync,
  };
}
