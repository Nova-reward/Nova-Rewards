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
 * 
 * Closes #847
 */
export default function GeneralSettings({ prefs, onChange }) {
  const { resolvedTheme, setTheme, theme } = useTheme();

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
            Current: {resolvedTheme === 'dark' ? 'Dark' : 'Light'} mode {theme === 'system' && '(System)'}
          </span>
        </div>
        <div className="theme-toggle-buttons">
          <button
            className={`btn btn-sm ${theme === 'light' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setTheme('light')}
            aria-label="Light mode"
            title="Light mode"
          >
            ☀️ Light
          </button>
          <button
            className={`btn btn-sm ${theme === 'dark' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setTheme('dark')}
            aria-label="Dark mode"
            title="Dark mode"
          >
            🌙 Dark
          </button>
          <button
            className={`btn btn-sm ${theme === 'system' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setTheme('system')}
            aria-label="System preference"
            title="Use system preference"
          >
            💻 System
          </button>
          <style jsx>{`
            .theme-toggle-buttons {
              display: flex;
              gap: 0.5rem;
              flex-wrap: wrap;
            }
          `}</style>
        </div>
      </div>
    </div>
  );
}
