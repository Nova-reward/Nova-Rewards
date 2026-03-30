'use client';

import SettingsToggle from './SettingsToggle';

const NOTIFICATION_OPTIONS = [
  { key: 'email', label: 'Email Notifications', desc: 'Receive updates and alerts via email' },
  { key: 'push', label: 'Push Notifications', desc: 'Browser push notifications for real-time alerts' },
  { key: 'sms', label: 'SMS Notifications', desc: 'Text message alerts for important events' },
];

/**
 * Notification preferences: email, push, SMS toggles.
 */
export default function NotificationSettings({ prefs, onChange }) {
  return (
    <div>
      <h3 className="settings-section-title">Notifications</h3>
      {NOTIFICATION_OPTIONS.map(({ key, label, desc }) => (
        <div key={key} className="settings-row">
          <div className="settings-row-info">
            <span className="settings-row-label">{label}</span>
            <span className="settings-row-desc">{desc}</span>
          </div>
          <SettingsToggle
            id={`notif-${key}`}
            checked={prefs.notifications[key]}
            onChange={(val) => onChange('notifications', { ...prefs.notifications, [key]: val })}
          />
        </div>
      ))}
    </div>
  );
}
