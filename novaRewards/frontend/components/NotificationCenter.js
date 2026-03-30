'use client';

import { useEffect, useRef } from 'react';
import { useNotifications, getTypeIcon, relativeTime } from '../context/NotificationContext';

export default function NotificationCenter() {
  const {
    notifications,
    archived,
    unreadCount,
    dropdownOpen,
    openDropdown,
    closeDropdown,
    dismiss,
    archive,
    clearAll,
  } = useNotifications();
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (!dropdownOpen) return;
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) closeDropdown();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [dropdownOpen, closeDropdown]);

  return (
    <div className="notification-center" ref={dropdownRef}>
      <button
        className="header-icon-btn"
        aria-label="Notifications"
        aria-expanded={dropdownOpen}
        data-tour="notification-centre"
        onClick={() => (dropdownOpen ? closeDropdown() : openDropdown())}
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
            {(notifications.length > 0 || archived.length > 0) && (
              <button className="notification-action-btn" onClick={clearAll}>
                Clear all
              </button>
            )}
          </div>

          {notifications.length === 0 && archived.length === 0 ? (
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
                  <div className="notification-item-actions">
                    <button
                      className="notification-item-btn"
                      title="Archive"
                      onClick={() => archive(n.id ?? i)}
                      aria-label="Archive notification"
                    >
                      📥
                    </button>
                    <button
                      className="notification-item-btn"
                      title="Dismiss"
                      onClick={() => dismiss(n.id ?? i)}
                      aria-label="Dismiss notification"
                    >
                      ✕
                    </button>
                  </div>
                </li>
              ))}

              {archived.length > 0 && (
                <>
                  <li className="notification-archived-label">Archived</li>
                  {archived.map((n, i) => (
                    <li key={`arch-${n.id ?? i}`} className="notification-item" style={{ opacity: 0.6 }}>
                      <span className="notification-type-icon">{getTypeIcon(n.type)}</span>
                      <div className="notification-body">
                        <p className="notification-message">{n.message}</p>
                        <time className="notification-time">{relativeTime(n.createdAt)}</time>
                      </div>
                      <div className="notification-item-actions">
                        <button
                          className="notification-item-btn"
                          title="Dismiss"
                          onClick={() => dismiss(n.id ?? i)}
                          aria-label="Dismiss archived notification"
                        >
                          ✕
                        </button>
                      </div>
                    </li>
                  ))}
                </>
              )}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
