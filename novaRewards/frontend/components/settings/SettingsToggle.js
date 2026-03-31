'use client';

/**
 * Reusable toggle switch component for settings.
 */
export default function SettingsToggle({ id, checked, onChange, disabled = false }) {
  return (
    <label htmlFor={id} className="settings-toggle" aria-label="toggle">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="settings-toggle-input"
      />
      <span className="settings-toggle-track">
        <span className="settings-toggle-thumb" />
      </span>
    </label>
  );
}
