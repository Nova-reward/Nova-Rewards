/**
 * Skeleton primitives with shimmer animation.
 *
 * Exports:
 *   SkeletonBlock  — generic shimmer block (any size)
 *   SkeletonCard   — card with image + text lines (rewards / campaigns)
 *   SkeletonRow    — single table/list row (transactions)
 *   SkeletonNotification — notification list item
 *   SkeletonDashboard    — two-column dashboard layout (replaces LoadingSkeleton)
 *
 * All components are aria-hidden and use CSS vars from globals.css.
 */

const shimmerStyle = {
  background: 'linear-gradient(90deg, var(--surface-2) 25%, var(--border) 50%, var(--surface-2) 75%)',
  backgroundSize: '200% 100%',
  animation: `nova-shimmer var(--animation-loading-skeleton-duration, 1.5s) var(--animation-loading-skeleton-timing-function, linear) infinite`,
  borderRadius: '6px',
};

/** Inject the keyframe once into the document head. */
if (typeof document !== 'undefined' && !document.getElementById('nova-shimmer-kf')) {
  const style = document.createElement('style');
  style.id = 'nova-shimmer-kf';
  style.textContent = `
    @keyframes nova-shimmer {
      0%   { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
  `;
  document.head.appendChild(style);
}

/** Generic shimmer block. */
export function SkeletonBlock({ width = '100%', height = '1rem', style = {} }) {
  return (
    <div
      aria-hidden="true"
      style={{ width, height, ...shimmerStyle, ...style }}
    />
  );
}

/**
 * Card skeleton — matches reward/campaign card layout:
 * image placeholder → title line → description lines → button.
 */
export function SkeletonCard({ showImage = true }) {
  return (
    <div
      aria-hidden="true"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        padding: '1.25rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
      }}
    >
      {showImage && <SkeletonBlock height="160px" style={{ borderRadius: '8px' }} />}
      <SkeletonBlock width="65%" height="1.1rem" />
      <SkeletonBlock height="0.85rem" />
      <SkeletonBlock width="80%" height="0.85rem" />
      <SkeletonBlock height="2.25rem" style={{ marginTop: '0.25rem', borderRadius: '8px' }} />
    </div>
  );
}

/**
 * Row skeleton — matches transaction/history list row layout:
 * icon · title + subtitle · amount · date.
 */
export function SkeletonRow() {
  return (
    <div
      aria-hidden="true"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        padding: '0.75rem 0',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <SkeletonBlock width="2rem" height="2rem" style={{ borderRadius: '50%', flexShrink: 0 }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        <SkeletonBlock width="45%" height="0.875rem" />
        <SkeletonBlock width="30%" height="0.75rem" />
      </div>
      <SkeletonBlock width="4rem" height="0.875rem" style={{ flexShrink: 0 }} />
      <SkeletonBlock width="3.5rem" height="0.75rem" style={{ flexShrink: 0 }} />
    </div>
  );
}

/**
 * Notification skeleton — matches notification list item layout.
 */
export function SkeletonNotification() {
  return (
    <div
      aria-hidden="true"
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.75rem',
        padding: '0.75rem 1rem',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <SkeletonBlock width="1.5rem" height="1.5rem" style={{ borderRadius: '50%', flexShrink: 0 }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        <SkeletonBlock height="0.875rem" />
        <SkeletonBlock width="40%" height="0.75rem" />
      </div>
    </div>
  );
}

/**
 * Dashboard skeleton — 3-column grid matching the dashboard summary grid
 * (1 col mobile → 2 col md → 3 col lg).
 */
export function SkeletonDashboard() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading dashboard"
      style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '1rem' }}
      className="grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
    >
      {/* Balance card */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', textAlign: 'center' }}>
        <SkeletonBlock width="60%" height="0.875rem" style={{ margin: '0 auto' }} />
        <SkeletonBlock height="3rem" style={{ borderRadius: '8px' }} />
        <SkeletonBlock width="35%" height="0.75rem" style={{ margin: '0 auto' }} />
        <SkeletonBlock height="0.5rem" style={{ borderRadius: '4px' }} />
      </div>

      {/* Active campaigns card */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <SkeletonBlock width="50%" height="0.875rem" />
        {[...Array(3)].map((_, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border)' }}>
            <SkeletonBlock width="70%" height="0.875rem" />
            <SkeletonBlock width="90%" height="0.75rem" />
          </div>
        ))}
      </div>

      {/* Recent transactions card */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1rem' }}>
        <SkeletonBlock width="55%" height="0.875rem" style={{ marginBottom: '0.75rem' }} />
        {[...Array(4)].map((_, i) => <SkeletonRow key={i} />)}
      </div>
    </div>
  );
}

/**
 * KPI cards skeleton — 4-card grid matching the merchant KpiCards layout.
 */
export function SkeletonKpiCards() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading KPIs"
      style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}
    >
      {[...Array(4)].map((_, i) => (
        <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1.25rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
          <SkeletonBlock width="2rem" height="2rem" style={{ borderRadius: '50%' }} />
          <SkeletonBlock width="60%" height="0.75rem" />
          <SkeletonBlock width="70%" height="1.8rem" style={{ borderRadius: '6px' }} />
        </div>
      ))}
    </div>
  );
}

/**
 * Chart card skeleton — matches the merchant daily issuance chart area.
 */
export function SkeletonChartCard({ height = '15rem' }) {
  return (
    <SkeletonBlock
      aria-busy="true"
      aria-label="Loading chart"
      height={height}
      style={{ borderRadius: '8px' }}
    />
  );
}

/**
 * Grid of SkeletonCards — used on rewards and campaigns pages.
 */
export function SkeletonGrid({ count = 6, showImage = true }) {
  return (
    <div
      aria-busy="true"
      aria-label="Loading items"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
        gap: '1.25rem',
      }}
    >
      {[...Array(count)].map((_, i) => (
        <SkeletonCard key={i} showImage={showImage} />
      ))}
    </div>
  );
}
