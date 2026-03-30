'use client';

import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { useToast } from '../components/Toast';
import api from '../lib/api';

const NotificationContext = createContext(null);

const MAX_NOTIFICATIONS = 10;

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

/** Returns a relative time string like "2m ago", "1h ago", "3d ago" */
export function relativeTime(isoString) {
  const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

/** Plays a subtle notification sound via the Web Audio API (no asset needed). */
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
    // AudioContext not available (SSR / restricted env) — silently ignore
  }
}

export function NotificationProvider({ children }) {
  const { token, isAuthenticated } = useAuth();
  const { addToast } = useToast();

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const socketRef = useRef(null);
  // Keep a ref so the socket event handler always sees the latest value
  const dropdownOpenRef = useRef(dropdownOpen);
  useEffect(() => { dropdownOpenRef.current = dropdownOpen; }, [dropdownOpen]);

  // ── Socket lifecycle ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!isAuthenticated || !token) return;

    const socket = io(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001', {
      auth: { token },
      reconnection: true,
      reconnectionDelay: 2000,
    });
    socketRef.current = socket;

    socket.on('notification', (notification) => {
      // Prepend and cap at MAX_NOTIFICATIONS
      setNotifications((prev) => [notification, ...prev].slice(0, MAX_NOTIFICATIONS));

      if (!dropdownOpenRef.current) {
        setUnreadCount((c) => c + 1);
        playNotificationSound();
        addToast(notification.message, 'info');
      }
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [isAuthenticated, token]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Actions ───────────────────────────────────────────────────────────────
  const addNotification = useCallback((notification) => {
    setNotifications((prev) => [notification, ...prev].slice(0, MAX_NOTIFICATIONS));
    setUnreadCount((c) => c + 1);
  }, []);

  const setNotificationsList = useCallback((list) => {
    setNotifications(list.slice(0, MAX_NOTIFICATIONS));
  }, []);

  const openDropdown = useCallback(async () => {
    setDropdownOpen(true);
    setUnreadCount(0);
    try {
      await api.patch('/api/notifications/read-all');
    } catch {
      // Non-critical — badge is already cleared client-side
    }
  }, []);

  const closeDropdown = useCallback(() => setDropdownOpen(false), []);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        dropdownOpen,
        addNotification,
        setNotifications: setNotificationsList,
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
