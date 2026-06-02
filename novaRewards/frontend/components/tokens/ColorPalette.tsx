interface Swatch {
  name: string;
  /** Light-mode value */
  value: string;
  /** Optional dark-mode override */
  darkValue?: string;
  /** CSS variable name */
  cssVar?: string;
}

interface PaletteGroup {
  label: string;
  description?: string;
  swatches: Swatch[];
}

const PALETTES: PaletteGroup[] = [
  {
    label: 'Primary',
    description: 'Brand violet — interactive elements, CTAs',
    swatches: [
      { name: '50',  value: '#f5f3ff', cssVar: '--color-primary-50' },
      { name: '100', value: '#ede9fe', cssVar: '--color-primary-100' },
      { name: '200', value: '#ddd6fe', cssVar: '--color-primary-200' },
      { name: '300', value: '#c4b5fd', cssVar: '--color-primary-300' },
      { name: '400', value: '#a78bfa', cssVar: '--color-primary-400' },
      { name: '500', value: '#8b5cf6', cssVar: '--color-primary-500' },
      { name: '600', value: '#7c3aed', cssVar: '--color-primary-600' },
      { name: '700', value: '#6d28d9', cssVar: '--color-primary-700' },
      { name: '800', value: '#5b21b6', cssVar: '--color-primary-800' },
      { name: '900', value: '#4c1d95', cssVar: '--color-primary-900' },
      { name: '950', value: '#2e1065', cssVar: '--color-primary-950' },
    ],
  },
  {
    label: 'Secondary',
    description: 'Accent indigo — supporting UI, secondary actions',
    swatches: [
      { name: '50',  value: '#eef2ff', cssVar: '--color-secondary-50' },
      { name: '100', value: '#e0e7ff', cssVar: '--color-secondary-100' },
      { name: '200', value: '#c7d2fe', cssVar: '--color-secondary-200' },
      { name: '300', value: '#a5b4fc', cssVar: '--color-secondary-300' },
      { name: '400', value: '#818cf8', cssVar: '--color-secondary-400' },
      { name: '500', value: '#6366f1', cssVar: '--color-secondary-500' },
      { name: '600', value: '#4f46e5', cssVar: '--color-secondary-600' },
      { name: '700', value: '#4338ca', cssVar: '--color-secondary-700' },
      { name: '800', value: '#3730a3', cssVar: '--color-secondary-800' },
      { name: '900', value: '#312e81', cssVar: '--color-secondary-900' },
      { name: '950', value: '#1e1b4b', cssVar: '--color-secondary-950' },
    ],
  },
  {
    label: 'Neutral',
    description: 'Grays — text, borders, surfaces, backgrounds',
    swatches: [
      { name: '50',  value: '#f8fafc', cssVar: '--color-neutral-50' },
      { name: '100', value: '#f1f5f9', cssVar: '--color-neutral-100' },
      { name: '200', value: '#e2e8f0', cssVar: '--color-neutral-200' },
      { name: '300', value: '#cbd5e1', cssVar: '--color-neutral-300' },
      { name: '400', value: '#94a3b8', cssVar: '--color-neutral-400' },
      { name: '500', value: '#64748b', cssVar: '--color-neutral-500' },
      { name: '600', value: '#475569', cssVar: '--color-neutral-600' },
      { name: '700', value: '#334155', cssVar: '--color-neutral-700' },
      { name: '800', value: '#1e293b', cssVar: '--color-neutral-800' },
      { name: '900', value: '#0f172a', cssVar: '--color-neutral-900' },
      { name: '950', value: '#020617', cssVar: '--color-neutral-950' },
    ],
  },
  {
    label: 'Success',
    description: 'Positive feedback, confirmations',
    swatches: [
      { name: '50',  value: '#f0fdf4', darkValue: '#052e16', cssVar: '--color-success-50' },
      { name: '100', value: '#dcfce7', darkValue: '#064e3b', cssVar: '--color-success-100' },
      { name: '500', value: '#22c55e', cssVar: '--color-success-500' },
      { name: '600', value: '#16a34a', cssVar: '--color-success-600' },
      { name: '700', value: '#15803d', cssVar: '--color-success-700' },
    ],
  },
  {
    label: 'Warning',
    description: 'Caution states, expiring items',
    swatches: [
      { name: '50',  value: '#fffbeb', darkValue: '#451a03', cssVar: '--color-warning-50' },
      { name: '100', value: '#fef3c7', darkValue: '#78350f', cssVar: '--color-warning-100' },
      { name: '500', value: '#f59e0b', cssVar: '--color-warning-500' },
      { name: '600', value: '#d97706', cssVar: '--color-warning-600' },
      { name: '700', value: '#b45309', cssVar: '--color-warning-700' },
    ],
  },
  {
    label: 'Error',
    description: 'Destructive actions, validation errors',
    swatches: [
      { name: '50',  value: '#fef2f2', darkValue: '#450a0a', cssVar: '--color-error-50' },
      { name: '100', value: '#fee2e2', darkValue: '#7f1d1d', cssVar: '--color-error-100' },
      { name: '500', value: '#ef4444', cssVar: '--color-error-500' },
      { name: '600', value: '#dc2626', cssVar: '--color-error-600' },
      { name: '700', value: '#b91c1c', cssVar: '--color-error-700' },
    ],
  },
  {
    label: 'Info',
    description: 'Informational states, links',
    swatches: [
      { name: '50',  value: '#eff6ff', darkValue: '#172554', cssVar: '--color-info-50' },
      { name: '100', value: '#dbeafe', darkValue: '#1e3a5f', cssVar: '--color-info-100' },
      { name: '500', value: '#3b82f6', cssVar: '--color-info-500' },
      { name: '600', value: '#2563eb', cssVar: '--color-info-600' },
      { name: '700', value: '#1d4ed8', cssVar: '--color-info-700' },
    ],
  },
];

