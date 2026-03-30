'use client';

import { useState, useEffect, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Asset, TransactionBuilder, Operation, Networks, BASE_FEE, Horizon } from 'stellar-sdk';
import api from '../lib/api';
import { signAndSubmit } from '../lib/freighter';
import { useAuth } from '../context/AuthContext';
import { useWallet } from '../context/WalletContext';
import { useToast } from './Toast';
import RewardCard from './RewardCard';
import RedemptionModal from './RedemptionModal';
import RedemptionHistory from './RedemptionHistory';
import ConfettiBurst from './ConfettiBurst';

const HORIZON_URL = process.env.NEXT_PUBLIC_HORIZON_URL || 'https://horizon-testnet.stellar.org';
const ISSUER_PUBLIC = process.env.NEXT_PUBLIC_ISSUER_PUBLIC;
const NETWORK_PASSPHRASE =
  process.env.NEXT_PUBLIC_STELLAR_NETWORK === 'mainnet' ? Networks.PUBLIC : Networks.TESTNET;

/**
 * Full redemption flow:
 *  1. Browse catalogue with filter/sort
 *  2. Select reward & amount → modal
 *  3. Wallet signature via Freighter
 *  4. Real-time tx status tracking
 *  5. Toast notifications on success/error
 *  6. Redemption history panel
 */
export default function RedemptionCatalogue() {
  const { user } = useAuth();
  const { publicKey, refreshBalance } = useWallet();
  const { addToast } = useToast();

  const [rewards, setRewards] = useState([]);
  const [userPoints, setUserPoints] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState('cost-asc');

  const [selectedReward, setSelectedReward] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  // Transaction status: 'idle' | 'pending' | 'success' | 'error'
  const [txStatus, setTxStatus] = useState('idle');
  const [txHash, setTxHash] = useState(null);
  const [txError, setTxError] = useState(null);

  // Reload history key to trigger re-fetch after redemption
  const [historyKey, setHistoryKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const [rewardsRes, userRes] = await Promise.all([
          api.get('/rewards'),
          user?.id ? api.get(`/users/${user.id}`) : Promise.resolve(null),
        ]);
        if (cancelled) return;
        setRewards(rewardsRes.data.data || rewardsRes.data);
        setUserPoints(userRes?.data?.data?.points || 0);
      } catch (err) {
        if (!cancelled) {
          setError(err.response?.data?.message || 'Failed to load rewards');
          addToast('Failed to load rewards catalogue', 'error');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchData();
    return () => { cancelled = true; };
  }, [user?.id, addToast]);

  const categories = useMemo(() => {
    const cats = new Set(rewards.map((r) => r.category).filter(Boolean));
    return ['all', ...Array.from(cats).sort()];
  }, [rewards]);

  const filteredRewards = useMemo(() => {
    let list = selectedCategory === 'all' ? rewards : rewards.filter((r) => r.category === selectedCategory);
    const sorted = [...list];
    switch (sortBy) {
      case 'cost-asc':  sorted.sort((a, b) => a.cost - b.cost); break;
      case 'cost-desc': sorted.sort((a, b) => b.cost - a.cost); break;
      case 'name-asc':  sorted.sort((a, b) => a.name.localeCompare(b.name)); break;
      case 'name-desc': sorted.sort((a, b) => b.name.localeCompare(a.name)); break;
    }
    return sorted;
  }, [rewards, selectedCategory, sortBy]);

  const openModal = (reward) => {
    setSelectedReward(reward);
    setTxStatus('idle');
    setTxHash(null);
    setTxError(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    if (txStatus === 'pending') return; // block close while signing
    setIsModalOpen(false);
    setSelectedReward(null);
    setTxStatus('idle');
    setTxHash(null);
    setTxError(null);
  };

  /**
   * Full redemption flow:
   *  1. Build Stellar payment tx
   *  2. Sign with Freighter (wallet signature)
   *  3. Submit to Horizon
   *  4. Record in backend
   */
  const handleConfirmRedemption = async (amount) => {
    if (!selectedReward || !user?.id) return;

    setTxStatus('pending');
    setTxHash(null);
    setTxError(null);

    const totalCost = selectedReward.cost * amount;
    const idempotencyKey = uuidv4();

    try {
      let hash = null;

      // ── Stellar on-chain redemption (if wallet connected) ──────────────
      if (publicKey && ISSUER_PUBLIC) {
        const server = new Horizon.Server(HORIZON_URL);
        const account = await server.loadAccount(publicKey);
        const novaAsset = new Asset('NOVA', ISSUER_PUBLIC);

        const tx = new TransactionBuilder(account, {
          fee: BASE_FEE,
          networkPassphrase: NETWORK_PASSPHRASE,
        })
          .addOperation(
            Operation.payment({
              destination: ISSUER_PUBLIC, // burn back to issuer
              asset: novaAsset,
              amount: String(totalCost),
            })
          )
          .setTimeout(180)
          .build();

        const result = await signAndSubmit(tx.toXDR());
        hash = result.txHash;
        setTxHash(hash);
      }

      // ── Record redemption in backend ───────────────────────────────────
      await api.post(
        '/redemptions',
        { userId: user.id, rewardId: selectedReward.id, quantity: amount, txHash: hash },
        { headers: { 'X-Idempotency-Key': idempotencyKey } }
      );

      // ── Optimistic local updates ───────────────────────────────────────
      setUserPoints((prev) => Math.max(0, prev - totalCost));
      setRewards((prev) =>
        prev.map((r) =>
          r.id === selectedReward.id ? { ...r, stock: Math.max(0, r.stock - amount) } : r
        )
      );

      setTxStatus('success');
      setShowConfetti(true);
      setHistoryKey((k) => k + 1);
      addToast(`🎉 Redeemed ${selectedReward.name}!`, 'success');
      if (publicKey) refreshBalance(publicKey);
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        'Redemption failed';
      setTxStatus('error');
      setTxError(msg);
      addToast(msg, 'error');
    }
  };

  if (loading) {
    return (
      <div className="redemption-container">
        <div className="loading-spinner" />
        <p>Loading rewards…</p>
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
            You have <strong>{userPoints.toLocaleString()} points</strong> available
          </p>
        </div>
      </div>

      {/* ── Filters ── */}
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

      {/* ── Rewards grid ── */}
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
              onRedeem={openModal}
            />
          ))}
        </div>
      )}

      {/* ── Redemption history ── */}
      <div style={{ marginTop: '2rem' }}>
        <RedemptionHistory key={historyKey} />
      </div>

      {/* ── Modal ── */}
      <RedemptionModal
        isOpen={isModalOpen}
        reward={selectedReward}
        currentPoints={userPoints}
        onConfirm={handleConfirmRedemption}
        onCancel={closeModal}
        isLoading={txStatus === 'pending'}
        txStatus={txStatus}
        txHash={txHash}
        txError={txError}
      />
    </div>
  );
}
