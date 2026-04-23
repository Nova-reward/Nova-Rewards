'use client';

import { withFeatureFlag, FLAGS } from '../lib/featureFlags';

/**
 * StakingPanel — allows users to stake NOVA tokens and view staking rewards.
 *
 * This component is gated behind the NEXT_PUBLIC_STAKING_ENABLED feature flag.
 * When the flag is false the HOC renders null, so no staking UI is shown and
 * no staking-related code is executed.
 *
 * Requirements: #606 (NEXT_PUBLIC_STAKING_ENABLED feature flag)
 */
function StakingPanel({ walletAddress, balance, onSuccess }) {
  return (
    <div className="card staking-panel">
      <h2 style={{ marginBottom: '1rem' }}>🔒 Stake NOVA</h2>
      <p style={{ color: 'var(--muted)', marginBottom: '1.5rem' }}>
        Stake your NOVA tokens to earn passive rewards. Unstake at any time.
      </p>

      {/* Staking form — full implementation in a future task */}
      <div
        style={{
          background: 'rgba(124, 58, 237, 0.08)',
          border: '1px solid rgba(124, 58, 237, 0.2)',
          borderRadius: '0.75rem',
          padding: '1.25rem',
          textAlign: 'center',
          color: 'var(--muted)',
          fontSize: '0.9rem',
        }}
      >
        Staking interface coming soon.
      </div>
    </div>
  );
}

// Wrap with the feature flag HOC — renders null when STAKING flag is off.
export default withFeatureFlag(StakingPanel, FLAGS.STAKING);
