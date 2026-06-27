import { useState, useEffect } from 'react';
import api from '../lib/api';

/**
 * VestingSchedule Component
 * Displays token vesting schedule with timeline visualization
 * 
 * Closes #850
 */
export default function VestingSchedule({ userId }) {
  const [vestingData, setVestingData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [claiming, setClaiming] = useState(false);

  useEffect(() => {
    async function fetchVestingData() {
      try {
        setLoading(true);
        const res = await api.get(`/api/users/${userId}/vesting`);
        setVestingData(res.data.data);
      } catch (err) {
        setError('Failed to load vesting schedule');
        console.error('Vesting fetch error:', err);
      } finally {
        setLoading(false);
      }
    }

    if (userId) fetchVestingData();
  }, [userId]);

  const handleClaim = async () => {
    if (!vestingData?.claimable || vestingData.claimable <= 0) return;

    try {
      setClaiming(true);
      const res = await api.post(`/api/users/${userId}/vesting/claim`);
      setVestingData(res.data.data);
    } catch (err) {
      setError('Failed to claim tokens');
      console.error('Claim error:', err);
    } finally {
      setClaiming(false);
    }
  };

  if (loading) {
    return <div className="card loading">Loading vesting schedule...</div>;
  }

  if (!vestingData) {
    return (
      <div className="card">
        <h3>Token Vesting</h3>
        <p style={{ color: 'var(--muted)' }}>No vesting schedule found.</p>
      </div>
    );
  }

  const total = vestingData.total || 0;
  const vested = vestingData.vested || 0;
  const unvested = vestingData.unvested || 0;
  const claimable = vestingData.claimable || 0;
  const vestedPercent = total > 0 ? (vested / total) * 100 : 0;

  return (
    <div className="card vesting-card">
      <h3 style={{ marginBottom: '1.5rem' }}>📅 Token Vesting Schedule</h3>

      {error && (
        <div className="error-banner" style={{ marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      {/* Token Amounts */}
      <div className="vesting-amounts">
        <div className="amount-box">
          <span className="amount-label">Total Tokens</span>
          <span className="amount-value">{total.toLocaleString()}</span>
        </div>
        <div className="amount-box">
          <span className="amount-label">Vested</span>
          <span className="amount-value vested">{vested.toLocaleString()}</span>
        </div>
        <div className="amount-box">
          <span className="amount-label">Unvested</span>
          <span className="amount-value unvested">{unvested.toLocaleString()}</span>
        </div>
        <div className="amount-box">
          <span className="amount-label">Claimable</span>
          <span className="amount-value claimable">{claimable.toLocaleString()}</span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="vesting-progress">
        <div className="progress-label">
          <span>Vesting Progress</span>
          <span className="progress-percent">{vestedPercent.toFixed(1)}%</span>
        </div>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${vestedPercent}%` }} />
        </div>
      </div>

      {/* Timeline */}
      {vestingData.schedule && vestingData.schedule.length > 0 && (
        <div className="vesting-timeline">
          <h4 style={{ marginBottom: '1rem' }}>Vesting Timeline</h4>
          <div className="timeline-items">
            {vestingData.schedule.map((item, idx) => {
              const cliffDate = new Date(item.cliffDate);
              const unlockDate = new Date(item.unlockDate);
              const now = new Date();
              const isPast = unlockDate < now;
              const isCurrent = cliffDate <= now && unlockDate >= now;

              return (
                <div key={idx} className={`timeline-item ${isPast ? 'past' : isCurrent ? 'current' : 'future'}`}>
                  <div className="timeline-marker" />
                  <div className="timeline-content">
                    <div className="timeline-date">
                      {cliffDate.toLocaleDateString()} - {unlockDate.toLocaleDateString()}
                    </div>
                    <div className="timeline-amount">
                      {item.amount.toLocaleString()} tokens
                    </div>
                    {isPast && <span className="timeline-badge">Unlocked</span>}
                    {isCurrent && <span className="timeline-badge current">In Progress</span>}
                    {!isPast && !isCurrent && <span className="timeline-badge future">Upcoming</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Claim Button */}
      <div className="vesting-actions">
        <button
          className="btn btn-primary"
          onClick={handleClaim}
          disabled={claiming || claimable <= 0}
          aria-label="Claim vested tokens"
        >
          {claiming ? 'Claiming...' : `Claim ${claimable.toLocaleString()} Tokens`}
        </button>
        {claimable <= 0 && (
          <p style={{ fontSize: '0.85rem', color: 'var(--muted)', marginTop: '0.5rem' }}>
            No claimable tokens at this time
          </p>
        )}
      </div>

      <style jsx>{`
        .vesting-card {
          background: linear-gradient(135deg, rgba(124, 58, 237, 0.05) 0%, rgba(99, 102, 241, 0.05) 100%);
          border: 1px solid rgba(124, 58, 237, 0.2);
        }

        .vesting-amounts {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
          gap: 1rem;
          margin-bottom: 2rem;
        }

        .amount-box {
          background: rgba(0, 0, 0, 0.2);
          padding: 1rem;
          border-radius: 0.5rem;
          border: 1px solid rgba(124, 58, 237, 0.1);
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .amount-label {
          font-size: 0.875rem; /* raised from 0.85rem */
          /* #b8c7d9 on dark backgrounds ≥5:1; on light card fallback use var(--color-text-muted) */
          color: #b8c7d9;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .amount-value {
          font-size: 1.25rem;
          font-weight: bold;
          color: #fff;
        }

        .amount-value.vested {
          color: #10b981;
        }

        .amount-value.unvested {
          color: #f59e0b;
        }

        .amount-value.claimable {
          color: #3b82f6;
        }

        .vesting-progress {
          margin-bottom: 2rem;
        }

        .progress-label {
          display: flex;
          justify-content: space-between;
          margin-bottom: 0.5rem;
          font-size: 0.9rem;
        }

        .progress-percent {
          font-weight: bold;
          color: #7c3aed;
        }

        .progress-bar {
          height: 8px;
          background: rgba(0, 0, 0, 0.3);
          border-radius: 4px;
          overflow: hidden;
          border: 1px solid rgba(124, 58, 237, 0.2);
        }

        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #7c3aed, #6366f1);
          transition: width 0.3s ease;
        }

        .vesting-timeline {
          margin-bottom: 2rem;
        }

        .timeline-items {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .timeline-item {
          display: flex;
          gap: 1rem;
          padding: 1rem;
          background: rgba(0, 0, 0, 0.2);
          border-radius: 0.5rem;
          border-left: 3px solid rgba(124, 58, 237, 0.3);
        }

        .timeline-item.past {
          border-left-color: #10b981;
          opacity: 0.7;
        }

        .timeline-item.current {
          border-left-color: #f59e0b;
          background: rgba(245, 158, 11, 0.05);
        }

        .timeline-item.future {
          border-left-color: #6b7280;
        }

        .timeline-marker {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: #7c3aed;
          margin-top: 0.25rem;
          flex-shrink: 0;
        }

        .timeline-item.past .timeline-marker {
          background: #10b981;
        }

        .timeline-item.current .timeline-marker {
          background: #f59e0b;
        }

        .timeline-content {
          flex: 1;
        }

        .timeline-date {
          font-size: 0.9rem;
          /* #b8c7d9 on dark card ≥5:1 — fixes hardcoded #94a3b8 */
          color: #b8c7d9;
          margin-bottom: 0.25rem;
        }

        .timeline-amount {
          font-weight: bold;
          color: #fff;
          margin-bottom: 0.5rem;
        }

        .timeline-badge {
          display: inline-block;
          font-size: 0.75rem;
          padding: 0.25rem 0.75rem;
          border-radius: 1rem;
          background: rgba(107, 114, 128, 0.3);
          color: #d1d5db;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .timeline-badge.current {
          background: rgba(245, 158, 11, 0.2);
          color: #fcd34d;
        }

        .timeline-badge.future {
          background: rgba(107, 114, 128, 0.2);
          color: #9ca3af;
        }

        .vesting-actions {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .error-banner {
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.3);
          color: #fca5a5;
          padding: 0.75rem 1rem;
          border-radius: 0.5rem;
          font-size: 0.9rem;
        }

        @media (max-width: 640px) {
          .vesting-amounts {
            grid-template-columns: repeat(2, 1fr);
          }
        }
      `}</style>
    </div>
  );
}
