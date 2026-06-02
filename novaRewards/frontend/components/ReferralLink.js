'use client';
import { useState, useEffect } from 'react';
import api from '../lib/api';
import { withFeatureFlag, FLAGS } from '../lib/featureFlags';
import CopyButton from './ui/CopyButton';

/**
 * ReferralLink Component:
 * - Fetches referral code from backend.
 * - Displays shareable URL.
 * - One-click copy with feedback.
 * - Native sharing integration with fallbacks.
 * - Share buttons for Twitter, Telegram, WhatsApp
 * - Regenerate referral link option
 *
 * Closes #849
 */
function ReferralLink({ userId }) {
  const [referralData, setReferralData] = useState({ code: '', totalReferrals: 0, pointsEarned: 0 });
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [regenerating, setRegenerating] = useState(false);

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
    }
  };

  const handleRegenerate = async () => {
    try {
      setRegenerating(true);
      const res = await api.post(`/api/users/${userId}/referral/regenerate`);
      setReferralData(res.data.data);
      setError(null);
    } catch (err) {
      setError('Failed to regenerate referral link');
      console.error('Regenerate failed:', err);
    } finally {
      setRegenerating(false);
    }
  };

  if (loading) return <div className="card loading">Generating your referral link...</div>;

  return (
    <div className="card referral-card">
      <h2 style={{ marginBottom: '1rem' }}>👥 Refer your friends & Earn</h2>
      
      <div className="referral-stats">
        <div className="stat-pill">
          <span className="stat-label">Total Referrals:</span>
          <span className="stat-value">{referralData.totalReferrals}</span>
        </div>
        <div className="stat-pill">
          <span className="stat-label">Tokens Earned:</span>
          <span className="stat-value">{referralData.pointsEarned} NOVA</span>
        </div>
      </div>

      <div className="referral-input-wrapper">
        <input 
          readOnly 
          value={shareUrl} 
          className="input referral-input"
          onClick={(e) => e.target.select()}
          onFocus={(e) => e.target.select()}
          aria-label="Your referral link"
        />
        <CopyButton value={shareUrl} label="Copy" className="referral-copy-btn" />
      </div>

      <div className="share-buttons">
        <button 
          className="btn btn-secondary share-btn whatsapp" 
          onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(shareUrl)}`, '_blank')}
          aria-label="Share on WhatsApp"
        >
          WhatsApp
        </button>
        <button 
          className="btn btn-secondary share-btn twitter" 
          onClick={() => window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent('Join Nova Rewards!')}`, '_blank')}
          aria-label="Share on X (Twitter)"
        >
          X
        </button>
        <button 
          className="btn btn-secondary share-btn telegram" 
          onClick={() => window.open(`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent('Join Nova Rewards!')}`, '_blank')}
          aria-label="Share on Telegram"
        >
          Telegram
        </button>
        <button 
          className="btn btn-secondary share-btn email" 
          onClick={() => window.location.href = `mailto:?subject=Join Nova Rewards!&body=Join me here: ${shareUrl}`}
          aria-label="Share via Email"
        >
          Email
        </button>
        {navigator.share && (
          <button 
            className="btn btn-secondary share-btn native" 
            onClick={handleShare}
            aria-label="More share options"
          >
            More
          </button>
        )}
      </div>

      <div className="referral-actions">
        <button 
          className="btn btn-outline btn-sm"
          onClick={handleRegenerate}
          disabled={regenerating}
          aria-label="Generate new referral link"
        >
          {regenerating ? 'Regenerating...' : '🔄 Generate New Link'}
        </button>
      </div>

      {error && <p className="error-text" style={{fontSize: '0.875rem', marginTop: '1rem', color: '#b8c7d9'}}>{error}</p>}

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
          flex-wrap: wrap;
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
        .stat-label { color: #b8c7d9; } /* #b8c7d9 on effective bg ~#261e4f → 5.1:1 — fixes ISSUE-CC-05 (was #94a3b8, 3.2:1) */
        .stat-value { color: #fff; font-weight: bold; }
        .referral-input-wrapper {
          display: flex;
          gap: 0.5rem;
          margin-bottom: 1rem;
        }
        .referral-input {
          flex: 1;
          font-family: monospace;
          font-size: 0.875rem; /* raised from 0.85rem — fixes ISSUE-FS-02 */
          background: rgba(0,0,0,0.3);
          border: 1px solid rgba(148, 163, 184, 0.2);
        }
        .referral-copy-btn {
          white-space: nowrap;
        }
        .share-buttons {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(80px, 1fr));
          gap: 0.5rem;
          margin-bottom: 1rem;
        }
        .share-btn {
          font-size: 0.875rem; /* raised from 0.8rem — fixes ISSUE-FS-02 */
          padding: 0.5rem;
          text-align: center;
        }
        .referral-actions {
          display: flex;
          gap: 0.5rem;
          margin-top: 1rem;
        }
        @media (min-width: 640px) {
          .share-buttons {
            grid-template-columns: repeat(5, 1fr);
          }
        }
      `}</style>
    </div>
  );
}

// Wrap with the feature flag HOC — renders null when REFERRAL flag is off.
// Requirements: #606 (NEXT_PUBLIC_REFERRAL_ENABLED feature flag)
export default withFeatureFlag(ReferralLink, FLAGS.REFERRAL);
