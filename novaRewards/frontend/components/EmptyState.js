/**
 * EmptyState — reusable empty state with illustration, headline, description, and CTA.
 * Includes SVG illustrations optimized for web (<5KB each).
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
  // Optimized SVG illustrations (~2-4KB each)
  const illustrations = {
    inbox: (
      <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="12" y="20" width="56" height="40" rx="4" stroke="currentColor" strokeWidth="2" fill="none"/>
        <path d="M12 20L40 35L68 20" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round"/>
        <circle cx="40" cy="40" r="8" fill="currentColor" opacity="0.2"/>
      </svg>
    ),
    rewards: (
      <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="40" cy="40" r="28" stroke="currentColor" strokeWidth="2" fill="none"/>
        <path d="M40 28V52M28 40H52" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        <circle cx="40" cy="40" r="6" fill="currentColor"/>
        <path d="M55 25L60 20M25 55L20 60" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      </svg>
    ),
    transactions: (
      <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="16" y="16" width="48" height="48" rx="4" stroke="currentColor" strokeWidth="2" fill="none"/>
        <line x1="24" y1="28" x2="56" y2="28" stroke="currentColor" strokeWidth="1.5"/>
        <line x1="24" y1="40" x2="56" y2="40" stroke="currentColor" strokeWidth="1.5"/>
        <line x1="24" y1="52" x2="40" y2="52" stroke="currentColor" strokeWidth="1.5"/>
      </svg>
    ),
    campaigns: (
      <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="16" y="24" width="48" height="40" rx="4" stroke="currentColor" strokeWidth="2" fill="none"/>
        <path d="M24 40L32 28L40 36L48 24L56 40" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="28" cy="28" r="2" fill="currentColor"/>
      </svg>
    ),
    notifications: (
      <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M40 12C32 12 26 18 26 28V44L20 56H60L54 44V28C54 18 48 12 40 12Z" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="40" cy="64" r="3" fill="currentColor"/>
        <circle cx="40" cy="64" r="6" stroke="currentColor" strokeWidth="1.5" fill="none"/>
      </svg>
    ),
    search: (
      <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="32" cy="32" r="16" stroke="currentColor" strokeWidth="2" fill="none"/>
        <path d="M48 48L64 64" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      </svg>
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
      <div style={{ marginBottom: '1.25rem', color: iconColor[variant] ?? iconColor.default }} aria-hidden="true">
        {illustration ?? illustrations[icon] ?? illustrations.inbox}
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
