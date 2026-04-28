/**
 * Thin shim so existing consumers of useTheme() / ThemeProvider from this
 * module continue to work after migrating to next-themes.
 */
export { useTheme } from 'next-themes';

// No-op provider — next-themes ThemeProvider is wired in _app.js.
export function ThemeProvider({ children }) {
  return children;
}