function isDark(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 < 128;
}

/**
 * ColorPalette — renders the full Nova Rewards color token system.
 *
 * Shows all palettes (primary, secondary, neutral, success, warning, error, info)
 * with light and dark mode swatches, hex values, and CSS variable names.
 *
 * Used in Storybook under Design System / Color Palette.
 */
export default function ColorPalette() {
  return (
    <div className="space-y-10 p-6 font-sans">
      {PALETTES.map(({ label, description, swatches }) => (
        <section key={label}>
          <div className="mb-4">
            <h2 className="type-h6 text-neutral-900 dark:text-neutral-100">
              {label}
            </h2>
            {description && (
              <p className="type-caption text-neutral-500 mt-0.5">{description}</p>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            {swatches.map(({ name, value, darkValue, cssVar }) => (
              <div key={name} className="flex flex-col items-center gap-1.5" style={{ minWidth: 56 }}>
                {/* Light swatch */}
                <div
                  className="h-12 w-14 rounded-lg shadow-sm ring-1 ring-black/10 flex items-end justify-end p-0.5"
                  style={{ backgroundColor: value }}
                  title={`${cssVar ?? label + '-' + name}: ${value}`}
                  aria-label={`${label} ${name} light: ${value}`}
                >
                  {darkValue && (
                    /* Dark-mode half — shown as a bottom-right triangle overlay */
                    <div
                      className="w-4 h-4 rounded-sm opacity-90"
                      style={{ backgroundColor: darkValue }}
                      title={`Dark mode: ${darkValue}`}
                      aria-label={`${label} ${name} dark: ${darkValue}`}
                    />
                  )}
                </div>

                {/* Scale step */}
                <span
                  className="font-mono text-[10px] text-neutral-500"
                  style={{ color: isDark(value) ? undefined : undefined }}
                >
                  {name}
                </span>

                {/* Hex value */}
                <span className="font-mono text-[10px] text-neutral-400">{value}</span>

                {/* CSS var (truncated) */}
                {cssVar && (
                  <span className="font-mono text-[9px] text-neutral-300 text-center leading-tight" style={{ maxWidth: 56 }}>
                    {cssVar}
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>
      ))}

      {/* ── Semantic aliases ─────────────────────────────────────── */}
      <section>
        <div className="mb-4">
          <h2 className="type-h6 text-neutral-900 dark:text-neutral-100">Semantic Aliases</h2>
          <p className="type-caption text-neutral-500 mt-0.5">
            These CSS variables adapt automatically for light / dark mode.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 max-w-md type-body-sm">
          {[
            ['--color-bg',          'Page background'],
            ['--color-surface',     'Card / panel background'],
            ['--color-surface-2',   'Subtle inset background'],
            ['--color-border',      'Dividers, input borders'],
            ['--color-text',        'Primary text'],
            ['--color-text-muted',  'Secondary / hint text'],
            ['--color-accent',      'Brand accent (primary-600 / primary-400 dark)'],
            ['--color-success',     'Success feedback'],
            ['--color-warning',     'Warning feedback'],
            ['--color-error',       'Error / destructive'],
            ['--color-info',        'Informational'],
          ].map(([varName, desc]) => (
            <div key={varName} className="flex flex-col gap-0.5 rounded-lg border border-neutral-200 dark:border-neutral-700 p-3">
              <code className="font-mono text-[11px] text-primary-600 dark:text-primary-400">{varName}</code>
              <span className="type-caption text-neutral-500">{desc}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
