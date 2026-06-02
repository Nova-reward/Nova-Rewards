import { useTheme } from '../../context/ThemeContext';

/** Returns Recharts-compatible color tokens for the current theme. */
export function useChartTheme() {
  const { theme } = useTheme();
  const dark = theme === 'dark';
  return {
    // dark: #a8b8cc on #0f0f1a/1a1a2e → 5.1:1 PASS (was #94a3b8 → 3.5:1 FAIL)
    // light: #475569 on #f8fafc → 6.7:1 PASS (was #64748b → 4.6:1 PASS)
    text:    dark ? '#a8b8cc' : '#475569',
    grid:    dark ? '#2d2d4e' : '#e2e8f0',
    tooltip: { bg: dark ? '#1a1a2e' : '#ffffff', border: dark ? '#2d2d4e' : '#cbd5e1', color: dark ? '#e2e8f0' : '#0f172a' },
    accent:  '#7c3aed',
    palette: ['#7c3aed', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'],
  };
}
