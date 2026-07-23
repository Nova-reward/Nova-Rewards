'use client';

import React from 'react';

/**
 * ProgressBar — animated horizontal progress bar.
 *
 * @param {object} props
 * @param {number} props.value         - Current value (0–max)
 * @param {number} [props.max=100]     - Maximum value
 * @param {'sm'|'md'|'lg'} [props.size='md'] - Bar height
 * @param {'primary'|'success'|'warning'|'error'} [props.color='primary']
 * @param {string} [props.label]       - Visible label above bar
 * @param {boolean} [props.showValue]  - Show percentage text
 * @param {boolean} [props.animated]   - Animate on mount
 * @param {string} [props.className]
 */
export function ProgressBar({
  value = 0,
  max = 100,
  size = 'md',
  color = 'primary',
  label,
  showValue = false,
  animated = true,
  className = '',
}) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  const rounded = Math.round(pct);

  const heights = { sm: 'h-1.5', md: 'h-2.5', lg: 'h-4' };
  const colors = {
    primary: 'bg-primary-600',
    success: 'bg-success-500',
    warning: 'bg-warning-500',
    error:   'bg-error-500',
  };

  return (
    <div className={className}>
      {(label || showValue) && (
        <div className="flex justify-between items-center mb-1.5">
          {label && (
            <span className="text-sm font-medium text-neutral-700">{label}</span>
          )}
          {showValue && (
            <span className="text-sm font-medium text-neutral-500" aria-hidden="true">
              {rounded}%
            </span>
          )}
        </div>
      )}

      {/* Track */}
      <div
        role="progressbar"
        aria-valuenow={Math.round(value)}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={label ?? `Progress: ${rounded}%`}
        className={`w-full bg-neutral-200 rounded-full overflow-hidden ${heights[size]}`}
      >
        {/* Fill */}
        <div
          className={`h-full rounded-full ${colors[color]} ${animated ? 'nova-progress-fill' : ''}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/**
 * ProgressCircle — SVG circular progress indicator.
 *
 * @param {object} props
 * @param {number} props.value        - 0–100
 * @param {number} [props.size=64]    - Diameter in px
 * @param {number} [props.strokeWidth=6]
 * @param {'primary'|'success'|'warning'|'error'} [props.color='primary']
 * @param {boolean} [props.showLabel=true]
 * @param {string} [props.label]      - Center text override (default: percentage)
 */
export function ProgressCircle({
  value = 0,
  size = 64,
  strokeWidth = 6,
  color = 'primary',
  showLabel = true,
  label,
}) {
  const pct = Math.min(100, Math.max(0, value));
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (pct / 100) * circumference;

  const colors = {
    primary: '#7c3aed',
    success: '#22c55e',
    warning: '#f59e0b',
    error:   '#ef4444',
  };

  return (
    <figure
      role="img"
      aria-label={`Progress: ${Math.round(pct)}%`}
      style={{ width: size, height: size }}
      className="relative inline-flex items-center justify-center"
    >
      <svg width={size} height={size} className="-rotate-90">
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth={strokeWidth}
        />
        {/* Fill */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={colors[color]}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 240ms cubic-bezier(0.4,0,0.2,1)' }}
        />
      </svg>
      {showLabel && (
        <span
          aria-hidden="true"
          className="absolute text-xs font-semibold text-neutral-700"
          style={{ fontSize: size * 0.22 }}
        >
          {label ?? `${Math.round(pct)}%`}
        </span>
      )}
    </figure>
  );
}

/**
 * StepIndicator — multi-step progress (wizard / onboarding).
 *
 * @param {object} props
 * @param {number} props.current   - Current step (1-based)
 * @param {number} props.total     - Total steps
 * @param {string[]} [props.labels] - Optional step labels
 * @param {'dots'|'numbers'|'bar'} [props.variant='dots']
 */
export function StepIndicator({ current, total, labels = [], variant = 'dots' }) {
  if (variant === 'bar') {
    return (
      <ProgressBar
        value={current}
        max={total}
        size="sm"
        color="primary"
        label={`Step ${current} of ${total}`}
        showValue={false}
        animated
      />
    );
  }

  return (
    <nav aria-label="Progress steps" className="flex items-center gap-2">
      {Array.from({ length: total }, (_, i) => {
        const step = i + 1;
        const done = step < current;
        const active = step === current;
        const label = labels[i] ?? `Step ${step}`;

        return (
          <React.Fragment key={step}>
            {/* Step dot/number */}
            <div
              role="listitem"
              aria-current={active ? 'step' : undefined}
              aria-label={`${label}${done ? ' (completed)' : active ? ' (current)' : ''}`}
              className={[
                'flex items-center justify-center rounded-full transition-all duration-200',
                variant === 'numbers' ? 'w-7 h-7 text-xs font-semibold' : 'w-2.5 h-2.5',
                done   ? 'bg-primary-600 text-white' :
                active ? 'bg-primary-600 text-white ring-4 ring-primary-100' :
                         'bg-neutral-200 text-neutral-400',
              ].join(' ')}
            >
              {variant === 'numbers' && (done ? '✓' : step)}
            </div>

            {/* Connector line (between steps) */}
            {step < total && (
              <div
                aria-hidden="true"
                className={`flex-1 h-0.5 rounded-full transition-colors duration-300 ${step < current ? 'bg-primary-600' : 'bg-neutral-200'}`}
              />
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}

export default ProgressBar;
