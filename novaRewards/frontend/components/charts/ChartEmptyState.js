'use client';

const MESSAGES = {
  empty:   { icon: '📊', title: 'No data yet', body: 'Data will appear here once activity is recorded.' },
  loading: { icon: null,  title: 'Loading…',   body: null },
  error:   { icon: '⚠️', title: 'Failed to load', body: null },
};

/**
 * Shared empty / loading / error placeholder for all chart components.
 * Issue #618
 */
export default function ChartEmptyState({ type = 'empty', message }) {
  const cfg = MESSAGES[type] || MESSAGES.empty;

  return (
    <div
      role="status"
      aria-label={cfg.title}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', height: 260, gap: 8,
        color: 'var(--color-text-muted, #64748b)',
      }}
    >
      {type === 'loading' ? (
        <span className="chart-spinner" aria-hidden="true" style={{
          width: 32, height: 32, borderRadius: '50%',
          border: '3px solid currentColor', borderTopColor: 'transparent',
          animation: 'spin 0.8s linear infinite',
        }} />
      ) : (
        <span style={{ fontSize: 32 }} aria-hidden="true">{cfg.icon}</span>
      )}
      <p style={{ margin: 0, fontWeight: 600 }}>{cfg.title}</p>
      {(message || cfg.body) && (
        <p style={{ margin: 0, fontSize: 13 }}>{message || cfg.body}</p>
      )}
    </div>
  );
}
