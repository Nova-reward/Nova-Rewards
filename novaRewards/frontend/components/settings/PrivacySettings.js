'use client';

import SettingsToggle from './SettingsToggle';

const VISIBILITY_OPTIONS = [
  { value: 'public', label: 'Public' },
  { value: 'friends', label: 'Friends Only' },
  { value: 'private', label: 'Private' },
];

/**
 * Privacy settings: profile visibility and data sharing.
 */
export default function PrivacySettings({ prefs, onChange }) {
  return (
    <div>
      <h3 className="settings-section-title">Privacy</h3>

      <div className="settings-row">
        <div className="settings-row-info">
          <span className="settings-row-label">Profile Visibility</span>
          <span className="settings-row-desc">Control who can see your profile and activity</span>
        </div>
        <select
          className="input settings-select"
          value={prefs.privacy.profileVisibility}
          onChange={(e) => onChange('privacy', { ...prefs.privacy, profileVisibility: e.target.value })}
          aria-label="Profile visibility"
        >
          {VISIBILITY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      <div className="settings-row">
        <div className="settings-row-info">
          <span className="settings-row-label">Data Sharing</span>
          <span className="settings-row-desc">Allow anonymized data to improve platform experience</span>
        </div>
        <SettingsToggle
          id="privacy-data-sharing"
          checked={prefs.privacy.dataSharing}
          onChange={(val) => onChange('privacy', { ...prefs.privacy, dataSharing: val })}
        />
      </div>

      <div className="settings-row">
        <div className="settings-row-info">
          <span className="settings-row-label">Activity Tracking</span>
          <span className="settings-row-desc">Track in-app activity for personalized recommendations</span>
        </div>
        <SettingsToggle
          id="privacy-activity-tracking"
          checked={prefs.privacy.activityTracking}
          onChange={(val) => onChange('privacy', { ...prefs.privacy, activityTracking: val })}
        />
      </div>
    </div>
  );
}
