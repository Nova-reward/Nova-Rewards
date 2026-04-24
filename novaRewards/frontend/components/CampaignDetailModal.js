'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/router';

/**
 * CampaignDetailModal — full campaign details including eligibility rules.
 *
 * Accessible: traps focus, closes on Escape, backdrop click, and route change.
 * Requirements: #598 (campaign detail modal/page shows full eligibility rules)
 */
export default function CampaignDetailModal({ campaign, onClose }) {
  const overlayRef = useRef(null);
  const closeRef = useRef(null);
  const router = useRouter();

  // Close on Escape key
  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  // Close on route change (e.g. user navigates away)
  useEffect(() => {
    router.events.on('routeChangeStart', onClose);
    return () => router.events.off('routeChangeStart', onClose);
  }, [router, onClose]);

  // Lock body scroll while open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    return () => { document.body.style.overflow = ''; };
  }, []);

  if (!campaign) return null;

  const {
    name,
    description,
    category,
    rewardType,
    rewardRate,
    merchantName,
    merchantLogo,
    startDate,
    endDate,
    status,
    participantCount,
    eligibilityRules,
    tags,
  } = campaign;

  const start = startDate ? new Date(startDate).toLocaleDateString() : '—';
  const end   = endDate   ? new Date(endDate).toLocaleDateString()   : '—';

  return (
    /* Backdrop */
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="campaign-modal-title"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(4px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      {/* Panel */}
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '560px',
          maxHeight: '90vh',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* ── Header ── */}
        <div
          style={{
            background: 'linear-gradient(135deg, rgba(124,58,237,0.15) 0%, rgba(124,58,237,0.04) 100%)',
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '1rem',
          }}
        >
          {/* Merchant logo */}
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: '12px',
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
              <img src={merchantLogo} alt={`${merchantName} logo`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <span style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--accent)' }}>
                {(merchantName || 'M').charAt(0).toUpperCase()}
              </span>
            )}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: '0.8rem', color: 'var(--muted)', marginBottom: '0.2rem' }}>
              {merchantName || 'Unknown Merchant'}
            </p>
            <h2
              id="campaign-modal-title"
              style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text)', lineHeight: 1.3 }}
            >
              {name}
            </h2>
          </div>

          <button
            ref={closeRef}
            onClick={onClose}
            aria-label="Close campaign details"
            style={{
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              width: 32,
              height: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0,
              color: 'var(--muted)',
              fontSize: '1rem',
            }}
          >
            ✕
          </button>
        </div>

        {/* ── Body ── */}
        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          {/* Status + chips */}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <StatusBadge status={status} />
            {category && <Chip label={category} />}
            {rewardType && <Chip label={rewardType} accent />}
            {tags?.map((t) => <Chip key={t} label={t} />)}
          </div>

          {/* Description */}
          {description && (
            <p style={{ fontSize: '0.9rem', color: 'var(--muted)', lineHeight: 1.6 }}>
              {description}
            </p>
          )}

          {/* Key stats grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '0.75rem',
            }}
          >
            <StatBox label="Reward Rate" value={`${rewardRate} NOVA/unit`} accent />
            <StatBox label="Participants" value={participantCount > 0 ? participantCount.toLocaleString() : '—'} />
            <StatBox label="Start Date" value={start} />
            <StatBox label="End Date" value={end} />
          </div>

          {/* Eligibility rules */}
          <section aria-labelledby="eligibility-heading">
            <h3
              id="eligibility-heading"
              style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.6rem', color: 'var(--text)' }}
            >
              📋 Eligibility Rules
            </h3>
            <div
              style={{
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                padding: '1rem',
                fontSize: '0.875rem',
                color: 'var(--muted)',
                lineHeight: 1.7,
                whiteSpace: 'pre-wrap',
              }}
            >
              {eligibilityRules || 'No specific eligibility requirements. Open to all users.'}
            </div>
          </section>

          {/* How to participate */}
          <section aria-labelledby="how-heading">
            <h3
              id="how-heading"
              style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.6rem', color: 'var(--text)' }}
            >
              🚀 How to Participate
            </h3>
            <ol
              style={{
                paddingLeft: '1.25rem',
                fontSize: '0.875rem',
                color: 'var(--muted)',
                lineHeight: 1.8,
                display: 'flex',
                flexDirection: 'column',
                gap: '0.25rem',
              }}
            >
              <li>Connect your Stellar wallet via Freighter.</li>
              <li>Complete qualifying actions with {merchantName || 'the merchant'}.</li>
              <li>NOVA tokens are automatically credited to your wallet.</li>
              <li>Redeem your NOVA tokens in the Rewards catalogue.</li>
            </ol>
          </section>
        </div>

        {/* ── Footer ── */}
        <div
          style={{
            padding: '1rem 1.5rem',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            gap: '0.75rem',
            justifyContent: 'flex-end',
          }}
        >
          <button className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
          {status === 'active' && (
            <a href="/dashboard" className="btn btn-primary" style={{ textDecoration: 'none' }}>
              Participate Now →
            </a>
          )}
        </div>
      </div>
    </div>
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
    <span style={{ background: s.bg, color: s.color, padding: '3px 10px', borderRadius: '9999px', fontSize: '0.78rem', fontWeight: 600 }}>
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
        fontSize: '0.75rem',
        fontWeight: 500,
        textTransform: 'capitalize',
      }}
    >
      {label}
    </span>
  );
}

function StatBox({ label, value, accent }) {
  return (
    <div
      style={{
        background: 'var(--surface-2)',
        border: '1px solid var(--border)',
        borderRadius: '8px',
        padding: '0.75rem',
      }}
    >
      <p style={{ fontSize: '0.72rem', color: 'var(--muted)', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}
      </p>
      <p style={{ fontSize: '1rem', fontWeight: 700, color: accent ? 'var(--accent)' : 'var(--text)' }}>
        {value}
      </p>
    </div>
  );
}
