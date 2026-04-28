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
 * Dashboard skeleton — two-column layout matching the dashboard summary grid.
 * Drop-in replacement for the old LoadingSkeleton component.
 */
export function SkeletonDashboard() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading dashboard"
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 340px) minmax(0, 1fr)',
        gap: '1.5rem',
        alignItems: 'start',
      }}
    >
      {/* Balance card */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <SkeletonBlock width="55%" height="0.875rem" />
        <SkeletonBlock height="3rem" style={{ borderRadius: '8px' }} />
        <SkeletonBlock width="35%" height="0.75rem" />
      </div>

      {/* Transaction list card */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1.5rem' }}>
        <SkeletonBlock width="45%" height="0.875rem" style={{ marginBottom: '1rem' }} />
        {[...Array(4)].map((_, i) => <SkeletonRow key={i} />)}
      </div>
    </div>
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
