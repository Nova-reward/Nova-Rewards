'use client';

import { useEffect, useRef } from 'react';
import { useNotifications, getTypeIcon, relativeTime } from '../context/NotificationContext';

export default function NotificationCenter() {
  const { notifications, unreadCount, dropdownOpen, openDropdown, closeDropdown } = useNotifications();
  const dropdownRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    if (!dropdownOpen) return;
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        closeDropdown();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [dropdownOpen, closeDropdown]);

  const handleBellClick = () => {
    if (dropdownOpen) closeDropdown();
    else openDropdown();
  };

  return (
    <div className="notification-center" ref={dropdownRef}>
      <button
        className="header-icon-btn"
        aria-label="Notifications"
        aria-expanded={dropdownOpen}
        data-tour="notification-centre"
        onClick={handleBellClick}
      >
        <span className="notification-icon">🔔</span>
        {unreadCount > 0 && (
          <span className="notification-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
        )}
      </button>

      {dropdownOpen && (
        <div className="notification-dropdown" role="dialog" aria-label="Notifications">
          <div className="notification-dropdown-header">
            <span>Notifications</span>
          </div>

          {notifications.length === 0 ? (
            <div className="notification-empty">
              <span>🔕</span>
              <p>No notifications yet</p>
            </div>
          ) : (
            <ul className="notification-list">
              {notifications.map((n, i) => (
                <li key={n.id ?? i} className="notification-item">
                  <span className="notification-type-icon">{getTypeIcon(n.type)}</span>
                  <div className="notification-body">
                    <p className="notification-message">{n.message}</p>
                    <time className="notification-time">{relativeTime(n.createdAt)}</time>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
