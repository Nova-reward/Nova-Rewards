import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

/**
 * ThemeToggle Component
 * Toggles between light and dark modes with system preference detection
 * 
 * Closes #847
 */
export default function ThemeToggle({ variant = 'icon' }) {
  const { resolvedTheme, setTheme, theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return variant === 'icon' ? <div className="header-icon-btn w-10 h-10" /> : <div className="btn btn-sm" />;
  }

  const isDark = resolvedTheme === 'dark';
  const isSystem = theme === 'system';

  const handleToggle = () => {
    setTheme(isDark ? 'light' : 'dark');
  };

  const handleSystemPreference = () => {
    setTheme('system');
  };

  if (variant === 'icon') {
    return (
      <button
        onClick={handleToggle}
        className="header-icon-btn"
        aria-label="Toggle theme"
        title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      >
        {isDark ? '☀️' : '🌙'}
      </button>
    );
  }

  // Full button variant for settings page
  return (
    <div className="theme-toggle-group">
      <button
        onClick={() => setTheme('light')}
        className={`btn btn-sm ${theme === 'light' ? 'btn-primary' : 'btn-secondary'}`}
        aria-label="Light mode"
      >
        ☀️ Light
      </button>
      <button
        onClick={() => setTheme('dark')}
        className={`btn btn-sm ${theme === 'dark' ? 'btn-primary' : 'btn-secondary'}`}
        aria-label="Dark mode"
      >
        🌙 Dark
      </button>
      <button
        onClick={handleSystemPreference}
        className={`btn btn-sm ${isSystem ? 'btn-primary' : 'btn-secondary'}`}
        aria-label="System preference"
      >
        💻 System
      </button>
      <style jsx>{`
        .theme-toggle-group {
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
        }
      `}</style>
    </div>
  );
}
