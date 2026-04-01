import { useTheme } from '../../context/ThemeContext';

/** Returns Recharts-compatible color tokens for the current theme. */
export function useChartTheme() {
  const { theme } = useTheme();
  const dark = theme === 'dark';
  return {
    text:    dark ? '#94a3b8' : '#64748b',
    grid:    dark ? '#2d2d4e' : '#e2e8f0',
    tooltip: { bg: dark ? '#1a1a2e' : '#ffffff', border: dark ? '#2d2d4e' : '#cbd5e1', color: dark ? '#e2e8f0' : '#0f172a' },
    accent:  '#7c3aed',
    palette: ['#7c3aed', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'],
  };
}
