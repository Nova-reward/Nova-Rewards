'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import ErrorBoundary from '../components/ErrorBoundary';
import ConfirmationModal from '../components/ConfirmationModal';
import { withAuth } from '../context/AuthContext';
import { getRewards, redeemReward } from '../lib/api';

/**
 * Rewards page - displays available rewards catalogue
 * Requirements: 164.2, #166
 */
function RewardsContent() {
  const [rewards, setRewards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [userPoints, setUserPoints] = useState(0);
  const [selectedReward, setSelectedReward] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [redeeming, setRedeeming] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sortBy, setSortBy] = useState('points-asc');

  useEffect(() => {
    loadRewards();
  }, []);

  const loadRewards = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await getRewards();
      setRewards(data.rewards || []);
      setUserPoints(data.userPoints || 0);
    } catch (err) {
      setError(err.message || 'Failed to load rewards');
    } finally {
      setLoading(false);
    }
  };

  const handleRedeemClick = (reward) => {
    setSelectedReward(reward);
    setShowModal(true);
  };

  const handleConfirmRedeem = async () => {
    if (!selectedReward) return;

    try {
      setRedeeming(true);
      setError('');
      await redeemReward(selectedReward.id);
      
      // Optimistically update local state
      setUserPoints(prev => prev - selectedReward.pointCost);
      setRewards(prev => prev.map(r => 
        r.id === selectedReward.id 
          ? { ...r, stock: r.stock - 1 }
          : r
      ));
      
      setSuccessMessage(`Successfully redeemed ${selectedReward.name}!`);
      setShowModal(false);
      setSelectedReward(null);
      
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (err) {
      setError(err.message || 'Failed to redeem reward');
    } finally {
      setRedeeming(false);
    }
  };

  const getCategories = () => {
    const cats = new Set(rewards.map(r => r.category));
    return ['all', ...Array.from(cats)];
  };

  const getFilteredAndSortedRewards = () => {
    let filtered = rewards;
    
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(r => r.category === categoryFilter);
    }
    
    const sorted = [...filtered].sort((a, b) => {
      if (sortBy === 'points-asc') return a.pointCost - b.pointCost;
      if (sortBy === 'points-desc') return b.pointCost - a.pointCost;
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      return 0;
    });
    
    return sorted;
  };

  const canAfford = (reward) => userPoints >= reward.pointCost;
  const isInStock = (reward) => reward.stock > 0;
  const canRedeem = (reward) => canAfford(reward) && isInStock(reward);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="dashboard-content">
          <div className="card">
            <p>Loading rewards...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="dashboard-content">
        {successMessage && (
          <div className="success" style={{ marginBottom: '1rem', padding: '1rem', background: 'var(--badge-green-bg)', borderRadius: '8px' }}>
            {successMessage}
          </div>
        )}
        
        {error && (
          <div className="error" style={{ marginBottom: '1rem', padding: '1rem', background: 'rgba(220, 38, 38, 0.1)', borderRadius: '8px' }}>
            {error}
          </div>
        )}

        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2>🎁 Rewards Catalogue</h2>
            <div style={{ fontSize: '1.1rem', fontWeight: '600' }}>
              Your Points: <span style={{ color: 'var(--accent)' }}>{userPoints}</span>
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
            <div>
              <label className="label">Category:</label>
              <select 
                className="input" 
                value={categoryFilter} 
                onChange={(e) => setCategoryFilter(e.target.value)}
                style={{ marginBottom: 0 }}
              >
                {getCategories().map(cat => (
                  <option key={cat} value={cat}>
                    {cat === 'all' ? 'All Categories' : cat}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="label">Sort By:</label>
              <select 
                className="input" 
                value={sortBy} 
                onChange={(e) => setSortBy(e.target.value)}
                style={{ marginBottom: 0 }}
              >
                <option value="points-asc">Points: Low to High</option>
                <option value="points-desc">Points: High to Low</option>
                <option value="name">Name</option>
              </select>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
          {getFilteredAndSortedRewards().map(reward => (
            <div key={reward.id} className="card" style={{ display: 'flex', flexDirection: 'column' }}>
              {reward.image && (
                <img 
                  src={reward.image} 
                  alt={reward.name}
                  style={{ width: '100%', height: '180px', objectFit: 'cover', borderRadius: '8px', marginBottom: '1rem' }}
                />
              )}
              
              <h3 style={{ marginBottom: '0.5rem', fontSize: '1.1rem' }}>{reward.name}</h3>
              
              {reward.description && (
                <p style={{ color: 'var(--muted)', fontSize: '0.9rem', marginBottom: '1rem', flex: 1 }}>
                  {reward.description}
                </p>
              )}
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div style={{ fontSize: '1.2rem', fontWeight: '700', color: 'var(--accent)' }}>
                  {reward.pointCost} pts
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
                  Stock: {reward.stock}
                </div>
              </div>
              
              {reward.category && (
                <div className="badge badge-gray" style={{ marginBottom: '1rem', width: 'fit-content' }}>
                  {reward.category}
                </div>
              )}
              
              <button
                className="btn btn-primary btn-full"
                onClick={() => handleRedeemClick(reward)}
                disabled={!canRedeem(reward)}
                title={
                  !isInStock(reward) ? 'Out of stock' :
                  !canAfford(reward) ? 'Insufficient points' :
                  'Redeem this reward'
                }
              >
                {!isInStock(reward) ? 'Out of Stock' :
                 !canAfford(reward) ? 'Insufficient Points' :
                 'Redeem'}
              </button>
            </div>
          ))}
        </div>

        {getFilteredAndSortedRewards().length === 0 && (
          <div className="card">
            <p style={{ textAlign: 'center', color: 'var(--muted)' }}>
              No rewards available in this category.
            </p>
          </div>
        )}
      </div>

      {showModal && selectedReward && (
        <ConfirmationModal
          title="Confirm Redemption"
          message={
            <div>
              <p style={{ marginBottom: '1rem' }}>Are you sure you want to redeem this reward?</p>
              <div className="confirmation-details">
                <p><strong>Reward:</strong> {selectedReward.name}</p>
                <p><strong>Cost:</strong> {selectedReward.pointCost} points</p>
                <p><strong>Your Balance:</strong> {userPoints} points</p>
                <p><strong>After Redemption:</strong> {userPoints - selectedReward.pointCost} points</p>
              </div>
            </div>
          }
          onConfirm={handleConfirmRedeem}
          onCancel={() => {
            setShowModal(false);
            setSelectedReward(null);
          }}
          confirmText={redeeming ? 'Redeeming...' : 'Confirm'}
          confirmDisabled={redeeming}
        />
      )}
    </DashboardLayout>
  );
}

function Rewards() {
  return (
    <ErrorBoundary>
      <RewardsContent />
    </ErrorBoundary>
  );
}

export default withAuth(Rewards);
