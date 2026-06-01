'use client';

import { useRef, useEffect, useState } from 'react';
import { Bell, X, Archive, Trash2 } from 'lucide-react';
import { useNotifications, getTypeIcon, relativeTime } from '../context/NotificationContext';

/**
 * NotificationBell — Header notification bell with unread count badge and dropdown.
 *
 * Features:
 * - Badge shows unread count (capped at 99+)
 * - Dropdown lists 10 most recent notifications
 * - Marks all as read when dropdown opens
 * - Keyboard navigable (Escape to close)
 * - Accessible with ARIA labels
 */
export default function NotificationBell() {
  const {
    notifications,
    unreadCount,
    dropdownOpen,
    openDropdown,
    closeDropdown,
    dismiss,
    archive,
  } = useNotifications();

  const dropdownRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  // Handle click outside to close dropdown
  useEffect(() => {
    if (!dropdownOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        closeDropdown();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeDropdown();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [dropdownOpen, closeDropdown]);

  // Hydration safety
  useEffect(() => {
    setIsVisible(true);
  }, []);

  if (!isVisible) return null;

  const recentNotifications = notifications.slice(0, 10);
  const displayCount = unreadCount > 99 ? '99+' : unreadCount;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => (dropdownOpen ? closeDropdown() : openDropdown())}
        className="relative p-2 text-slate-500 hover:bg-gray-100 dark:hover:bg-brand-border rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600"
        aria-label={`Notifications ${unreadCount > 0 ? `(${displayCount} unread)` : ''}`}
        aria-expanded={dropdownOpen}
        aria-haspopup="dialog"
      >
        <Bell className="w-5 h-5" />

        {/* Unread Badge */}
        {unreadCount > 0 && (
          <span
            className="absolute top-1 right-1 flex items-center justify-center min-w-5 h-5 px-1 bg-red-500 text-white text-xs font-bold rounded-full"
            aria-label={`${displayCount} unread notifications`}
          >
            {displayCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {dropdownOpen && (
        <div
          className="absolute right-0 mt-2 w-96 max-h-96 origin-top-right rounded-xl border bg-white shadow-2xl ring-1 ring-black ring-opacity-5 dark:bg-brand-card dark:border-brand-border overflow-hidden animate-in fade-in zoom-in duration-150 flex flex-col"
          role="dialog"
          aria-label="Notifications"
          aria-modal="true"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b dark:border-brand-border px-4 py-3 bg-gray-50 dark:bg-brand-border/50">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              Notifications
            </h2>
            <button
              onClick={closeDropdown}
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              aria-label="Close notifications"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Content */}
          <div className="overflow-y-auto flex-1">
            {recentNotifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                <Bell className="w-12 h-12 text-slate-200 dark:text-slate-700 mb-2" />
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  All caught up! No notifications right now.
                </p>
              </div>
            ) : (
              <ul className="divide-y dark:divide-brand-border">
                {recentNotifications.map((notification) => (
                  <li
                    key={notification.id}
                    className={`px-4 py-3 hover:bg-gray-50 dark:hover:bg-brand-border/50 transition-colors ${
                      !notification.is_read ? 'bg-blue-50 dark:bg-blue-900/10' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Icon */}
                      <span className="text-lg flex-shrink-0 mt-0.5">
                        {getTypeIcon(notification.type)}
                      </span>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 dark:text-white break-words">
                          {notification.message}
                        </p>
                        <time className="text-xs text-slate-500 dark:text-slate-400 mt-1 block">
                          {relativeTime(notification.created_at)}
                        </time>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => archive(notification.id)}
                          className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                          aria-label="Archive notification"
                          title="Archive"
                        >
                          <Archive className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => dismiss(notification.id)}
                          className="p-1 text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                          aria-label="Dismiss notification"
                          title="Dismiss"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Footer */}
          {recentNotifications.length > 0 && (
            <div className="border-t dark:border-brand-border px-4 py-2 bg-gray-50 dark:bg-brand-border/50">
              <button
                onClick={() => {
                  // Navigate to full notifications page if it exists
                  window.location.href = '/notifications';
                }}
                className="w-full text-center text-xs font-medium text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 py-1 transition-colors"
              >
                View all notifications →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
