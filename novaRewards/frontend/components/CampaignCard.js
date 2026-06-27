'use client';

/**
 * CampaignCard — displays a single campaign in the discovery grid.
 *
 * Shows: merchant logo, campaign name, category badge, reward amount,
 * expiry date, status badge, and a "View Details" CTA.
 *
 * Requirements: #598
 */
export default function CampaignCard({ campaign, onViewDetails }) {
  const {
    name,
    description,
    category,
    rewardType,
    rewardRate,
    merchantName,
    merchantLogo,
    endDate,
    status,
    participantCount,
  } = campaign;

  const expiry = endDate ? new Date(endDate) : null;
  const now = new Date();
  const daysLeft = expiry ? Math.ceil((expiry - now) / (1000 * 60 * 60 * 24)) : null;

  const isExpiringSoon = daysLeft !== null && daysLeft <= 7 && daysLeft > 0;
  const isExpired = status === 'completed';

  return (
    <article
      className="campaign-card"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        transition: 'box-shadow 0.15s ease, transform 0.15s ease',
        opacity: isExpired ? 0.65 : 1,
      }}
      onMouseEnter={(e) => {
        if (!isExpired) {
          e.currentTarget.style.boxShadow = '0 4px 20px rgba(124,58,237,0.18)';
          e.currentTarget.style.transform = 'translateY(-2px)';
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = '';
        e.currentTarget.style.transform = '';
      }}
    >
      {/* ── Header band ── */}
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(124,58,237,0.12) 0%, rgba(124,58,237,0.04) 100%)',
          padding: '1rem 1.25rem 0.75rem',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
        }}
      >
        {/* Merchant logo / initials */}
        <div
          aria-hidden="true"
          style={{
            width: 44,
            height: 44,
            borderRadius: '10px',
            background: merchantLogo ? 'transparent' : 'rgba(124,58,237,0.15)',
            border: '1px solid rgba(124,58,237,0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            overflow: 'hidden',
          }}
        >
          {merchantLogo ? (
            <img
              src={merchantLogo}
              alt={`${merchantName} logo`}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <span style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--accent)' }}>
              {(merchantName || 'M').charAt(0).toUpperCase()}
            </span>
          )}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              fontSize: '0.75rem',
              color: 'var(--muted)',
              marginBottom: '0.1rem',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {merchantName || 'Unknown Merchant'}
          </p>
          <h3
            style={{
              fontSize: '0.95rem',
              fontWeight: 700,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              color: 'var(--text)',
            }}
          >
            {name}
          </h3>
        </div>

        {/* Status badge */}
        <StatusBadge status={status} />
      </div>

      {/* ── Body ── */}
      <div style={{ padding: '1rem 1.25rem', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {/* Description */}
        {description && (
          <p
            style={{
              fontSize: '0.85rem',
              color: 'var(--muted)',
              lineHeight: 1.5,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {description}
          </p>
        )}

        {/* Category + reward type chips */}
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          {category && <Chip label={category} />}
          {rewardType && <Chip label={rewardType} accent />}
        </div>

        {/* Reward amount */}
        <div
          style={{
            background: 'rgba(124,58,237,0.08)',
            border: '1px solid rgba(124,58,237,0.15)',
            borderRadius: '8px',
            padding: '0.6rem 0.9rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>Reward rate</span>
          <span style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--accent)' }}>
            {rewardRate} NOVA<span style={{ fontSize: '0.75rem', fontWeight: 400, color: 'var(--muted)' }}>/unit</span>
          </span>
        </div>

        {/* Meta row: expiry + participants */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: 'var(--muted)' }}>
          <span>
            {isExpired ? (
              <span style={{ color: 'var(--error)' }}>Expired</span>
            ) : expiry ? (
              <>
                Ends{' '}
                <span style={{ color: isExpiringSoon ? '#f59e0b' : 'var(--muted)', fontWeight: isExpiringSoon ? 600 : 400 }}>
                  {isExpiringSoon ? `in ${daysLeft}d` : expiry.toLocaleDateString()}
                </span>
              </>
            ) : (
              'No expiry'
            )}
          </span>
          {participantCount > 0 && (
            <span>{participantCount.toLocaleString()} joined</span>
          )}
        </div>
      </div>

      {/* ── CTA ── */}
      <div style={{ padding: '0 1.25rem 1.25rem' }}>
        <button
          className="btn btn-primary"
          style={{ width: '100%', fontSize: '0.875rem' }}
          onClick={() => onViewDetails(campaign)}
          disabled={isExpired}
          aria-label={`View details for ${name}`}
        >
          {isExpired ? 'Campaign Ended' : 'View Details →'}
        </button>
      </div>
    </article>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatusBadge({ status }) {
  const map = {
    active:    { bg: 'var(--badge-green-bg)',  color: 'var(--badge-green-text)', label: '● Active' },
    paused:    { bg: '#fef9c3',                color: '#854d0e',                 label: '⏸ Paused' },
    completed: { bg: 'var(--badge-gray-bg)',   color: 'var(--badge-gray-text)',  label: 'Ended' },
  };
  const s = map[status] ?? map.completed;
  return (
    <span
      style={{
        background: s.bg,
        color: s.color,
        padding: '2px 8px',
        borderRadius: '9999px',
        fontSize: '0.72rem',
        fontWeight: 600,
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}
    >
      {s.label}
    </span>
  );
}

function Chip({ label, accent }) {
  return (
    <span
      style={{
        background: accent ? 'rgba(124,58,237,0.1)' : 'var(--surface-2)',
        color: accent ? 'var(--accent)' : 'var(--muted)',
        border: `1px solid ${accent ? 'rgba(124,58,237,0.2)' : 'var(--border)'}`,
        padding: '2px 8px',
        borderRadius: '9999px',
        fontSize: '0.72rem',
        fontWeight: 500,
        textTransform: 'capitalize',
      }}
    >
      {label}
    </span>
  );
}
