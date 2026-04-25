'use client';

import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import useSWR from 'swr';
import { useAuth } from './AuthContext';
import { useToast } from '../components/Toast';
import api from '../lib/api';

const NotificationContext = createContext(null);

const MAX_NOTIFICATIONS = 50;

const TYPE_ICONS = {
  reward: '🎁',
  redemption: '✅',
  referral: '👥',
  campaign: '📢',
  system: 'ℹ️',
};

export function getTypeIcon(type) {
  return TYPE_ICONS[type] || '🔔';
}

export function relativeTime(isoString) {
  const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
  } catch {
    // AudioContext not available — silently ignore
  }
}

const fetcher = url => api.get(url).then(res => res.data);

export function NotificationProvider({ children }) {
  const { token, isAuthenticated } = useAuth();
  const { addToast } = useToast();

  const [archived, setArchived] = useState([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const { data: notificationsData, mutate } = useSWR(
    isAuthenticated && token ? '/api/notifications' : null,
    fetcher,
    { refreshInterval: 30000, revalidateOnFocus: true }
  );

  const allNotifications = notificationsData?.data || [];

  const [unreadCount, setUnreadCount] = useState(0);
  const prevCountRef = useRef(0);

  useEffect(() => {
    if (!dropdownOpen) {
      const serverUnread = allNotifications.filter(n => !n.is_read).length;
      if (serverUnread > prevCountRef.current) {
        playNotificationSound();
        const newest = allNotifications.filter(n => !n.is_read)[0];
        if (newest) {
          addToast(newest.message || 'New notification', newest.type || 'info');
        }
      }
      setUnreadCount(serverUnread);
      prevCountRef.current = serverUnread;
    }
  }, [allNotifications, addToast, dropdownOpen]);

  const addNotification = useCallback(() => mutate(), [mutate]);
  const setNotificationsList = useCallback(() => mutate(), [mutate]);

  const dismiss = useCallback(async (id) => {
    try {
      await api.patch(`/api/notifications/${id}/read`);
      mutate();
    } catch {
      // Non-critical
    }
  }, [mutate]);

  const archive = useCallback(async (id) => {
    try {
      await api.patch(`/api/notifications/${id}/read`);
      setArchived(prev => {
        const target = allNotifications.find(n => n.id === id);
        return target ? [target, ...prev] : prev;
      });
      mutate();
    } catch {
      // Non-critical
    }
  }, [allNotifications, mutate]);

  const clearAll = useCallback(async () => {
    try {
      await api.patch('/api/notifications/read-all');
      setArchived([]);
      mutate();
    } catch {
      // Non-critical
    }
  }, [mutate]);

  const openDropdown = useCallback(async () => {
    setDropdownOpen(true);
    setUnreadCount(0);
    prevCountRef.current = 0;
    try {
      await api.patch('/api/notifications/read-all');
      mutate();
    } catch {
      // Non-critical
    }
  }, [mutate]);

  const closeDropdown = useCallback(() => setDropdownOpen(false), []);

  return (
    <NotificationContext.Provider
      value={{
        notifications: allNotifications,
        archived,
        unreadCount,
        dropdownOpen,
        addNotification,
        setNotifications: setNotificationsList,
        dismiss,
        archive,
        clearAll,
        openDropdown,
        closeDropdown,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider');
  return ctx;
}
