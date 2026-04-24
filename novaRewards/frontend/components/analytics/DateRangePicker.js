'use client';

const RANGES = [
  { value: '7d',  label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
];

/**
 * Date range selector — updates parent via `onChange`.
 * @param {{ value: string, onChange: (v: string) => void }} props
 */
export default function DateRangePicker({ value, onChange }) {
  return (
    <div className="analytics-range-picker" role="group" aria-label="Date range">
      {RANGES.map((r) => (
        <button
          key={r.value}
          className={`analytics-range-btn ${value === r.value ? 'active' : ''}`}
          onClick={() => onChange(r.value)}
          aria-pressed={value === r.value}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}
