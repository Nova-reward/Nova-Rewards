'use client';

import { useState } from 'react';
import { useTheme } from '../../context/ThemeContext';

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Español' },
  { value: 'fr', label: 'Français' },
];

/**
 * General settings: language selection and theme toggle.
 */
export default function GeneralSettings({ prefs, onChange }) {
  const { theme, toggleTheme } = useTheme();

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
            Current: {theme === 'light' ? 'Light' : 'Dark'} mode
          </span>
        </div>
        <button
          className="btn btn-secondary"
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
        >
          {theme === 'light' ? '🌙 Dark Mode' : '☀️ Light Mode'}
        </button>
      </div>
    </div>
  );
}
