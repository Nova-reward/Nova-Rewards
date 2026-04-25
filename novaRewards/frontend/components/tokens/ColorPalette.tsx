interface Swatch {
  name: string;
  value: string;
}

interface PaletteGroup {
  label: string;
  swatches: Swatch[];
}

const PALETTES: PaletteGroup[] = [
  {
    label: 'Primary',
    swatches: [
      { name: '50',  value: '#f5f3ff' },
      { name: '100', value: '#ede9fe' },
      { name: '200', value: '#ddd6fe' },
      { name: '300', value: '#c4b5fd' },
      { name: '400', value: '#a78bfa' },
      { name: '500', value: '#8b5cf6' },
      { name: '600', value: '#7c3aed' },
      { name: '700', value: '#6d28d9' },
      { name: '800', value: '#5b21b6' },
      { name: '900', value: '#4c1d95' },
      { name: '950', value: '#2e1065' },
    ],
  },
  {
    label: 'Secondary',
    swatches: [
      { name: '50',  value: '#eef2ff' },
      { name: '100', value: '#e0e7ff' },
      { name: '200', value: '#c7d2fe' },
      { name: '300', value: '#a5b4fc' },
      { name: '400', value: '#818cf8' },
      { name: '500', value: '#6366f1' },
      { name: '600', value: '#4f46e5' },
      { name: '700', value: '#4338ca' },
      { name: '800', value: '#3730a3' },
      { name: '900', value: '#312e81' },
      { name: '950', value: '#1e1b4b' },
    ],
  },
  {
    label: 'Neutral',
    swatches: [
      { name: '50',  value: '#f8fafc' },
      { name: '100', value: '#f1f5f9' },
      { name: '200', value: '#e2e8f0' },
      { name: '300', value: '#cbd5e1' },
      { name: '400', value: '#94a3b8' },
      { name: '500', value: '#64748b' },
      { name: '600', value: '#475569' },
      { name: '700', value: '#334155' },
      { name: '800', value: '#1e293b' },
      { name: '900', value: '#0f172a' },
      { name: '950', value: '#020617' },
    ],
  },
  {
    label: 'Semantic',
    swatches: [
      { name: 'success-500', value: '#22c55e' },
      { name: 'warning-500', value: '#f59e0b' },
      { name: 'error-500',   value: '#ef4444' },
      { name: 'info-500',    value: '#3b82f6' },
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
 * Renders the full Nova Rewards color palette as a visual grid.
 * Used in Storybook and the design system docs.
 */
export default function ColorPalette() {
  return (
    <div className="space-y-8 p-6 font-sans">
      {PALETTES.map(({ label, swatches }) => (
        <section key={label}>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-neutral-500">
            {label}
          </h2>
          <div className="flex flex-wrap gap-2">
            {swatches.map(({ name, value }) => (
              <div key={name} className="flex flex-col items-center gap-1">
                <div
                  className="h-12 w-12 rounded-lg shadow-sm ring-1 ring-black/10"
                  style={{ backgroundColor: value }}
                  title={value}
                  aria-label={`${label} ${name}: ${value}`}
                />
                <span className="text-[10px] font-mono text-neutral-500">{name}</span>
                <span className="text-[10px] font-mono text-neutral-400">{value}</span>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
