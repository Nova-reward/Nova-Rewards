import type { Config } from 'tailwindcss';
import plugin from 'tailwindcss/plugin';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './pages/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
    './stories/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Primary (violet) — brand identity
        primary: {
          50:  '#f5f3ff',
          100: '#ede9fe',
          200: '#ddd6fe',
          300: '#c4b5fd',
          400: '#a78bfa',
          500: '#8b5cf6',
          600: '#7c3aed',
          700: '#6d28d9',
          800: '#5b21b6',
          900: '#4c1d95',
          950: '#2e1065',
        },
        // Secondary (indigo) — accent
        secondary: {
          50:  '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
          950: '#1e1b4b',
        },
        // Neutral / gray
        neutral: {
          50:  '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
          950: '#020617',
        },
        // Semantic — success
        success: {
          50:  '#f0fdf4',
          100: '#dcfce7',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
        },
        // Semantic — warning
        warning: {
          50:  '#fffbeb',
          100: '#fef3c7',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
        },
        // Semantic — error
        error: {
          50:  '#fef2f2',
          100: '#fee2e2',
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
        },
        // Semantic — info
        info: {
          50:  '#eff6ff',
          100: '#dbeafe',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
        },
        // Legacy brand tokens (backward compat)
        brand: {
          dark:   '#0f0f1a',
          card:   '#1a1a2e',
          border: '#2d2d4e',
          purple: '#7c3aed',
        },
      },

      fontFamily: {
        sans:  ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        serif: ['Merriweather', 'ui-serif', 'Georgia', 'serif'],
        mono:  ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },

      fontSize: {
        xs:   ['0.75rem',  { lineHeight: '1rem' }],
        sm:   ['0.875rem', { lineHeight: '1.25rem' }],
        base: ['1rem',     { lineHeight: '1.5rem' }],
        lg:   ['1.125rem', { lineHeight: '1.75rem' }],
        xl:   ['1.25rem',  { lineHeight: '1.75rem' }],
        '2xl':['1.5rem',   { lineHeight: '2rem' }],
        '3xl':['1.875rem', { lineHeight: '2.25rem' }],
        '4xl':['2.25rem',  { lineHeight: '2.5rem' }],
        '5xl':['3rem',     { lineHeight: '1' }],
      },

      fontWeight: {
        light:    '300',
        normal:   '400',
        medium:   '500',
        semibold: '600',
        bold:     '700',
      },

      lineHeight: {
        tight:   '1.25',
        snug:    '1.375',
        normal:  '1.5',
        relaxed: '1.625',
        loose:   '1.75',
      },

      letterSpacing: {
        tighter: '-0.02em',
        tight:   '-0.015em',
        snug:    '-0.01em',
        normal:  '0em',
        wide:    '0.01em',
        wider:   '0.05em',
        widest:  '0.08em',
      },

      // 4px base unit spacing scale
      spacing: {
        1:  '4px',
        2:  '8px',
        3:  '12px',
        4:  '16px',
        5:  '20px',
        6:  '24px',
        8:  '32px',
        10: '40px',
        12: '48px',
        16: '64px',
        20: '80px',
        24: '96px',
        32: '128px',
        40: '160px',
        48: '192px',
        64: '256px',
      },

      screens: {
        sm:  '640px',
        md:  '768px',
        lg:  '1024px',
        xl:  '1280px',
        '2xl': '1536px',
      },
    },
  },
  plugins: [
    /**
     * Type scale utilities
     * Adds semantic classes: .type-h1 through .type-h6,
     * .type-body-lg, .type-body, .type-body-sm, .type-caption, .type-label
     *
     * Each class sets font-size, line-height, letter-spacing, and font-weight
     * so a single class fully expresses the intended typographic role.
     */
    plugin(function ({ addUtilities }) {
      addUtilities({
        '.type-h1': {
          fontSize:      '2.25rem',   /* 36px */
          lineHeight:    '1.1',
          letterSpacing: '-0.02em',
          fontWeight:    '700',
        },
        '.type-h2': {
          fontSize:      '1.875rem',  /* 30px */
          lineHeight:    '1.2',
          letterSpacing: '-0.015em',
          fontWeight:    '700',
        },
        '.type-h3': {
          fontSize:      '1.5rem',    /* 24px */
          lineHeight:    '1.25',
          letterSpacing: '-0.01em',
          fontWeight:    '600',
        },
        '.type-h4': {
          fontSize:      '1.25rem',   /* 20px */
          lineHeight:    '1.3',
          letterSpacing: '-0.005em',
          fontWeight:    '600',
        },
        '.type-h5': {
          fontSize:      '1.125rem',  /* 18px */
          lineHeight:    '1.4',
          letterSpacing: '0em',
          fontWeight:    '600',
        },
        '.type-h6': {
          fontSize:      '1rem',      /* 16px */
          lineHeight:    '1.5',
          letterSpacing: '0em',
          fontWeight:    '600',
        },
        '.type-body-lg': {
          fontSize:      '1.125rem',  /* 18px */
          lineHeight:    '1.7',
          letterSpacing: '0em',
          fontWeight:    '400',
        },
        '.type-body': {
          fontSize:      '1rem',      /* 16px */
          lineHeight:    '1.6',
          letterSpacing: '0em',
          fontWeight:    '400',
        },
        '.type-body-sm': {
          fontSize:      '0.875rem',  /* 14px */
          lineHeight:    '1.5',
          letterSpacing: '0em',
          fontWeight:    '400',
        },
        '.type-caption': {
          fontSize:      '0.75rem',   /* 12px */
          lineHeight:    '1.4',
          letterSpacing: '0.01em',
          fontWeight:    '400',
        },
        '.type-label': {
          fontSize:      '0.875rem',  /* 14px */
          lineHeight:    '1.25',
          letterSpacing: '0.01em',
          fontWeight:    '500',
        },
      });
    }),
  ],
};

export default config;
