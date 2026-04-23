'use client';

import { useState, useCallback } from 'react';
import Image from 'next/image';
import DashboardLayout from '../components/DashboardLayout';
import ErrorBoundary from '../components/ErrorBoundary';
import ConfirmationModal from '../components/ConfirmationModal';
import EmptyState from '../components/EmptyState';
import { SkeletonGrid } from '../components/Skeleton';
import { withAuth } from '../context/AuthContext';
import { getRewards, redeemReward } from '../lib/api';
import { useInfiniteScroll, useSentinel } from '../hooks/useInfiniteScroll';
import { useScrollRestoration } from '../hooks/useScrollRestoration';

const PAGE_LIMIT = 10; // fallback to "Load More" after this many pages

/**
 * Rewards page with infinite scroll.
 * Issue #333
 */
function RewardsContent() {
  const [userPoints, setUserPoints] = useState(0);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sortBy, setSortBy] = useState('points-asc');
  const [selectedReward, setSelectedReward] = useState(null);
  const [redeeming, setRedeeming] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [redeemError, setRedeemError] = useState('');

  useScrollRestoration('rewards');

  // Stable fetch function passed to the hook
  const fetchPage = useCallback(async (page) => {
    const data = await getRewards(page, 12);
    if (page === 1) setUserPoints(data.userPoints);
    return { items: data.rewards, hasMore: data.hasMore };
  }, []);

  const { items: rewards, loading, error, hasMore, page, loadMore, retry } =
    useInfiniteScroll(fetchPage, { pageLimit: PAGE_LIMIT });

  // Sentinel: auto-trigger loadMore; disabled once we hit the page limit
  const atPageLimit = !hasMore && page >= PAGE_LIMIT;
  const sentinelRef = useSentinel(loadMore, { enabled: hasMore && !loading && !error });

  // ── Filtering / sorting (client-side on loaded items) ──────────────────────
  const categories = ['all', ...Array.from(new Set(rewards.map((r) => r.category).filter(Boolean)))];

  const visibleRewards = [...rewards]
    .filter((r) => categoryFilter === 'all' || r.category === categoryFilter)
    .sort((a, b) => {
      if (sortBy === 'points-asc') return (a.pointCost ?? a.cost ?? 0) - (b.pointCost ?? b.cost ?? 0);
      if (sortBy === 'points-desc') return (b.pointCost ?? b.cost ?? 0) - (a.pointCost ?? a.cost ?? 0);
      return a.name.localeCompare(b.name);
    });

  // ── Redeem ─────────────────────────────────────────────────────────────────
  const handleConfirmRedeem = async () => {
    if (!selectedReward) return;
    setRedeeming(true);
    setRedeemError('');
    try {
      await redeemReward(selectedReward.id);
      const cost = selectedReward.pointCost ?? selectedReward.cost ?? 0;
      setUserPoints((p) => p - cost);
      setSuccessMessage(`Successfully redeemed ${selectedReward.name}!`);
      setSelectedReward(null);
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (err) {
      setRedeemError(err.message || 'Failed to redeem reward');
    } finally {
      setRedeeming(false);
    }
  };

  const canAfford = (r) => userPoints >= (r.pointCost ?? r.cost ?? 0);
  const inStock = (r) => r.stock > 0;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <DashboardLayout>
      <div className="dashboard-content">
        {successMessage && (
          <div className="success" style={{ marginBottom: '1rem', padding: '1rem', background: 'var(--badge-green-bg)', borderRadius: '8px' }}>
            {successMessage}
          </div>
        )}
        {redeemError && (
          <div className="error" style={{ marginBottom: '1rem', padding: '1rem', background: 'rgba(220,38,38,0.1)', borderRadius: '8px' }}>
            {redeemError}
          </div>
        )}

        {/* Header + filters */}
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2>🎁 Rewards Catalogue</h2>
            <div style={{ fontSize: '1.1rem', fontWeight: '600' }}>
              Your Points: <span style={{ color: 'var(--accent)' }}>{userPoints}</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <div>
              <label className="label">Category:</label>
              <select className="input" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} style={{ marginBottom: 0 }}>
                {categories.map((c) => (
                  <option key={c} value={c}>{c === 'all' ? 'All Categories' : c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Sort By:</label>
              <select className="input" value={sortBy} onChange={(e) => setSortBy(e.target.value)} style={{ marginBottom: 0 }}>
                <option value="points-asc">Points: Low to High</option>
                <option value="points-desc">Points: High to Low</option>
                <option value="name">Name</option>
              </select>
            </div>
          </div>
        </div>

        {/* Empty state (initial load done, nothing returned) */}
        {!loading && !error && rewards.length === 0 && (
          <EmptyState
            icon="rewards"
            title="No rewards available"
            description="There are no rewards in the catalogue right now. Check back soon!"
            variant="primary"
          />
        )}

        {/* Filtered empty state */}
        {!loading && rewards.length > 0 && visibleRewards.length === 0 && (
          <EmptyState
            icon="search"
            title="No rewards in this category"
            description="Try selecting a different category or clearing your filters."
          />
        )}

        {/* Reward grid */}
        <div className="rewards-grid">
          {visibleRewards.map((reward) => {
            const cost = reward.pointCost ?? reward.cost ?? 0;
            const affordable = canAfford(reward);
            const stocked = inStock(reward);
            return (
              <div key={reward.id} className="card" style={{ display: 'flex', flexDirection: 'column' }}>
                {reward.image && (
                  <div style={{ position: 'relative', width: '100%', height: '180px', borderRadius: '8px', overflow: 'hidden', marginBottom: '1rem' }}>
                    <Image src={reward.image} alt={reward.name} fill sizes="(max-width: 768px) 100vw, 33vw" style={{ objectFit: 'cover' }} />
                  </div>
                )}
                <h3 style={{ marginBottom: '0.5rem', fontSize: '1.1rem' }}>{reward.name}</h3>
                {reward.description && (
                  <p style={{ color: 'var(--muted)', fontSize: '0.9rem', marginBottom: '1rem', flex: 1 }}>{reward.description}</p>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <span style={{ fontSize: '1.2rem', fontWeight: '700', color: 'var(--accent)' }}>{cost} pts</span>
                  <span style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>Stock: {reward.stock}</span>
                </div>
                {reward.category && (
                  <div className="badge badge-gray" style={{ marginBottom: '1rem', width: 'fit-content' }}>{reward.category}</div>
                )}
                <button
                  className="btn btn-primary btn-full"
                  onClick={() => setSelectedReward(reward)}
                  disabled={!affordable || !stocked}
                  title={!stocked ? 'Out of stock' : !affordable ? 'Insufficient points' : 'Redeem'}
                >
                  {!stocked ? 'Out of Stock' : !affordable ? 'Insufficient Points' : 'Redeem'}
                </button>
              </div>
            );
          })}

          {/* Skeleton cards while loading next page */}
          {loading && <SkeletonGrid count={3} />}
        </div>

        {/* Sentinel — invisible trigger element for IntersectionObserver */}
        {hasMore && !error && <div ref={sentinelRef} aria-hidden="true" style={{ height: '1px' }} />}

        {/* Error state with retry */}
        {error && (
          <div className="card" style={{ textAlign: 'center', padding: '1.5rem' }}>
            <p className="error" style={{ marginBottom: '1rem' }}>⚠️ {error}</p>
            <button className="btn btn-secondary" onClick={retry}>Try Again</button>
          </div>
        )}

        {/* Hybrid fallback: "Load More" button after page limit or when auto-scroll is exhausted */}
        {!hasMore && rewards.length > 0 && !loading && !error && (
          <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--muted)', fontSize: '0.9rem' }}>
            {atPageLimit ? (
              <button className="btn btn-secondary" onClick={loadMore}>Load More</button>
            ) : (
              <p>You&apos;ve seen all available rewards 🎉</p>
            )}
          </div>
        )}
      </div>

      {selectedReward && (
        <ConfirmationModal
          title="Confirm Redemption"
          message={
            <div>
              <p style={{ marginBottom: '1rem' }}>Are you sure you want to redeem this reward?</p>
              <div className="confirmation-details">
                <p><strong>Reward:</strong> {selectedReward.name}</p>
                <p><strong>Cost:</strong> {(selectedReward.pointCost ?? selectedReward.cost ?? 0)} points</p>
                <p><strong>Your Balance:</strong> {userPoints} points</p>
                <p><strong>After Redemption:</strong> {userPoints - (selectedReward.pointCost ?? selectedReward.cost ?? 0)} points</p>
              </div>
            </div>
          }
          onConfirm={handleConfirmRedeem}
          onCancel={() => setSelectedReward(null)}
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
