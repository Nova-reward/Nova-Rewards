'use client';

import Link from 'next/link';

const STATUS_BADGE = {
  active:   { cls: 'badge badge-green', label: '● Active' },
  paused:   { cls: 'badge', style: { background: 'var(--badge-gray-bg)', color: '#f59e0b' }, label: '⏸ Paused' },
  inactive: { cls: 'badge badge-gray',  label: 'Inactive' },
};

/**
 * Campaign list with status badges and pause/resume quick-actions.
 * @param {{ campaigns: object[], loading: boolean, onPause: (id:string)=>void, onResume: (id:string)=>void }} props
 */
export default function CampaignList({ campaigns, loading, onPause, onResume }) {
  if (loading) {
    return (
      <div>
        {[...Array(3)].map((_, i) => (
          <div key={i} className="skeleton-block" style={{ height: '2.5rem', marginBottom: '0.5rem', borderRadius: 8 }} />
        ))}
      </div>
    );
  }

  if (!campaigns?.length) {
    return <p style={{ color: 'var(--muted)', textAlign: 'center', padding: '1.5rem 0' }}>No campaigns yet.</p>;
  }

  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Campaign</th>
            <th>Rate</th>
            <th>Ends</th>
            <th>Status</th>
            <th style={{ textAlign: 'right' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {campaigns.map((c) => {
            const badge = STATUS_BADGE[c.status] ?? STATUS_BADGE.inactive;
            return (
              <tr key={c.id}>
                <td style={{ fontWeight: 600 }}>{c.name}</td>
                <td>{c.rewardRate} NOVA/unit</td>
                <td style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>{c.endDate}</td>
                <td>
                  <span className={badge.cls} style={badge.style}>{badge.label}</span>
                </td>
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  {c.status === 'active' && (
                    <button
                      className="btn btn-secondary"
                      style={{ padding: '0.3rem 0.8rem', fontSize: '0.8rem', marginRight: '0.5rem' }}
                      onClick={() => onPause(c.id)}
                      aria-label={`Pause ${c.name}`}
                    >
                      Pause
                    </button>
                  )}
                  {c.status === 'paused' && (
                    <button
                      className="btn btn-primary"
                      style={{ padding: '0.3rem 0.8rem', fontSize: '0.8rem', marginRight: '0.5rem' }}
                      onClick={() => onResume(c.id)}
                      aria-label={`Resume ${c.name}`}
                    >
                      Resume
                    </button>
                  )}
                  <Link href="/merchant" style={{ fontSize: '0.8rem', color: 'var(--accent)' }}>
                    Manage →
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
