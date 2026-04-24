'use client';

import { useState } from 'react';
import { useTheme } from 'next-themes';

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Español' },
  { value: 'fr', label: 'Français' },
];

/**
 * General settings: language selection and theme toggle.
 */
export default function GeneralSettings({ prefs, onChange }) {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <div>
      <h3 className="settings-section-title">General</h3>

      <div className="settings-row">
        <div className="settings-row-info">
          <span className="settings-row-label">Language</span>
          <span className="settings-row-desc">Select your preferred display language</span>
        </div>
        <select
          className="input settings-select"
          value={prefs.language}
          onChange={(e) => onChange('language', e.target.value)}
          aria-label="Language selection"
        >
          {LANGUAGES.map((lang) => (
            <option key={lang.value} value={lang.value}>{lang.label}</option>
          ))}
        </select>
      </div>

      <div className="settings-row">
        <div className="settings-row-info">
          <span className="settings-row-label">Theme</span>
          <span className="settings-row-desc">
            Current: {resolvedTheme === 'dark' ? 'Dark' : 'Light'} mode
          </span>
        </div>
        <button
          className="btn btn-secondary"
          onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
          aria-label={`Switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {resolvedTheme === 'dark' ? '☀️ Light Mode' : '🌙 Dark Mode'}
        </button>
      </div>
    </div>
  );
}
