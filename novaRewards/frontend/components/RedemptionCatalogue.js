'use client';

import { useState, useEffect, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from './Toast';
import RewardCard from './RewardCard';
import RedemptionModal from './RedemptionModal';
import ConfettiBurst from './ConfettiBurst';

/**
 * Redemption catalogue screen.
 * Fetches rewards, displays as cards with filtering/sorting, handles redemptions.
 */
export default function RedemptionCatalogue() {
  const { user } = useAuth();
  const { addToast } = useToast();

  // State
  const [rewards, setRewards] = useState([]);
  const [userPoints, setUserPoints] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filter & sort
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState('cost-asc');

  // Modal
  const [selectedReward, setSelectedReward] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  // Fetch rewards catalogue
  useEffect(() => {
    const fetchRewards = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await api.get('/rewards');
        setRewards(response.data.data || response.data);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load rewards');
        addToast('Failed to load rewards catalogue', 'error');
      } finally {
        setLoading(false);
      }
    };

    fetchRewards();
  }, [addToast]);

  // Fetch user points
  useEffect(() => {
    const fetchUserPoints = async () => {
      if (!user?.id) return;
      try {
        const response = await api.get(`/users/${user.id}`);
        setUserPoints(response.data.data?.points || 0);
      } catch (err) {
        console.error('Failed to fetch user points:', err);
      }
    };

    fetchUserPoints();
  }, [user?.id]);

  // Extract unique categories
  const categories = useMemo(() => {
    const cats = new Set(rewards.map((r) => r.category).filter(Boolean));
    return ['all', ...Array.from(cats).sort()];
  }, [rewards]);

  // Filter and sort rewards
  const filteredRewards = useMemo(() => {
    let filtered = rewards;

    // Apply category filter
    if (selectedCategory !== 'all') {
      filtered = filtered.filter((r) => r.category === selectedCategory);
    }

    // Apply sorting
    const sorted = [...filtered];
    switch (sortBy) {
      case 'cost-asc':
        sorted.sort((a, b) => a.cost - b.cost);
        break;
      case 'cost-desc':
        sorted.sort((a, b) => b.cost - a.cost);
        break;
      case 'name-asc':
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'name-desc':
        sorted.sort((a, b) => b.name.localeCompare(a.name));
        break;
      default:
        break;
    }

    return sorted;
  }, [rewards, selectedCategory, sortBy]);

  // Handle redeem button click
  const handleRedeemClick = (reward) => {
    setSelectedReward(reward);
    setIsModalOpen(true);
  };

  // Handle redemption confirmation
  const handleConfirmRedemption = async () => {
    if (!selectedReward || !user?.id) return;

    setIsRedeeming(true);
    try {
      // Optimistically decrement local balance
      const pointsBefore = userPoints;
      setUserPoints((prev) => Math.max(0, prev - selectedReward.cost));

      // Call redemption API
      const idempotencyKey = uuidv4();
      const response = await api.post(
        '/redemptions',
        {
          userId: user.id,
          rewardId: selectedReward.id,
        },
        {
          headers: {
            'X-Idempotency-Key': idempotencyKey,
          },
        }
      );

      // Update reward stock locally
      setRewards((prev) =>
        prev.map((r) =>
          r.id === selectedReward.id
            ? { ...r, stock: Math.max(0, r.stock - 1) }
            : r
        )
      );

      addToast(`Successfully redeemed ${selectedReward.name}!`, 'success');
      setShowConfetti(true);
      setIsModalOpen(false);
      setSelectedReward(null);
    } catch (err) {
      // Revert optimistic update on error
      setUserPoints(pointsBefore);

      const errorMessage =
        err.response?.data?.message ||
        err.response?.data?.error ||
        'Failed to redeem reward';

      addToast(errorMessage, 'error');
    } finally {
      setIsRedeeming(false);
    }
  };

  if (loading) {
    return (
      <div className="redemption-container">
        <div className="loading-spinner"></div>
        <p>Loading rewards...</p>
      </div>
    );
  }

  if (error && rewards.length === 0) {
    return (
      <div className="redemption-container">
        <div className="error-message">{error}</div>
      </div>
    );
  }

  return (
    <div className="redemption-container" style={{ position: 'relative' }}>
      <ConfettiBurst active={showConfetti} onComplete={() => setShowConfetti(false)} />
      <div className="redemption-header">
        <div>
          <h1>Redeem Rewards</h1>
          <p className="redemption-subtitle">
            You have <strong>{userPoints} points</strong> available
          </p>
        </div>
      </div>

      <div className="redemption-controls">
        <div className="control-group">
          <label htmlFor="category-filter">Category:</label>
          <select
            id="category-filter"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="input"
          >
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat === 'all' ? 'All Categories' : cat}
              </option>
            ))}
          </select>
        </div>

        <div className="control-group">
          <label htmlFor="sort-by">Sort by:</label>
          <select
            id="sort-by"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="input"
          >
            <option value="cost-asc">Cost: Low to High</option>
            <option value="cost-desc">Cost: High to Low</option>
            <option value="name-asc">Name: A to Z</option>
            <option value="name-desc">Name: Z to A</option>
          </select>
        </div>
      </div>

      {filteredRewards.length === 0 ? (
        <div className="empty-state">
          <p>No rewards available in this category.</p>
        </div>
      ) : (
        <div className="rewards-grid">
          {filteredRewards.map((reward) => (
            <RewardCard
              key={reward.id}
              reward={reward}
              userPoints={userPoints}
              onRedeem={handleRedeemClick}
              isLoading={isRedeeming}
            />
          ))}
        </div>
      )}

      <RedemptionModal
        isOpen={isModalOpen}
        reward={selectedReward}
        currentPoints={userPoints}
        onConfirm={handleConfirmRedemption}
        onCancel={() => {
          setIsModalOpen(false);
          setSelectedReward(null);
        }}
        isLoading={isRedeeming}
      />
    </div>
  );
}
