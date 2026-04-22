/**
 * ThemeContext — thin wrapper around next-themes for backward compatibility.
 * Components that already import useTheme from this file continue to work.
 */
import { useTheme as useNextTheme } from 'next-themes';

export function useTheme() {
  const { theme, setTheme, resolvedTheme } = useNextTheme();

  return {
    theme: resolvedTheme ?? theme ?? 'light',
    toggleTheme: () => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark'),
  };
}

// Re-export ThemeProvider from next-themes so legacy imports still work.
export { ThemeProvider } from 'next-themes';
