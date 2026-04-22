'use client';
import { useState, useEffect } from 'react';
import api from '../lib/api';

/**
 * ReferralLink Component:
 * - Fetches referral code from backend.
 * - Displays shareable URL.
 * - One-click copy with feedback.
 * - Native sharing integration with fallbacks.
 *
 * Requirements: 168
 */
export default function ReferralLink({ userId }) {
  const [referralData, setReferralData] = useState({ code: '', totalReferrals: 0, pointsEarned: 0 });
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const shareUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/register?ref=${referralData.code}`;

  useEffect(() => {
    async function fetchReferral() {
      try {
        setLoading(true);
        // Requirement: GET /users/:id/referral
        const res = await api.get(`/api/users/${userId}/referral`);
        setReferralData(res.data.data);
      } catch (err) {
        // Fallback for demonstration if endpoint isn't ready
        setReferralData({
          code: userId?.slice(-6).toUpperCase() || 'NOVA-REF-123',
          totalReferrals: 0,
          pointsEarned: 0
        });
        setError('Using fallback referral data (backend endpoint not ready).');
      } finally {
        setLoading(false);
      }
    }

    if (userId) fetchReferral();
  }, [userId]);

  const handleCopy = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        // Fallback for older browsers
        const tempInput = document.createElement('input');
        tempInput.value = shareUrl;
        document.body.appendChild(tempInput);
        tempInput.select();
        document.execCommand('copy');
        document.body.removeChild(tempInput);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy referal link:', err);
    }
  };

  const handleShare = async () => {
    const shareData = {
      title: 'Join Nova Rewards!',
      text: 'Hey! Join me on Nova Rewards and earn tokenized rewards for your engagement.',
      url: shareUrl
    };

    if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        if (err.name !== 'AbortError') console.error('Sharing failed:', err);
      }
    } else {
      // Logic fallback if navigator.share is not available (e.g. desktop)
      // Showing mail/social icons would be next step
    }
  };

  if (loading) return <div className="card loading">Generating your referral link...</div>;

  return (
    <div className="card referral-card">
      <h2 style={{ marginBottom: '1rem' }}>Refer your friends & Earn</h2>
      
      <div className="referral-stats">
        <div className="stat-pill">
          <span className="stat-label">Total Referrals:</span>
          <span className="stat-value">{referralData.totalReferrals}</span>
        </div>
        <div className="stat-pill">
          <span className="stat-label">Points Earned:</span>
          <span className="stat-value">{referralData.pointsEarned} NOVA</span>
        </div>
      </div>

      <div className="referral-input-wrapper">
        <input 
          readOnly 
          value={shareUrl} 
          className="input referral-input"
          onClick={(e) => e.target.select()}
        />
        <button className={`btn ${copied ? 'btn-success' : 'btn-primary'}`} onClick={handleCopy}>
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>

      <div className="share-buttons">
        <button className="btn btn-secondary share-btn whatsapp" onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(shareUrl)}`, '_blank')}>
          Share on WhatsApp
        </button>
        <button className="btn btn-secondary share-btn twitter" onClick={() => window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent('Join Nova Rewards!')}`, '_blank')}>
          Share on X
        </button>
        <button className="btn btn-secondary share-btn email" onClick={() => window.location.href = `mailto:?subject=Join Nova Rewards!&body=Join me here: ${shareUrl}`}>
          Email
        </button>
        <button className="btn btn-secondary share-btn native" onClick={handleShare}>
          More Share Options
        </button>
      </div>

      {error && <p className="error-text" style={{fontSize: '0.8rem', marginTop: '1rem', color: '#94a3b8'}}>{error}</p>}

      <style jsx>{`
        .referral-card {
          background: linear-gradient(135deg, #1e1b4b 0%, #0c0a09 100%);
          border: 1px solid rgba(124, 58, 237, 0.3);
          position: relative;
          overflow: hidden;
        }
        .referral-card::before {
          content: '';
          position: absolute;
          top: -50%;
          left: -50%;
          width: 200%;
          height: 200%;
          background: radial-gradient(circle, rgba(124, 58, 237, 0.1) 0%, transparent 70%);
          pointer-events: none;
        }
        .referral-stats {
          display: flex;
          gap: 1rem;
          margin-bottom: 1.5rem;
        }
        .stat-pill {
          background: rgba(124, 58, 237, 0.15);
          padding: 0.5rem 1rem;
          border-radius: 2rem;
          display: flex;
          gap: 0.5rem;
          font-size: 0.9rem;
          border: 1px solid rgba(124, 58, 237, 0.2);
        }
        .stat-label { color: #94a3b8; }
        .stat-value { color: #fff; fontWeight: bold; }
        .referral-input-wrapper {
          display: flex;
          gap: 0.5rem;
          margin-bottom: 1rem;
        }
        .referral-input {
          flex: 1;
          font-family: monospace;
          font-size: 0.85rem;
          background: rgba(0,0,0,0.3);
          border: 1px solid rgba(148, 163, 184, 0.2);
        }
        .share-buttons {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 0.5rem;
        }
        .share-btn {
          font-size: 0.8rem;
          padding: 0.5rem;
          text-align: center;
        }
        .btn-success {
          background: #10b981;
          color: white;
        }
        @media (min-width: 640px) {
          .share-buttons {
            grid-template-columns: repeat(4, 1fr);
          }
        }
      `}</style>
    </div>
  );
}
