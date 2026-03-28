import { useState, useEffect } from 'react';
import { useWallet } from '../context/WalletContext';
import { leaderboardService } from '../lib/leaderboardService';
import { truncateAddress } from '../lib/truncateAddress';

export default function Leaderboard() {
  const { publicKey } = useWallet();
  const [leaderboardData, setLeaderboardData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [rankingType, setRankingType] = useState('all-time');

  useEffect(() => {
    fetchLeaderboard();
  }, [rankingType]);

  const fetchLeaderboard = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await leaderboardService.getLeaderboard(rankingType);
      setLeaderboardData(data);
    } catch (err) {
      setError('Failed to load leaderboard data');
      console.error('Leaderboard error:', err);
    } finally {
      setLoading(false);
    }
  };

  const getRankBadge = (rank) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return rank;
  };

  const getRankBadgeColor = (rank) => {
    if (rank === 1) return '#FFD700';
    if (rank === 2) return '#C0C0C0';
    if (rank === 3) return '#CD7F32';
    return '#7c3aed';
  };

  if (loading) {
    return <LeaderboardSkeleton />;
  }

  if (error) {
    return (
      <div className="card">
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <p style={{ color: '#ef4444', marginBottom: '1rem' }}>{error}</p>
          <button className="btn btn-primary" onClick={fetchLeaderboard}>
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!leaderboardData || leaderboardData.length === 0) {
    return (
      <div className="card">
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <p style={{ color: '#94a3b8', fontSize: '1.1rem' }}>No leaderboard data available</p>
          <p style={{ color: '#64748b', fontSize: '0.9rem', marginTop: '0.5rem' }}>
            Check back later for the latest rankings!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2>Nova Leaderboard</h2>
        <div className="toggle-group">
          <button
            className={`btn ${rankingType === 'all-time' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setRankingType('all-time')}
            style={{ marginRight: '0.5rem' }}
          >
            All-Time
          </button>
          <button
            className={`btn ${rankingType === 'weekly' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setRankingType('weekly')}
          >
            Weekly
          </button>
        </div>
      </div>

      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th style={{ width: '80px' }}>Rank</th>
              <th>User</th>
              <th style={{ textAlign: 'right' }}>NOVA Points</th>
            </tr>
          </thead>
          <tbody>
            {leaderboardData.map((entry, index) => {
              const rank = index + 1;
              const isCurrentUser = entry.publicKey === publicKey;
              
              return (
                <tr
                  key={entry.publicKey}
                  style={{
                    backgroundColor: isCurrentUser ? 'rgba(124, 58, 237, 0.1)' : 'transparent',
                    fontWeight: isCurrentUser ? '600' : 'normal'
                  }}
                >
                  <td>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: rank <= 3 ? '1.2rem' : '1rem',
                        color: getRankBadgeColor(rank),
                        fontWeight: rank <= 3 ? 'bold' : 'normal'
                      }}
                    >
                      {getRankBadge(rank)}
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      {entry.avatar && (
                        <img
                          src={entry.avatar}
                          alt="Avatar"
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            objectFit: 'cover'
                          }}
                        />
                      )}
                      <div>
                        <div style={{ fontWeight: '500' }}>
                          {entry.displayName || truncateAddress(entry.publicKey)}
                        </div>
                        {isCurrentUser && (
                          <div style={{ fontSize: '0.75rem', color: '#7c3aed' }}>
                            You
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: '600', color: '#7c3aed' }}>
                    {parseFloat(entry.totalPoints).toLocaleString()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LeaderboardSkeleton() {
  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div className="skeleton-line" style={{ width: '150px', height: '1.5rem' }}></div>
        <div className="skeleton-line" style={{ width: '150px', height: '2rem' }}></div>
      </div>
      
      <div className="skeleton-table">
        {[...Array(10)].map((_, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.75rem 0' }}>
            <div className="skeleton-line" style={{ width: '40px', height: '1rem' }}></div>
            <div className="skeleton-line" style={{ width: '40px', height: '2rem', borderRadius: '50%' }}></div>
            <div className="skeleton-line" style={{ flex: 1, height: '1rem' }}></div>
            <div className="skeleton-line" style={{ width: '80px', height: '1rem' }}></div>
          </div>
        ))}
      </div>
      
      <style jsx>{`
        .skeleton-line {
          background: var(--surface-2);
          border-radius: 4px;
          animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
