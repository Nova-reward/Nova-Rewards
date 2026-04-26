'use client';

const CONFIG = {
  pending:    { label: 'Pending',     color: '#f59e0b', dot: true  },
  confirming: { label: 'Confirming…', color: '#06b6d4', dot: true  },
  confirmed:  { label: 'Confirmed',   color: '#10b981', dot: false },
  failed:     { label: 'Failed',      color: '#ef4444', dot: false },
  expired:    { label: 'Expired',     color: '#8b5cf6', dot: false },
  timeout:    { label: 'Timed out',   color: '#ef4444', dot: false },
};

/**
 * Displays real-time Stellar transaction status.
 * pending → confirming → confirmed / failed
 *
 * Issue #662
 */
export default function TxStatusBadge({ status }) {
  if (!status) return null;
  const cfg = CONFIG[status] || { label: status, color: '#64748b', dot: false };

  return (
    <span
      role="status"
      aria-live="polite"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '3px 10px', borderRadius: 9999, fontSize: 13, fontWeight: 500,
        background: `${cfg.color}22`, color: cfg.color, border: `1px solid ${cfg.color}55`,
      }}
    >
      {cfg.dot && (
        <span aria-hidden="true" style={{
          width: 8, height: 8, borderRadius: '50%', background: cfg.color,
          animation: 'pulse 1.2s ease-in-out infinite',
        }} />
      )}
      {cfg.label}
    </span>
  );
}
