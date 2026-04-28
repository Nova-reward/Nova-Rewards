/**
 * EmptyState — reusable empty state with illustration, headline, description, and CTA.
 *
 * @param {{
 *   icon?: 'inbox'|'rewards'|'transactions'|'campaigns'|'notifications'|'search',
 *   illustration?: React.ReactNode,  // custom SVG/image overrides icon
 *   title?: string,
 *   description?: string,
 *   actionLabel?: string,
 *   onAction?: () => void,
 *   variant?: 'default'|'primary'|'success'|'warning',
 * }} props
 */
export default function EmptyState({
  icon = 'inbox',
  illustration,
  title = 'Nothing here yet',
  description = 'Get started by taking an action below.',
  actionLabel,
  onAction,
  variant = 'default',
}) {
  const icons = {
    inbox: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
    ),
    rewards: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    ),
    transactions: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
    ),
    campaigns: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
    ),
    notifications: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    ),
    search: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    ),
  };

  const bg = { default: 'var(--surface-2)', primary: 'rgba(124,58,237,0.06)', success: 'rgba(5,150,105,0.06)', warning: 'rgba(217,119,6,0.06)' };
  const iconColor = { default: 'var(--muted)', primary: 'var(--accent)', success: 'var(--success)', warning: '#d97706' };

  return (
    <div
      role="status"
      aria-label={title}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '3rem 1.5rem',
        background: bg[variant] ?? bg.default,
        borderRadius: '12px',
        textAlign: 'center',
      }}
    >
      {/* Illustration or icon */}
      <div style={{ marginBottom: '1.25rem' }} aria-hidden="true">
        {illustration ?? (
          <svg
            width="64"
            height="64"
            fill="none"
            viewBox="0 0 24 24"
            stroke={iconColor[variant] ?? iconColor.default}
            strokeWidth={1.5}
          >
            {icons[icon] ?? icons.inbox}
          </svg>
        )}
      </div>

      <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--text)', marginBottom: '0.5rem' }}>
        {title}
      </h3>

      <p style={{ fontSize: '0.875rem', color: 'var(--muted)', maxWidth: '28rem', marginBottom: actionLabel ? '1.5rem' : 0 }}>
        {description}
      </p>

      {actionLabel && onAction && (
        <button
          onClick={onAction}
          style={{
            background: 'var(--accent)',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            padding: '0.5rem 1.5rem',
            fontWeight: 600,
            fontSize: '0.875rem',
            cursor: 'pointer',
          }}
          aria-label={actionLabel}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
